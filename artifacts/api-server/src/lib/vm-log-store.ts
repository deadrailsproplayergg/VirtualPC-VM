import { EventEmitter } from "events";

export interface LogEntry {
  ts: number;
  stream: "stdout" | "stderr";
  line: string;
}

const stores = new Map<number, { logs: LogEntry[]; emitter: EventEmitter }>();
const timers = new Map<number, ReturnType<typeof setInterval>>();

function getStore(vmId: number) {
  if (!stores.has(vmId)) {
    stores.set(vmId, { logs: [], emitter: new EventEmitter() });
  }
  return stores.get(vmId)!;
}

export function pushLog(vmId: number, stream: "stdout" | "stderr", line: string) {
  const store = getStore(vmId);
  const entry: LogEntry = { ts: Date.now(), stream, line };
  store.logs.push(entry);
  store.emitter.emit("log", entry);
}

export function getLogs(vmId: number): LogEntry[] {
  return stores.get(vmId)?.logs ?? [];
}

export function getEmitter(vmId: number): EventEmitter {
  return getStore(vmId).emitter;
}

export function clearLogs(vmId: number) {
  const store = stores.get(vmId);
  if (store) {
    store.logs = [];
    store.emitter.emit("clear");
  }
}

const QEMU_STDOUT_LINES = [
  "QEMU emulator version 8.2.0 (Debian 1:8.2.2+ds-0ubuntu1.3)",
  "Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers",
  "SeaBIOS (version 1.14.0-2)",
  "iPXE (http://ipxe.org) 00:03.0 C900 PCI2.10 PnP PMM+07F8B4A0+07ECB4A0 C900",
  "Booting from Hard Disk...",
  "GRUB loading.",
  "Welcome to GRUB!",
  "Loading Linux 5.15.0-91-generic ...",
  "Loading initial ramdisk ...",
  "[    0.000000] Linux version 5.15.0-91-generic (buildd@lcy02-amd64-028) #101-Ubuntu SMP Tue Nov 14",
  "[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-5.15.0-91-generic root=UUID=1234 ro quiet splash",
  "[    0.000000] BIOS-provided physical RAM map:",
  "[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable",
  "[    0.000000] BIOS-e820: [mem 0x0000000000100000-0x00000000bffdffff] usable",
  "[    0.012345] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'",
  "[    0.012346] x86/fpu: Supporting XSAVE feature 0x002: 'SSE registers'",
  "[    0.012347] x86/fpu: xstate_offset[2]: 576, xstate_sizes[2]: 256",
  "[    0.145000] pci 0000:00:00.0: [8086:29c0] type 00 class 0x060000",
  "[    0.145001] pci 0000:00:01.0: [1234:1111] type 00 class 0x030000",
  "[    0.145002] pci 0000:00:02.0: [8086:100e] type 00 class 0x020000",
  "[    0.209000] clocksource: tsc-early: mask: 0xffffffffffffffff max_cycles: 0x31f0c3",
  "[    0.312000] NET: Registered PF_INET6 protocol family",
  "[    0.401000] Freeing unused kernel image (initmem) memory: 2820K",
  "[    0.512000] Write protecting the kernel read-only data: 20480k",
  "[    0.601000] Freeing unused kernel image (text/rodata gap) memory: 2032K",
  "[    0.702000] ACPI: PM-Timer IO Port: 0x608",
  "[    0.810000] PCI: Using configuration type 1 for base access",
  "[    1.001000] SCSI subsystem initialized",
  "[    1.102000] virtio-blk virtio1: [vda] 20971520 512-byte logical blocks (10.7 GB/10.0 GiB)",
  "[    1.201000] virtio_net virtio0 enp0s2: renamed from eth0",
  "[    1.301000] EXT4-fs (vda1): mounted filesystem with ordered data mode",
  "[    1.401000] systemd[1]: Detected virtualization kvm.",
  "[    1.501000] systemd[1]: Reached target Swap.",
  "[    1.601000] systemd[1]: Reached target Local File Systems.",
  "[    1.701000] systemd[1]: Starting Journal Service...",
  "[    1.801000] systemd[1]: Started Journal Service.",
  "[    1.901000] systemd[1]: Starting Network Service...",
  "[    2.001000] systemd[1]: Started Network Service.",
  "[    2.101000] systemd[1]: Starting OpenSSH Server Daemon...",
  "[    2.201000] systemd[1]: Started OpenSSH Server Daemon.",
  "[    2.301000] systemd[1]: Reached target Multi-User System.",
  "[    2.401000] systemd[1]: Startup finished in 2.3s (kernel) + 0.1s (userspace) = 2.4s total.",
  "Ubuntu 22.04.3 LTS virtualpc tty1",
  "virtualpc login: ",
];

const QEMU_STDERR_LINES = [
  "qemu-system-x86_64: warning: host doesn't support requested feature: CPUID.80000001H:ECX.svm [bit 2]",
  "qemu-system-x86_64: info: kvm not available, falling back to MTCG",
  "qemu-system-x86_64: warning: TSC frequency mismatch between VM (2593.906 MHz) and host (2600 MHz) — using host TSC",
];

export function startVMLogSimulation(vmId: number) {
  stopVMLogSimulation(vmId);
  clearLogs(vmId);

  let idx = 0;
  let stderrIdx = 0;

  const interval = setInterval(() => {
    if (stderrIdx < QEMU_STDERR_LINES.length && Math.random() < 0.1) {
      pushLog(vmId, "stderr", QEMU_STDERR_LINES[stderrIdx++]);
    }

    if (idx < QEMU_STDOUT_LINES.length) {
      pushLog(vmId, "stdout", QEMU_STDOUT_LINES[idx++]);
    } else {
      clearInterval(interval);
      timers.delete(vmId);
    }
  }, 160);

  timers.set(vmId, interval);
}

export function stopVMLogSimulation(vmId: number) {
  const t = timers.get(vmId);
  if (t) {
    clearInterval(t);
    timers.delete(vmId);
  }
}
