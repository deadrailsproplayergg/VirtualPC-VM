import { Router, type IRouter } from "express";
import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { db } from "@workspace/db";
import { vmsTable, insertVmSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateVMBody,
  UpdateVMBody,
  GetVMParams,
  UpdateVMParams,
  DeleteVMParams,
  StartVMParams,
  StopVMParams,
} from "@workspace/api-zod";
import {
  getLogs,
  getEmitter,
  clearLogs,
  pushLog,
  startVMLogSimulation,
  stopVMLogSimulation,
  type LogEntry,
} from "../lib/vm-log-store.js";
import { getQemuBinary } from "../lib/qemu-installer.js";

/* track real QEMU processes: vmId → ChildProcess */
const runningProcs = new Map<number, ChildProcess>();

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const vms = await db.select().from(vmsTable).orderBy(vmsTable.createdAt);
    res.json(vms.map(formatVm));
  } catch {
    res.status(500).json({ error: "Failed to list VMs" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateVMBody.parse(req.body);
    const insert = insertVmSchema.parse(body);
    const [vm] = await db.insert(vmsTable).values(insert).returning();
    res.status(201).json(formatVm(vm));
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = GetVMParams.parse({ id: Number(req.params.id) });
    const [vm] = await db.select().from(vmsTable).where(eq(vmsTable.id, id));
    if (!vm) return res.status(404).json({ error: "VM not found" });
    res.json(formatVm(vm));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateVMParams.parse({ id: Number(req.params.id) });
    const body = UpdateVMBody.parse(req.body);
    const [vm] = await db
      .update(vmsTable)
      .set(insertVmSchema.parse(body))
      .where(eq(vmsTable.id, id))
      .returning();
    if (!vm) return res.status(404).json({ error: "VM not found" });
    res.json(formatVm(vm));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteVMParams.parse({ id: Number(req.params.id) });
    await db.delete(vmsTable).where(eq(vmsTable.id, id));
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/start", async (req, res) => {
  try {
    const { id } = StartVMParams.parse({ id: Number(req.params.id) });
    const [vm] = await db
      .update(vmsTable)
      .set({ status: "running" })
      .where(eq(vmsTable.id, id))
      .returning();
    if (!vm) return res.status(404).json({ error: "VM not found" });

    clearLogs(id);

    const qemuBin = await getQemuBinary(vm.architecture ?? "x86_64");
    if (qemuBin) {
      /* ── launch real QEMU ── */
      const args = buildQemuArgs(vm, qemuBin);
      pushLog(id, "stdout", `$ ${qemuBin} ${args.join(" ")}`);

      const proc = spawn(qemuBin, args, { stdio: ["ignore", "pipe", "pipe"] });
      runningProcs.set(id, proc);

      const onLine = (stream: "stdout" | "stderr") => (data: Buffer) => {
        data.toString().split(/\r?\n/).filter(Boolean).forEach((line) => {
          pushLog(id, stream, line);
        });
      };
      proc.stdout.on("data", onLine("stdout"));
      proc.stderr.on("data", onLine("stderr"));

      proc.on("close", async (code) => {
        runningProcs.delete(id);
        pushLog(id, "stderr", `[QEMU завершился с кодом ${code ?? 0}]`);
        await db.update(vmsTable).set({ status: "stopped" }).where(eq(vmsTable.id, id));
      });

      proc.on("error", (err) => {
        pushLog(id, "stderr", `[Ошибка запуска QEMU: ${err.message}]`);
        runningProcs.delete(id);
      });

      res.json({ id: vm.id, status: "running", message: "VM запущена (реальный QEMU)", qemuBin });
    } else {
      /* ── fallback: log simulation ── */
      pushLog(id, "stderr", "[QEMU не установлен — запуск в режиме симуляции]");
      startVMLogSimulation(id);
      res.json({ id: vm.id, status: "running", message: "VM запущена (симуляция)" });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/stop", async (req, res) => {
  try {
    const { id } = StopVMParams.parse({ id: Number(req.params.id) });
    const [vm] = await db
      .update(vmsTable)
      .set({ status: "stopped" })
      .where(eq(vmsTable.id, id))
      .returning();
    if (!vm) return res.status(404).json({ error: "VM not found" });

    /* kill real QEMU process if running */
    const proc = runningProcs.get(id);
    if (proc) {
      proc.kill("SIGTERM");
      runningProcs.delete(id);
      pushLog(id, "stdout", "[QEMU процесс остановлен]");
    } else {
      stopVMLogSimulation(id);
    }

    res.json({ id: vm.id, status: "stopped", message: "VM остановлена" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/* ── build QEMU args from VM record ── */
type VmRow = typeof vmsTable.$inferSelect;
function buildQemuArgs(vm: VmRow, _bin: string): string[] {
  const args: string[] = [];

  const machine = vm.machineType ?? (vm.architecture?.startsWith("arm") ? "virt" : "q35");
  args.push("-machine", machine);

  args.push("-m", `${vm.ramMb ?? 512}M`);
  args.push("-smp", `${vm.cpuCores ?? 1}`);

  if (vm.enableKvm) args.push("-enable-kvm");

  if (vm.enableMtcg) args.push("-accel", "tcg,thread=multi");
  else args.push("-accel", "tcg");

  if (vm.firmware === "uefi") {
    const ovmfPaths = [
      "/usr/share/OVMF/OVMF_CODE.fd",
      "/run/libvirt/nix-ovmf/OVMF_CODE.fd",
      `${process.env.HOME}/.nix-profile/share/qemu/edk2-x86_64-code.fd`,
    ];
    const ovmf = ovmfPaths.find(existsSync);
    if (ovmf) args.push("-bios", ovmf);
  }

  if (vm.isoPath) args.push("-cdrom", vm.isoPath, "-boot", "d");

  /* VNC on display :1 (port 5901) */
  args.push("-vnc", ":1");

  /* no GUI window */
  args.push("-nographic");

  if (vm.disableTsc) args.push("-cpu", "base,tsc=off");

  return args;
}

/* SSE: GET /api/vms/:id/logs — streams QEMU stdout/stderr in real time */
router.get("/:id/logs", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid VM id" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (type: string, payload: object) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const existing = getLogs(id);
  for (const entry of existing) {
    sendEvent("log", entry);
  }

  const onLog = (entry: LogEntry) => sendEvent("log", entry);
  const onClear = () => sendEvent("clear", {});

  const emitter = getEmitter(id);
  emitter.on("log", onLog);
  emitter.on("clear", onClear);

  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    emitter.off("log", onLog);
    emitter.off("clear", onClear);
  });
});

/* POST /api/vms/:id/logs/clear */
router.post("/:id/logs/clear", (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid VM id" });
    return;
  }
  clearLogs(id);
  res.status(204).send();
});

function formatVm(vm: typeof vmsTable.$inferSelect) {
  return {
    id: vm.id,
    name: vm.name,
    ramMb: vm.ramMb,
    cpuCores: vm.cpuCores,
    architecture: vm.architecture,
    machineType: vm.machineType,
    firmware: vm.firmware,
    enableMtcg: vm.enableMtcg,
    enableKvm: vm.enableKvm,
    disableTsc: vm.disableTsc,
    isoPath: vm.isoPath ?? null,
    diskId: vm.diskId ?? null,
    status: vm.status,
    createdAt: vm.createdAt.toISOString(),
  };
}

export default router;
