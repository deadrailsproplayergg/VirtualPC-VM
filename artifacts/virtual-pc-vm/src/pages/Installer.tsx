import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cpu, Terminal, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type LogLine = { text: string; level: "info" | "warn" | "ok" | "error" };

type Phase =
  | "idle"
  | "installing"
  | "done"
  | "error";

export default function Installer() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("Ожидание запуска...");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [version, setVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startInstall = () => {
    setPhase("installing");
    setLogs([]);
    setProgress(0);
    setStep("Подключение к серверу...");

    const es = new EventSource(`${API_BASE}/api/qemu/install`);
    esRef.current = es;

    es.addEventListener("step", (e) => {
      const d = JSON.parse(e.data);
      setStep(d.message);
    });

    es.addEventListener("progress", (e) => {
      const d = JSON.parse(e.data);
      setProgress(d.percent);
    });

    es.addEventListener("log", (e) => {
      const d = JSON.parse(e.data);
      setLogs((prev) => [...prev, { text: d.line, level: d.level ?? "info" }]);
    });

    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data);
      setVersion(d.version ?? "");
      setProgress(100);
      setStep("Установка завершена!");
      setPhase("done");
      es.close();
    });

    es.addEventListener("error", (e: any) => {
      const msg = e.data ? JSON.parse(e.data)?.message : "Ошибка соединения";
      setErrorMsg(msg ?? "Неизвестная ошибка");
      setPhase("error");
      es.close();
    });

    es.onerror = () => {
      if (phase !== "done") {
        setErrorMsg("Соединение с сервером прервано");
        setPhase("error");
        es.close();
      }
    };
  };

  const handleFinish = () => {
    localStorage.setItem("qemu_installed", "true");
    setLocation("/");
  };

  const lineColor: Record<LogLine["level"], string> = {
    info:  "text-muted-foreground",
    warn:  "text-yellow-400",
    ok:    "text-green-400",
    error: "text-red-400",
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background"
      style={{
        backgroundImage: `url('${import.meta.env.BASE_URL}images/tech-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-border/50 bg-card/90 p-8 shadow-2xl backdrop-blur-md"
      >
        {/* icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
            <Cpu className="h-10 w-10 text-primary" />
            {phase === "installing" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary"
              />
            )}
            {phase === "done" && (
              <CheckCircle2 className="absolute -bottom-2 -right-2 h-7 w-7 text-green-400 drop-shadow" />
            )}
            {phase === "error" && (
              <XCircle className="absolute -bottom-2 -right-2 h-7 w-7 text-red-400 drop-shadow" />
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── idle ── */}
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 text-center">
              <h1 className="font-display text-2xl font-bold">Установка QEMU</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Приложение загрузит и установит QEMU через Nix (или скачает статический бинарник с GitHub).
                Это может занять несколько минут.
              </p>
              <div className="rounded-xl bg-secondary/40 p-4 text-left text-xs font-mono text-muted-foreground space-y-1">
                <div className="flex gap-2"><span className="text-primary">1.</span> Проверка существующей установки</div>
                <div className="flex gap-2"><span className="text-primary">2.</span> Загрузка QEMU (Nix / GitHub)</div>
                <div className="flex gap-2"><span className="text-primary">3.</span> chmod +x для всех бинарников</div>
                <div className="flex gap-2"><span className="text-primary">4.</span> Проверка запуска (qemu --version)</div>
                <div className="flex gap-2"><span className="text-primary">5.</span> Регистрация в менеджере ВМ</div>
              </div>
              <Button size="lg" className="w-full" onClick={startInstall}>
                Начать установку
              </Button>
            </motion.div>
          )}

          {/* ── installing ── */}
          {phase === "installing" && (
            <motion.div key="installing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="text-center">
                <h1 className="font-display text-xl font-bold">Установка QEMU</h1>
                <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Terminal className="h-4 w-4 shrink-0" />
                  <span className="truncate">{step}</span>
                </p>
              </div>

              {/* progress bar */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary/50">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary shadow-[0_0_10px_rgba(99,102,241,0.6)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>
              <p className="text-center font-mono text-xs text-primary">{Math.round(progress)}%</p>

              {/* terminal log */}
              {logs.length > 0 && (
                <div className="h-48 overflow-y-auto rounded-xl bg-black/60 p-3 font-mono text-xs">
                  {logs.map((l, i) => (
                    <div key={i} className={lineColor[l.level]}>
                      {l.text}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </motion.div>
          )}

          {/* ── done ── */}
          {phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-center">
              <h1 className="font-display text-3xl font-bold text-green-400">Готово!</h1>
              {version && (
                <p className="rounded-lg bg-green-400/10 px-4 py-2 font-mono text-sm text-green-400">
                  QEMU {version}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Все бинарники успешно установлены, проверены и готовы к работе.
              </p>
              {/* show last few log lines */}
              {logs.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-xl bg-black/50 p-3 text-left font-mono text-xs">
                  {logs.slice(-8).map((l, i) => (
                    <div key={i} className={lineColor[l.level]}>{l.text}</div>
                  ))}
                </div>
              )}
              <Button size="lg" className="w-full text-base shadow-primary/20 shadow-xl" onClick={handleFinish}>
                Начать работу
              </Button>
            </motion.div>
          )}

          {/* ── error ── */}
          {phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-center">
              <h1 className="font-display text-2xl font-bold text-red-400">Ошибка установки</h1>
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 p-4 text-left text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-mono">{errorMsg}</p>
              </div>
              {logs.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-xl bg-black/50 p-3 text-left font-mono text-xs">
                  {logs.slice(-10).map((l, i) => (
                    <div key={i} className={lineColor[l.level]}>{l.text}</div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={startInstall}>
                  Повторить
                </Button>
                <Button className="flex-1" onClick={handleFinish}>
                  Пропустить
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
