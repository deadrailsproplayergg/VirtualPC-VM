export interface ImageEntry {
  id: string;
  name: string;
  version: string;
  arch: string;
  sizeMb: number;
  url: string;
  description: string;
  emoji: string;
  tags: string[];
}

export const IMAGE_CATALOG: ImageEntry[] = [
  {
    id: "android-x86-9",
    name: "Android x86",
    version: "9.0 (Pie)",
    arch: "x86_64",
    sizeMb: 890,
    url: "https://sourceforge.net/projects/android-x86/files/Release%209.0/android-x86_64-9.0-r2.iso",
    description: "Android 9 для запуска на x86/x86_64 ПК",
    emoji: "🤖",
    tags: ["android", "mobile", "x86"],
  },
  {
    id: "alpine-linux-38",
    name: "Alpine Linux",
    version: "3.18",
    arch: "x86_64",
    sizeMb: 190,
    url: "https://dl-cdn.alpinelinux.org/alpine/v3.18/releases/x86_64/alpine-standard-3.18.0-x86_64.iso",
    description: "Легковесный дистрибутив Linux (190 MB)",
    emoji: "🏔️",
    tags: ["linux", "lightweight", "server"],
  },
  {
    id: "debian-12",
    name: "Debian",
    version: "12 Bookworm",
    arch: "x86_64",
    sizeMb: 650,
    url: "https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.1.0-amd64-netinst.iso",
    description: "Стабильный дистрибутив Linux",
    emoji: "🌀",
    tags: ["linux", "debian", "stable"],
  },
  {
    id: "reactos-043",
    name: "ReactOS",
    version: "0.4.14",
    arch: "i386",
    sizeMb: 170,
    url: "https://sourceforge.net/projects/reactos/files/ReactOS/0.4.14/ReactOS-0.4.14-iso.zip",
    description: "Открытая ОС совместимая с Windows",
    emoji: "🖥️",
    tags: ["windows-compatible", "i386", "retro"],
  },
  {
    id: "freedos-122",
    name: "FreeDOS",
    version: "1.3",
    arch: "i386",
    sizeMb: 72,
    url: "https://www.freedos.org/download/download/FD13-LiveCD.zip",
    description: "Свободная версия MS-DOS",
    emoji: "💾",
    tags: ["dos", "retro", "i386"],
  },
  {
    id: "ubuntu-2204-arm",
    name: "Ubuntu Server",
    version: "22.04 ARM64",
    arch: "arm64",
    sizeMb: 1100,
    url: "https://cdimage.ubuntu.com/releases/22.04/release/ubuntu-22.04.3-live-server-arm64.iso",
    description: "Ubuntu Server для ARM64",
    emoji: "🟠",
    tags: ["linux", "ubuntu", "arm64", "server"],
  },
];
