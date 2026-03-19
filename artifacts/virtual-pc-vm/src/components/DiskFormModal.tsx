import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateDisk } from "@/hooks/use-api-hooks";
import { useToast } from "@/hooks/use-toast";
import type { CreateDiskRequest } from "@workspace/api-client-react";
import { formatBytes } from "@/lib/utils";

interface DiskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiskFormModal({ open, onOpenChange }: DiskFormModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateDisk();

  const [formData, setFormData] = useState<Partial<CreateDiskRequest>>({
    name: "",
    sizeMb: 10240, // 10GB default
    format: "qcow2",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      sizeMb: Number(formData.sizeMb),
    } as CreateDiskRequest;

    createMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Успех", description: "Виртуальный диск создан" });
          setFormData({ name: "", sizeMb: 10240, format: "qcow2" });
          onOpenChange(false);
        },
        onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
      }
    );
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange} 
      title="Создать виртуальный диск"
      description="Выберите размер и формат для нового диска."
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Имя диска</label>
            <Input 
              name="name" 
              value={formData.name || ""} 
              onChange={handleChange} 
              placeholder="disk01" 
              required 
            />
          </div>

          <div>
            <label className="mb-2 block flex items-center justify-between text-sm font-medium text-foreground">
              <span>Размер</span>
              <span className="text-primary font-bold">{formatBytes(Number(formData.sizeMb) * 1024 * 1024)}</span>
            </label>
            <input 
              type="range" 
              name="sizeMb" 
              min="1024" 
              max="512000" 
              step="1024" 
              value={formData.sizeMb} 
              onChange={handleChange} 
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>1 GB</span>
              <span>500 GB</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Формат</label>
            <select
              name="format"
              value={formData.format}
              onChange={handleChange}
              className="flex h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="qcow2">QCOW2 (Dynamic)</option>
              <option value="raw">RAW (Fixed)</option>
              <option value="vmdk">VMDK (VMware)</option>
              <option value="vdi">VDI (VirtualBox)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button type="submit" disabled={createMutation.isPending}>
            Создать Диск
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
