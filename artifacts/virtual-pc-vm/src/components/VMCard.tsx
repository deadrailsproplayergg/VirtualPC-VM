import { Play, Square, Settings, Trash2, Cpu, HardDrive, Cpu as CpuIcon, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Vm } from "@workspace/api-client-react";
import { useStartVM, useStopVM, useDeleteVM } from "@/hooks/use-api-hooks";
import { useToast } from "@/hooks/use-toast";

interface VMCardProps {
  vm: Vm;
  onEdit: (vm: Vm) => void;
  onLaunch: (vm: Vm) => void;
}

export function VMCard({ vm, onEdit, onLaunch }: VMCardProps) {
  const { toast } = useToast();
  const startMutation = useStartVM();
  const stopMutation = useStopVM();
  const deleteMutation = useDeleteVM();

  const isRunning = vm.status === "running";
  const isStarting = vm.status === "starting";

  const handleToggle = () => {
    if (isRunning) {
      stopMutation.mutate(
        { id: vm.id },
        {
          onSuccess: () => toast({ title: "VM Остановлена", description: `${vm.name} была остановлена.` }),
          onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
        }
      );
    } else {
      startMutation.mutate(
        { id: vm.id },
        {
          onSuccess: () => {
            toast({ title: "Запуск VM", description: `Запуск ${vm.name}...` });
            onLaunch(vm);
          },
          onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
        }
      );
    }
  };

  const handleDelete = () => {
    if (confirm(`Вы уверены, что хотите удалить ${vm.name}?`)) {
      deleteMutation.mutate(
        { id: vm.id },
        {
          onSuccess: () => toast({ title: "Успех", description: "ВМ удалена" }),
          onError: (err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" })
        }
      );
    }
  };

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-primary/10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MonitorPlay className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">{vm.name}</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="secondary" className="uppercase tracking-wider">{vm.architecture}</Badge>
                {isRunning ? (
                  <Badge variant="success">Запущена</Badge>
                ) : isStarting ? (
                  <Badge variant="warning">Запускается</Badge>
                ) : (
                  <Badge variant="outline">Остановлена</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-secondary/30 p-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Cpu className="h-5 w-5 text-primary/70" />
            <div>
              <p className="font-medium text-foreground">{vm.cpuCores} Core{vm.cpuCores > 1 ? 's' : ''}</p>
              <p className="text-xs">{vm.machineType}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <HardDrive className="h-5 w-5 text-primary/70" />
            <div>
              <p className="font-medium text-foreground">{vm.ramMb} MB</p>
              <p className="text-xs">{vm.firmware.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between border-t border-border/50 pt-5">
        <Button 
          variant={isRunning ? "destructive" : "default"} 
          className="gap-2"
          onClick={handleToggle}
          disabled={startMutation.isPending || stopMutation.isPending}
        >
          {isRunning ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          {isRunning ? "Остановить" : "Запустить"}
        </Button>
        
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={() => onEdit(vm)} disabled={isRunning}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={handleDelete} disabled={isRunning} className="hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
