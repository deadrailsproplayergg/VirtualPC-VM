import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface QEMUCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string;
  vmName: string;
  onConfirmLaunch?: () => void;
}

export function QEMUCommandModal({ open, onOpenChange, command, vmName, onConfirmLaunch }: QEMUCommandModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`QEMU команда — ${vmName}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Следующая команда будет выполнена при запуске виртуальной машины:
        </p>

        <div className="relative">
          <div className="flex items-center gap-2 rounded-t-xl bg-slate-800 px-4 py-2 border border-b-0 border-slate-700">
            <Terminal className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-mono">bash</span>
          </div>
          <pre className="overflow-x-auto rounded-b-xl bg-black border border-slate-700 p-4 text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
            {command}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-10 right-3 flex items-center gap-1.5 rounded-lg bg-slate-700/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>

        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-400">
          ⚠️ Это симуляция. В реальном окружении QEMU должен быть установлен через NDK или терминал Android.
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Закрыть</Button>
          {onConfirmLaunch && (
            <Button onClick={() => { onOpenChange(false); onConfirmLaunch(); }}>
              Запустить ВМ
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
