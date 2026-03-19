export interface DeviceInfo {
  ramGb: number | null;
  cpuCores: number | null;
  isMobile: boolean;
  platform: string;
}

export function getDeviceInfo(): DeviceInfo {
  const nav = navigator as any;
  const ramGb: number | null = nav.deviceMemory ?? null;
  const cpuCores: number | null = nav.hardwareConcurrency ?? null;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "Unknown";
  return { ramGb, cpuCores, isMobile, platform };
}

export function getOptimalVMSettings(device: DeviceInfo) {
  const hostRamMb = (device.ramGb ?? 4) * 1024;
  const hostCores = device.cpuCores ?? 4;

  const recommendedRamMb = Math.min(Math.floor(hostRamMb / 2 / 256) * 256, 8192);
  const recommendedCores = Math.max(1, Math.floor(hostCores / 2));

  const warningThresholds = {
    ramMb: Math.floor(hostRamMb * 0.75),
    cpuCores: Math.floor(hostCores * 0.75),
  };

  return { recommendedRamMb, recommendedCores, warningThresholds, hostRamMb, hostCores };
}
