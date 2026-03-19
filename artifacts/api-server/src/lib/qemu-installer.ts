import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import https from "https";
import { EventEmitter } from "events";

const execAsync = promisify(exec);

const BINS_DIR = path.join(process.env.HOME ?? "/tmp", ".qemu-bins");
const NIX_PROFILE_BIN = path.join(process.env.HOME ?? "/tmp", ".nix-profile", "bin");

const ARCH_BINARY_MAP: Record<string, string> = {
  "x86_64": "qemu-system-x86_64",
  "x86":    "qemu-system-x86_64",
  "i386":   "qemu-system-i386",
  "arm64":  "qemu-system-aarch64",
  "arm":    "qemu-system-arm",
  "powerpc":"qemu-system-ppc",
};

const ALL_BINARIES = [...new Set(Object.values(ARCH_BINARY_MAP))];

export type InstallEvent =
  | { type: "step";     message: string }
  | { type: "progress"; percent: number }
  | { type: "log";      line: string; level: "info" | "warn" | "ok" | "error" }
  | { type: "done";     binaries: Record<string, string>; version: string }
  | { type: "error";    message: string };

export interface QemuStatus {
  installed: boolean;
  binaries: Record<string, string>;
  version: string | null;
  source: "system" | "nix-profile" | "local" | null;
}

/* ── locate a binary by name in priority order ── */
async function locate(name: string): Promise<string | null> {
  const candidates = [
    path.join(NIX_PROFILE_BIN, name),
    path.join(BINS_DIR, name),
    `/usr/bin/${name}`,
    `/usr/local/bin/${name}`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const { stdout } = await execAsync(`which ${name}`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/* ── get current QEMU status ── */
export async function getQemuStatus(): Promise<QemuStatus> {
  const binaries: Record<string, string> = {};
  for (const bin of ALL_BINARIES) {
    const p = await locate(bin);
    if (p) binaries[bin] = p;
  }

  if (Object.keys(binaries).length === 0) {
    return { installed: false, binaries: {}, version: null, source: null };
  }

  const firstBin = Object.values(binaries)[0];
  let version: string | null = null;
  try {
    const { stdout } = await execAsync(`"${firstBin}" --version 2>&1`);
    const m = stdout.match(/QEMU emulator version ([\d.]+)/i);
    version = m ? m[1] : stdout.split("\n")[0].trim();
  } catch { /* ignore */ }

  const source: QemuStatus["source"] = firstBin.startsWith(NIX_PROFILE_BIN) ? "nix-profile"
    : firstBin.startsWith(BINS_DIR) ? "local"
    : "system";

  return { installed: true, binaries, version, source };
}

/* ── get binary path for a given VM arch ── */
export async function getQemuBinary(arch: string): Promise<string | null> {
  const name = ARCH_BINARY_MAP[arch] ?? ARCH_BINARY_MAP["x86_64"];
  return locate(name);
}

/* ── install QEMU via nix-env, streaming events ── */
export function installQemu(emitter: EventEmitter): void {
  (async () => {
    const emit = (e: InstallEvent) => emitter.emit("event", e);

    try {
      emit({ type: "step", message: "Проверка существующей установки..." });
      emit({ type: "progress", percent: 2 });

      const existing = await getQemuStatus();
      if (existing.installed && Object.keys(existing.binaries).length >= 2) {
        emit({ type: "log", line: `✓ QEMU уже установлен: ${existing.version}`, level: "ok" });
        emit({ type: "progress", percent: 100 });
        emit({ type: "done", binaries: existing.binaries, version: existing.version ?? "" });
        return;
      }

      emit({ type: "step", message: "Определение метода установки..." });
      emit({ type: "progress", percent: 5 });

      const hasNix = await execAsync("nix-env --version 2>&1")
        .then(() => true).catch(() => false);

      if (hasNix) {
        await installViaNix(emit);
      } else {
        await downloadGitHubBinaries(emit);
      }
    } catch (err: any) {
      emitter.emit("event", { type: "error", message: err.message ?? String(err) } as InstallEvent);
    }
  })();
}

/* ── nix-env installation ── */
async function installViaNix(emit: (e: InstallEvent) => void): Promise<void> {
  emit({ type: "step", message: "Установка через Nix (загрузка бинарников)..." });
  emit({ type: "log", line: "$ nix-env -iA nixpkgs.qemu", level: "info" });
  emit({ type: "progress", percent: 10 });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("nix-env", ["-iA", "nixpkgs.qemu"], {
      env: { ...process.env },
    });

    let progressTick = 10;

    const advance = setInterval(() => {
      if (progressTick < 85) {
        progressTick += 2;
        emit({ type: "progress", percent: progressTick });
      }
    }, 3000);

    proc.stdout.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (line) emit({ type: "log", line, level: "info" });
    });

    proc.stderr.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (!line) return;
      if (line.includes("error:") || line.includes("Error")) {
        emit({ type: "log", line, level: "error" });
      } else if (line.includes("warning:")) {
        emit({ type: "log", line, level: "warn" });
      } else {
        emit({ type: "log", line, level: "info" });
      }
    });

    proc.on("close", (code) => {
      clearInterval(advance);
      if (code === 0) resolve();
      else reject(new Error(`nix-env завершился с кодом ${code}`));
    });

    proc.on("error", (err) => { clearInterval(advance); reject(err); });
  });

  emit({ type: "step", message: "Верификация установленных бинарников..." });
  emit({ type: "progress", percent: 90 });

  await verifyAndFinish(emit);
}

/* ── GitHub static binary download ── */
async function downloadGitHubBinaries(emit: (e: InstallEvent) => void): Promise<void> {
  fs.mkdirSync(BINS_DIR, { recursive: true });

  const STATIC_BINS: Array<{ name: string; url: string }> = [
    {
      name: "qemu-system-x86_64",
      url: "https://github.com/nicowillis/qemu-static/releases/download/v8.1.0/qemu-system-x86_64-x86_64-linux",
    },
    {
      name: "qemu-system-aarch64",
      url: "https://github.com/nicowillis/qemu-static/releases/download/v8.1.0/qemu-system-aarch64-x86_64-linux",
    },
  ];

  const total = STATIC_BINS.length;
  let done = 0;

  for (const { name, url } of STATIC_BINS) {
    const dest = path.join(BINS_DIR, name);
    emit({ type: "step", message: `Загрузка ${name}...` });
    emit({ type: "log", line: `↓ ${url}`, level: "info" });

    await downloadFile(url, dest, (pct) => {
      const overall = Math.round(10 + ((done + pct / 100) / total) * 70);
      emit({ type: "progress", percent: overall });
    });

    fs.chmodSync(dest, 0o755);
    emit({ type: "log", line: `✓ chmod +x ${dest}`, level: "ok" });
    done++;
  }

  emit({ type: "step", message: "Верификация бинарников..." });
  emit({ type: "progress", percent: 90 });
  await verifyAndFinish(emit);
}

function downloadFile(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location!);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} от ${u}`));
        }
        const total = Number(res.headers["content-length"] ?? 0);
        let received = 0;
        const file = fs.createWriteStream(dest);
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0) onProgress(Math.round((received / total) * 100));
        });
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

/* ── verify and emit done event ── */
async function verifyAndFinish(emit: (e: InstallEvent) => void): Promise<void> {
  const status = await getQemuStatus();

  if (!status.installed) {
    throw new Error("QEMU не найден после установки. Проверьте PATH.");
  }

  for (const [bin, binPath] of Object.entries(status.binaries)) {
    emit({ type: "log", line: `✓ ${bin} → ${binPath}`, level: "ok" });

    try {
      const { stdout } = await execAsync(`"${binPath}" --version 2>&1`);
      const line = stdout.split("\n")[0].trim();
      emit({ type: "log", line: `  ↳ ${line}`, level: "ok" });
    } catch {
      emit({ type: "log", line: `  ↳ (не удалось получить версию)`, level: "warn" });
    }
  }

  emit({ type: "progress", percent: 100 });
  emit({ type: "done", binaries: status.binaries, version: status.version ?? "" });
}
