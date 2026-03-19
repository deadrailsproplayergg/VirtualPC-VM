import type { CreateVMRequest } from "@workspace/api-client-react";

export interface VMPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  config: Partial<CreateVMRequest>;
}

export const VM_PRESETS: VMPreset[] = [
  {
    id: "win98",
    label: "Windows 98",
    emoji: "🪟",
    description: "64 MB RAM, i386, BIOS",
    config: {
      name: "Windows 98",
      ramMb: 64,
      cpuCores: 1,
      architecture: "i386",
      machineType: "pc",
      firmware: "bios",
      enableMtcg: true,
      enableKvm: false,
      disableTsc: true,
    },
  },
  {
    id: "linux-lite",
    label: "Linux Lite",
    emoji: "🐧",
    description: "512 MB RAM, x86_64, q35",
    config: {
      name: "Linux Lite",
      ramMb: 512,
      cpuCores: 2,
      architecture: "x86_64",
      machineType: "q35",
      firmware: "bios",
      enableMtcg: true,
      enableKvm: true,
      disableTsc: false,
    },
  },
  {
    id: "android-x86",
    label: "Android x86",
    emoji: "🤖",
    description: "2 GB RAM, x86_64, q35, UEFI",
    config: {
      name: "Android x86",
      ramMb: 2048,
      cpuCores: 4,
      architecture: "x86_64",
      machineType: "q35",
      firmware: "uefi",
      enableMtcg: true,
      enableKvm: true,
      disableTsc: false,
    },
  },
  {
    id: "arm-linux",
    label: "ARM Linux",
    emoji: "💪",
    description: "1 GB RAM, ARM64, virt",
    config: {
      name: "ARM Linux",
      ramMb: 1024,
      cpuCores: 2,
      architecture: "arm64",
      machineType: "virt",
      firmware: "uefi",
      enableMtcg: true,
      enableKvm: false,
      disableTsc: false,
    },
  },
];
