import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Terminal as TerminalIcon, Power, Trash2,
  ChevronsDown, Monitor, ScrollText, WifiOff,
  Keyboard, MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStopVM } from "@/hooks/use-api-hooks";
import { useToast } from "@/hooks/use-toast";
import { VNCTouchLayer } from "@/components/VNCTouchLayer";
import { VirtualKeyboard } from "@/components/VirtualKeyboard";
import { QEMUCommandModal } from "@/components/QEMUCommandModal";
import { generateQEMUCommand } from "@/lib/qemu-command";
import type { Vm } from "@workspace/api-client-react";

interface VMLaunchConsoleProps {
  vm: Vm | null;
  onClose: () => void;
}

interface LogEntry {
  ts: number;
  stream: "stdout" | "stderr";
  line: string;
}

const BOOT_LOGS = [
  "SeaBIOS (version 1.14.0-2)",
  "Machine UUID 4e5d6a7b-8c9d-0e1f-2a3b-4c5d6e7f8a9b",
  "Booting from Hard Disk...",
  "GRUB loading.",
  "Welcome to GRUB!",
  "Loading Linux 5.15.0-generic ...",
  "Loading initial ramdisk ...",
  "[    0.000000] Linux version 5.15.0 (root@build) (gcc 11.2.0) #1 SMP",
  "[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-5.15.0 ro quiet splash",
  "[    0.012345] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'",
  "[    0.145000] pci 0000:00:00.0: [8086:29c0] type 00 class 0x060000",
  "Starting kernel...",
  "INIT: version 2.90 booting",
  "Mounting local filesystems... done.",
  "Starting network... OK",
  "Starting sshd... OK",
  "Virtual PC Login: ",
];

type TabId = "vnc" | "logs";

/* ── SSE log hook ── */
function useVMLogStream(vmId: number | null, active: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const clearLocalLogs = useCallback(() => setLogs([]), []);

  useEffect(() => {
    if (!vmId || !active) {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
      return;
    }
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    const es = new EventSource(`${baseUrl}/api/vms/${vmId}/logs`);
    esRef.current = es;
    es.addEventListener("log", (e: MessageEvent) => {
      try { setLogs(prev => [...prev, JSON.parse(e.data)]); } catch {}
    });
    es.addEventListener("clear", () => setLogs([]));
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => { es.close(); esRef.current = null; setConnected(false); };
  }, [vmId, active]);

  return { logs, connected, clearLocalLogs };
}

/* ── Mouse cursor overlay for VNC ── */
function useFakeMouse() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [click, setClick] = useState<"left" | "right" | null>(null);

  const onMove = useCallback((x: number, y: number) => setPos({ x, y }), []);
  const onClick = useCallback((x: number, y: number, btn: "left" | "right") => {
    setPos({ x, y });
    setClick(btn);
    setTimeout(() => setClick(null), 300);
  }, []);

  return { pos, click, onMove, onClick };
}

export function VMLaunchConsole({ vm, onClose }: VMLaunchConsoleProps) {
  const { toast } = useToast();
  const stopMutation = useStopVM();

  const [activeTab, setActiveTab] = useState<TabId>("vnc");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showCmd, setShowCmd] = useState(false);

  /* VNC fake boot */
  const [vncLogs, setVncLogs] = useState<string[]>([]);
  const vncScrollRef = useRef<HTMLDivElement>(null);

  /* Fake mouse */
  const { pos: mousePos, click: mouseClick, onMove, onClick: onTouchClick } = useFakeMouse();

  /* QEMU log stream */
  const { logs: qemuLogs, connected, clearLocalLogs } = useVMLogStream(vm?.id ?? null, !!vm);

  /* Auto-scroll */
  const [autoScroll, setAutoScroll] = useState(true);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const logBottomRef = useRef<HTMLDivElement>(null);

  /* Boot animation */
  useEffect(() => {
    if (!vm) return;
    setVncLogs([]);
    let idx = 0;
    const push = () => {
      if (idx < BOOT_LOGS.length) {
        setVncLogs(prev => [...prev, BOOT_LOGS[idx]]);
        idx++;
        setTimeout(push, Math.random() * 260 + 60);
      }
    };
    const t = setTimeout(push, 700);
    return () => clearTimeout(t);
  }, [vm]);

  useEffect(() => {
    if (vncScrollRef.current) vncScrollRef.current.scrollTop = vncScrollRef.current.scrollHeight;
  }, [vncLogs]);

  useEffect(() => {
    if (autoScroll && logBottomRef.current) logBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [qemuLogs, autoScroll]);

  const handleLogScroll = () => {
    if (!logScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logScrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const handleClearLogs = async () => {
    if (!vm) return;
    clearLocalLogs();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/vms/${vm.id}/logs/clear`, { method: "POST" }).catch(() => {});
    toast({ title: "Логи очищены" });
  };

  const handleKeyPress = (key: string, _code: string) => {
    /* In a real QEMU VNC client this would send RFB key events */
    setVncLogs(prev => {
      const last = prev[prev.length - 1] ?? "";
      if (key === "↵") return [...prev.slice(0, -1), last, ""];
      if (key === "⌫") return [...prev.slice(0, -1), last.slice(0, -1)];
      if (key === "Space") return [...prev.slice(0, -1), last + " "];
      if (key.length === 1) return [...prev.slice(0, -1), last + key];
      return prev;
    });
  };

  const handleStop = () => {
    if (!vm) return;
    stopMutation.mutate({ id: vm.id }, {
      onSuccess: () => {
        toast({ title: "ВМ Остановлена", description: "Завершение сеанса..." });
        onClose();
      },
    });
  };

  if (!vm) return null;

  const qemuCmd = generateQEMUCommand({
    architecture: vm.architecture,
    machineType: vm.machineType,
    firmware: vm.firmware,
    ramMb: vm.ramMb,
    cpuCores: vm.cpuCores,
    enableMtcg: vm.enableMtcg,
    enableKvm: vm.enableKvm,
    disableTsc: vm.disableTsc,
    isoPath: vm.isoPath ?? undefined,
  });

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-md"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-border/50 bg-card/60 px-4 sm:px-6 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <TerminalIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-foreground truncate">{vm.name}</h2>
                <p className="text-xs text-muted-foreground">{vm.architecture} · {vm.machineType} · {vm.ramMb} MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex" onClick={() => setShowCmd(true)}>
                <TerminalIcon className="h-3.5 w-3.5" /> QEMU
              </Button>
              <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopMutation.isPending} className="gap-1.5">
                <Power className="h-4 w-4" />
                <span className="hidden sm:inline">Force Stop</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-border/40 bg-card/30 px-4 sm:px-6">
            <TabButton active={activeTab === "vnc"} onClick={() => setActiveTab("vnc")} icon={<Monitor className="h-4 w-4" />} label="VNC Консоль" />
            <TabButton active={activeTab === "logs"} onClick={() => setActiveTab("logs")} icon={<ScrollText className="h-4 w-4" />} label="Логи QEMU" badge={qemuLogs.length || undefined} />
          </div>

          {/* ── VNC Tab ── */}
          {activeTab === "vnc" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* VNC toolbar */}
              <div className="flex items-center gap-2 border-b border-border/30 bg-card/20 px-4 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MousePointer2 className="h-3.5 w-3.5" />
                  <span>Тап = клик · Долгий тап = ПКМ · Свайп = движение</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant={showKeyboard ? "default" : "outline"}
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setShowKeyboard(v => !v)}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Клавиатура</span>
                  </Button>
                </div>
              </div>

              {/* VNC screen */}
              <div className="flex-1 p-3 sm:p-5 overflow-hidden">
                <VNCTouchLayer
                  onMouseMove={onMove}
                  onMouseClick={onTouchClick}
                  className="h-full w-full"
                >
                  <div
                    ref={vncScrollRef}
                    className="relative h-full w-full overflow-y-auto rounded-xl border border-slate-800 bg-black p-5 font-mono text-sm text-green-400 shadow-2xl shadow-primary/10 leading-relaxed cursor-none"
                  >
                    {vncLogs.map((log, i) => <div key={i}>{log}</div>)}
                    {vncLogs.length > 0 && vncLogs.length < BOOT_LOGS.length && <span className="animate-pulse">█</span>}
                    {vncLogs.length === BOOT_LOGS.length && (
                      <div className="mt-0.5">root@virtualpc:~# <span className="animate-pulse">█</span></div>
                    )}

                    {/* Fake mouse cursor */}
                    {mousePos && (
                      <div
                        className="pointer-events-none absolute"
                        style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%`, transform: "translate(-4px,-4px)" }}
                      >
                        <div className={`h-3 w-3 rounded-full border-2 transition-all ${
                          mouseClick === "left" ? "bg-white border-white scale-90" :
                          mouseClick === "right" ? "bg-yellow-400 border-yellow-400 scale-90" :
                          "bg-transparent border-white"
                        }`} />
                      </div>
                    )}
                  </div>
                </VNCTouchLayer>
              </div>

              {/* Virtual keyboard */}
              <AnimatePresence>
                {showKeyboard && (
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 250 }}
                  >
                    <VirtualKeyboard onKey={handleKeyPress} onHide={() => setShowKeyboard(false)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Logs Tab ── */}
          {activeTab === "logs" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-card/20 px-4 sm:px-6 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  {connected ? "QEMU stdout/stderr" : "Нет соединения"}
                  <span className="ml-2 text-muted-foreground/60">{qemuLogs.length} строк</span>
                </div>
                <div className="flex items-center gap-2">
                  {!autoScroll && (
                    <Button variant="outline" size="sm" onClick={() => { logBottomRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); }} className="h-7 gap-1 text-xs">
                      <ChevronsDown className="h-3.5 w-3.5" /> В конец
                    </Button>
                  )}
                  <Button variant={autoScroll ? "secondary" : "outline"} size="sm" onClick={() => setAutoScroll(v => !v)} className="h-7 text-xs gap-1">
                    <ChevronsDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Автопрокрутка</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearLogs} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Очистить</span>
                  </Button>
                </div>
              </div>

              <div ref={logScrollRef} onScroll={handleLogScroll} className="flex-1 overflow-y-auto bg-black p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed">
                {qemuLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    <div className="text-center">
                      <WifiOff className="mx-auto mb-3 h-8 w-8 opacity-40" />
                      <p>Логи появятся при запуске ВМ</p>
                    </div>
                  </div>
                ) : qemuLogs.map((entry, i) => <LogLine key={i} entry={entry} />)}
                <div ref={logBottomRef} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <QEMUCommandModal open={showCmd} onOpenChange={setShowCmd} command={qemuCmd} vmName={vm.name} />
    </>
  );
}

/* ── Sub-components ── */

function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
      {badge !== undefined && (
        <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
          {badge > 999 ? "999+" : badge}
        </span>
      )}
    </button>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const isErr = entry.stream === "stderr";
  const time = new Date(entry.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className={`flex gap-3 mb-0.5 ${isErr ? "text-red-400" : "text-green-400"}`}>
      <span className="shrink-0 text-slate-600 select-none w-[7ch]">{time}</span>
      <span className={`shrink-0 select-none w-6 font-bold text-[10px] uppercase leading-5 ${isErr ? "text-red-600" : "text-slate-600"}`}>
        {isErr ? "ERR" : "OUT"}
      </span>
      <span className="break-all">{entry.line}</span>
    </div>
  );
}
