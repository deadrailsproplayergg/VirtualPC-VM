import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateVM, useUpdateVM, useListDisks } from "@/hooks/use-api-hooks";
import { useToast } from "@/hooks/use-toast";
import { getDeviceInfo, getOptimalVMSettings } from "@/hooks/use-device-info";
import { VM_PRESETS } from "@/lib/presets";
import { checkArchMachineCompat, getCompatibleMachines, generateQEMUCommand } from "@/lib/qemu-command";
import { QEMUCommandModal } from "@/components/QEMUCommandModal";
import type { Vm, CreateVMRequest } from "@workspace/api-client-react";
import { AlertTriangle, Sparkles, Terminal } from "lucide-react";

interface VMFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vm?: Vm | null;
}

const DEFAULT_FORM: Partial<CreateVMRequest> = {
  name: "",
  ramMb: 1024,
  cpuCores: 2,
  architecture: "x86_64",
  machineType: "q35",
  firmware: "bios",
  enableMtcg: true,
  enableKvm: true,
  disableTsc: false,
  isoPath: "",
  diskId: undefined,
};

export function VMFormModal({ open, onOpenChange, vm }: VMFormModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateVM();
  const updateMutation = useUpdateVM();
  const { data: disks } = useListDisks();
  const isEdit = !!vm;

  const [formData, setFormData] = useState<Partial<CreateVMRequest>>(DEFAULT_FORM);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showCmd, setShowCmd] = useState(false);

  const device = getDeviceInfo();
  const optimal = getOptimalVMSettings(device);

  useEffect(() => {
    if (open) {
      setFormData(vm
        ? {
            name: vm.name, ramMb: vm.ramMb, cpuCores: vm.cpuCores,
            architecture: vm.architecture, machineType: vm.machineType,
            firmware: vm.firmware, enableMtcg: vm.enableMtcg,
            enableKvm: vm.enableKvm, disableTsc: vm.disableTsc,
            isoPath: vm.isoPath || "", diskId: vm.diskId || undefined,
          }
        : DEFAULT_FORM
      );
      setWarnings([]);
    }
  }, [vm, open]);

  /* Validate on every change */
  useEffect(() => {
    const w: string[] = [];
    const arch = formData.architecture ?? "x86_64";
    const machine = formData.machineType ?? "q35";
    const ram = Number(formData.ramMb ?? 1024);
    const cores = Number(formData.cpuCores ?? 2);

    const compatError = checkArchMachineCompat(arch, machine);
    if (compatError) w.push(compatError);

    if (ram > optimal.warningThresholds.ramMb) {
      w.push(`RAM ${ram} MB превышает 75% ОЗУ устройства (${optimal.hostRamMb} MB). Это может привести к зависаниям.`);
    }
    if (cores > optimal.warningThresholds.cpuCores) {
      w.push(`${cores} ядер ЦП превышает 75% ядер устройства (${optimal.hostCores}). Производительность может снизиться.`);
    }
    if (formData.isoPath && !formData.isoPath.startsWith("/")) {
      w.push("Путь к ISO должен начинаться с «/» (например: /storage/emulated/0/MyVMs/image.iso)");
    }

    setWarnings(w);
  }, [formData, optimal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === "architecture") {
      const compatible = getCompatibleMachines(value);
      setFormData(prev => ({
        ...prev,
        architecture: value,
        machineType: compatible.includes(prev.machineType ?? "") ? prev.machineType : compatible[0],
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = VM_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setFormData(prev => ({ ...prev, ...preset.config }));
    toast({ title: `Пресет применён: ${preset.label}`, description: preset.description });
  };

  const applyOptimal = () => {
    setFormData(prev => ({
      ...prev,
      ramMb: optimal.recommendedRamMb,
      cpuCores: optimal.recommendedCores,
    }));
    toast({
      title: "Оптимальные настройки применены",
      description: `RAM: ${optimal.recommendedRamMb} MB · ЦП: ${optimal.recommendedCores} ядер`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasBlocker = warnings.some(w => w.includes("не совместима"));
    if (hasBlocker) {
      toast({ title: "Ошибка совместимости", description: warnings[0], variant: "destructive" });
      return;
    }

    const payload = {
      ...formData,
      ramMb: Number(formData.ramMb),
      cpuCores: Number(formData.cpuCores),
      diskId: formData.diskId ? Number(formData.diskId) : undefined,
      isoPath: formData.isoPath || null,
    } as CreateVMRequest;

    const mutate = isEdit && vm
      ? (cb: any) => updateMutation.mutate({ id: vm.id, data: payload }, cb)
      : (cb: any) => createMutation.mutate({ data: payload }, cb);

    mutate({
      onSuccess: () => {
        toast({ title: "Успех", description: isEdit ? "Настройки ВМ обновлены" : "ВМ успешно создана" });
        onOpenChange(false);
      },
      onError: (err: any) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
    });
  };

  const arch = formData.architecture ?? "x86_64";
  const compatMachines = getCompatibleMachines(arch);
  const qemuCmd = generateQEMUCommand(formData);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? "Настройки ВМ" : "Создать виртуальную машину"}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Presets ── */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Пресеты</p>
            <div className="flex flex-wrap gap-2">
              {VM_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
                >
                  <span>{p.emoji}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Name ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Имя ВМ</label>
            <Input name="name" value={formData.name || ""} onChange={handleChange} placeholder="My Virtual Machine" required />
          </div>

          {/* ── Arch + Machine ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Архитектура</label>
              <select name="architecture" value={formData.architecture} onChange={handleChange} className="field-select">
                {["arm","arm64","x86","x86_64","i386","powerpc"].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Тип машины</label>
              <select name="machineType" value={formData.machineType} onChange={handleChange} className="field-select">
                {compatMachines.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── RAM ── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">RAM</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">{formData.ramMb} MB</span>
                <button
                  type="button"
                  onClick={applyOptimal}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Авто ({optimal.recommendedRamMb} MB)
                </button>
              </div>
            </div>
            <input type="range" name="ramMb" min="64" max="16384" step="256" value={formData.ramMb} onChange={handleChange} className="w-full accent-primary" />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>64 MB</span><span>16 GB</span></div>
          </div>

          {/* ── CPU ── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">CPU Cores</label>
              <span className="text-sm font-bold text-primary">{formData.cpuCores} {Number(formData.cpuCores) > 1 ? "ядра" : "ядро"}</span>
            </div>
            <input type="range" name="cpuCores" min="1" max="16" step="1" value={formData.cpuCores} onChange={handleChange} className="w-full accent-primary" />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>1</span><span>16</span></div>
          </div>

          {/* ── Firmware ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Firmware</label>
            <div className="flex gap-4">
              {["bios","uefi"].map(fw => (
                <label key={fw} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="firmware" value={fw} checked={formData.firmware === fw} onChange={handleChange} className="accent-primary h-4 w-4" />
                  <span className="text-sm uppercase">{fw}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Flags ── */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-secondary/20 border border-border/50 p-4">
            {[
              { name: "enableMtcg", label: "MTCG" },
              { name: "enableKvm",  label: "KVM"  },
              { name: "disableTsc", label: "No TSC" },
            ].map(flag => (
              <label key={flag.name} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name={flag.name}
                  checked={!!(formData as any)[flag.name]}
                  onChange={handleChange}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-xs font-medium">{flag.label}</span>
              </label>
            ))}
          </div>

          {/* ── ISO ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">ISO образ (необязательно)</label>
            <Input name="isoPath" value={formData.isoPath || ""} onChange={handleChange} placeholder="/storage/emulated/0/MyVMs/ubuntu.iso" />
          </div>

          {/* ── Disk ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Виртуальный диск (необязательно)</label>
            <select name="diskId" value={formData.diskId || ""} onChange={handleChange} className="field-select">
              <option value="">-- Без диска --</option>
              {disks?.map(disk => (
                <option key={disk.id} value={disk.id}>{disk.name} ({disk.sizeMb} MB · {disk.format})</option>
              ))}
            </select>
          </div>

          {/* ── Warnings ── */}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowCmd(true)}
            >
              <Terminal className="h-4 w-4" />
              QEMU команда
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || warnings.some(w => w.includes("не совместима"))}
              >
                {isEdit ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <QEMUCommandModal
        open={showCmd}
        onOpenChange={setShowCmd}
        command={qemuCmd}
        vmName={formData.name || "VM"}
      />
    </>
  );
}
