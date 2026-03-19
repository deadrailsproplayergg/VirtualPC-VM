import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle2, AlertCircle, FolderOpen } from "lucide-react";
import { IMAGE_CATALOG, type ImageEntry } from "@/lib/image-catalog";
import { useToast } from "@/hooks/use-toast";

interface ImageDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DownloadState {
  progress: number;
  done: boolean;
  error: boolean;
}

export function ImageDownloadModal({ open, onOpenChange }: ImageDownloadModalProps) {
  const { toast } = useToast();
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [filter, setFilter] = useState<string>("all");

  const tags = ["all", "linux", "android", "retro", "arm64"];

  const filtered = filter === "all"
    ? IMAGE_CATALOG
    : IMAGE_CATALOG.filter(img => img.tags.includes(filter));

  const startDownload = (img: ImageEntry) => {
    if (downloads[img.id]?.done) {
      toast({ title: "Уже загружен", description: `${img.name} уже находится в /MyVMs/` });
      return;
    }

    setDownloads(prev => ({ ...prev, [img.id]: { progress: 0, done: false, error: false } }));

    const interval = setInterval(() => {
      setDownloads(prev => {
        const cur = prev[img.id];
        if (!cur) return prev;
        const next = cur.progress + Math.random() * 8 + 2;
        if (next >= 100) {
          clearInterval(interval);
          toast({
            title: "Загрузка завершена",
            description: `${img.name} сохранён в /storage/emulated/0/MyVMs/${img.id}.iso`,
          });
          return { ...prev, [img.id]: { progress: 100, done: true, error: false } };
        }
        return { ...prev, [img.id]: { ...cur, progress: next } };
      });
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Загрузить образ">
      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                filter === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag === "all" ? "Все" : tag}
            </button>
          ))}
        </div>

        {/* Path info */}
        <div className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>Сохранение в: /storage/emulated/0/MyVMs/</span>
        </div>

        {/* Image list */}
        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {filtered.map(img => {
            const dl = downloads[img.id];
            return (
              <div
                key={img.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4"
              >
                <span className="text-2xl shrink-0">{img.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{img.name}</span>
                    <span className="text-xs text-muted-foreground">{img.version}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">{img.arch}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{img.description}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{(img.sizeMb / 1024).toFixed(1)} GB</p>

                  {/* Progress */}
                  {dl && !dl.done && !dl.error && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-200"
                          style={{ width: `${dl.progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Загрузка… {dl.progress.toFixed(0)}% · {((img.sizeMb * dl.progress / 100) / 1024).toFixed(2)} GB / {(img.sizeMb / 1024).toFixed(1)} GB
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {dl?.done ? (
                    <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="hidden sm:inline">Готово</span>
                    </div>
                  ) : dl?.error ? (
                    <div className="flex items-center gap-1.5 text-destructive text-xs">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startDownload(img)}
                      disabled={!!dl}
                      className="gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {dl ? `${dl.progress.toFixed(0)}%` : "Скачать"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
