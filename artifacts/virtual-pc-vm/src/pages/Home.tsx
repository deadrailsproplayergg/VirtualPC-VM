import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, HardDrive, Cpu, Download, Sun, Moon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VMCard } from "@/components/VMCard";
import { VMFormModal } from "@/components/VMFormModal";
import { DiskFormModal } from "@/components/DiskFormModal";
import { VMLaunchConsole } from "@/components/VMLaunchConsole";
import { ImageDownloadModal } from "@/components/ImageDownloadModal";
import { useListVMs } from "@/hooks/use-api-hooks";
import { useTheme } from "@/hooks/use-theme";
import type { Vm } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type QemuState = { installed: boolean; version: string | null; source: string | null } | null;

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: vms, isLoading } = useListVMs();
  const { theme, toggle } = useTheme();

  const [isVMModalOpen, setIsVMModalOpen] = useState(false);
  const [editingVM, setEditingVM] = useState<Vm | null>(null);
  const [isDiskModalOpen, setIsDiskModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeConsoleVM, setActiveConsoleVM] = useState<Vm | null>(null);
  const [qemuStatus, setQemuStatus] = useState<QemuState>(null);

  useEffect(() => {
    if (!localStorage.getItem("qemu_installed")) setLocation("/install");
  }, [setLocation]);

  /* poll QEMU status from backend */
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/qemu/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setQemuStatus(data);
      } catch { /* ignore */ }
    };
    check();
    return () => { mounted = false; };
  }, []);

  const openCreateVM = () => { setEditingVM(null); setIsVMModalOpen(true); };
  const openEditVM = (vm: Vm) => { setEditingVM(vm); setIsVMModalOpen(true); };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* TopBar */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="h-8 w-8 rounded-lg" />
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
              Virtual PC <span className="text-primary">VM</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* QEMU status badge */}
            {qemuStatus === null ? (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> QEMU...
              </span>
            ) : qemuStatus.installed ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-400" title={`Источник: ${qemuStatus.source}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                QEMU {qemuStatus.version ?? "OK"}
              </span>
            ) : (
              <button
                onClick={() => setLocation("/install")}
                className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-xs text-yellow-400 hover:bg-yellow-500/25 transition-colors"
                title="Нажмите чтобы установить QEMU"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                QEMU не установлен
              </button>
            )}

            <Button variant="ghost" size="icon" onClick={toggle} title="Переключить тему">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold font-display">Мои машины</h2>
            <p className="mt-1 text-muted-foreground">Управление виртуальными машинами и дисками</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="hidden sm:flex" onClick={() => setIsImageModalOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Образы
            </Button>
            <Button variant="outline" className="hidden sm:flex" onClick={() => setIsDiskModalOpen(true)}>
              <HardDrive className="mr-2 h-4 w-4" />
              Создать Диск
            </Button>
            <Button className="hidden sm:flex" onClick={openCreateVM}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить ВМ
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : vms && vms.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {vms.map(vm => (
              <VMCard key={vm.id} vm={vm} onEdit={openEditVM} onLaunch={setActiveConsoleVM} />
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <Cpu className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-foreground">Нет виртуальных машин</h3>
            <p className="mt-2 max-w-sm text-muted-foreground">Создайте свою первую виртуальную машину для начала работы.</p>
            <div className="mt-8 flex gap-3">
              <Button variant="outline" onClick={() => setIsImageModalOpen(true)}>
                <Download className="mr-2 h-4 w-4" /> Скачать образ
              </Button>
              <Button onClick={openCreateVM}>Создать ВМ</Button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile FABs */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 sm:hidden">
        <Button variant="secondary" size="icon" onClick={() => setIsImageModalOpen(true)} className="h-12 w-12 rounded-full shadow-lg border border-border/50">
          <Download className="h-5 w-5" />
        </Button>
        <Button variant="secondary" size="icon" onClick={() => setIsDiskModalOpen(true)} className="h-12 w-12 rounded-full shadow-lg border border-border/50">
          <HardDrive className="h-5 w-5" />
        </Button>
        <Button size="icon" onClick={openCreateVM} className="h-14 w-14 rounded-full shadow-lg shadow-primary/30">
          <Plus className="h-7 w-7" />
        </Button>
      </div>

      {/* Modals */}
      <VMFormModal open={isVMModalOpen} onOpenChange={setIsVMModalOpen} vm={editingVM} />
      <DiskFormModal open={isDiskModalOpen} onOpenChange={setIsDiskModalOpen} />
      <ImageDownloadModal open={isImageModalOpen} onOpenChange={setIsImageModalOpen} />
      <VMLaunchConsole vm={activeConsoleVM} onClose={() => setActiveConsoleVM(null)} />
    </div>
  );
}
