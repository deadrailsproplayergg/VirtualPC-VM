import type { CreateVMRequest } from "@workspace/api-client-react";

interface DiskInfo {
  id: number;
  name: string;
  sizeMb: number;
  format: string;
  path: string;
}

const ARCH_BINARY: Record<string, string> = {
  arm: "qemu-system-arm",
  arm64: "qemu-system-aarch64",
  x86: "qemu-system-i386",
  x86_64: "qemu-system-x86_64",
  i386: "qemu-system-i386",
  powerpc: "qemu-system-ppc",
};

const ARCH_CPU: Record<string, string> = {
  arm: "cortex-a15",
  arm64: "cortex-a72",
  x86: "qemu32",
  x86_64: "qemu64",
  i386: "486",
  powerpc: "g3",
};

const COMPAT_MACHINES: Record<string, string[]> = {
  arm: ["virt"],
  arm64: ["virt"],
  x86: ["q35", "pc", "isapc"],
  x86_64: ["q35", "pc", "isapc"],
  i386: ["q35", "pc", "isapc"],
  powerpc: ["mac99"],
};

export function getCompatibleMachines(arch: string): string[] {
  return COMPAT_MACHINES[arch] ?? ["q35"];
}

export function checkArchMachineCompat(arch: string, machineType: string): string | null {
  const allowed = COMPAT_MACHINES[arch] ?? [];
  if (!allowed.includes(machineType)) {
    return `Архитектура «${arch}» не совместима с типом машины «${machineType}». Доступные: ${allowed.join(", ")}.`;
  }
  return null;
}

export function generateQEMUCommand(
  config: Partial<CreateVMRequest>,
  disk?: DiskInfo | null
): string {
  const arch = config.architecture ?? "x86_64";
  const binary = ARCH_BINARY[arch] ?? "qemu-system-x86_64";
  const cpu = ARCH_CPU[arch] ?? "qemu64";
  const machine = config.machineType ?? "q35";
  const ram = config.ramMb ?? 1024;
  const cores = config.cpuCores ?? 2;
  const firmware = config.firmware ?? "bios";
  const isoPath = config.isoPath;

  const args: string[] = [binary];

  args.push(`-machine ${machine}`);
  args.push(`-cpu ${cpu}`);
  args.push(`-smp ${cores}`);
  args.push(`-m ${ram}`);

  if (firmware === "uefi") {
    args.push(`-bios /usr/share/OVMF/OVMF_CODE.fd`);
  }

  if (config.enableKvm) {
    args.push(`-enable-kvm`);
  } else if (config.enableMtcg) {
    args.push(`-accel tcg,thread=multi`);
  }

  if (config.disableTsc) {
    args.push(`-no-hpet`);
    args.push(`-rtc base=localtime,clock=host,driftfix=slew`);
  }

  args.push(`-vga std`);
  args.push(`-display vnc=:0`);

  if (disk) {
    args.push(
      `-drive file=${disk.path},format=${disk.format},if=virtio`
    );
  }

  if (isoPath) {
    args.push(`-cdrom ${isoPath}`);
    args.push(`-boot order=dc`);
  } else {
    args.push(`-boot order=c`);
  }

  args.push(`-netdev user,id=net0 -device virtio-net-pci,netdev=net0`);

  return args.join(" \\\n  ");
}
