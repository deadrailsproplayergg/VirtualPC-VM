import { Router, type IRouter } from "express";
import { EventEmitter } from "events";
import {
  getQemuStatus,
  installQemu,
  type InstallEvent,
} from "../lib/qemu-installer.js";

const router: IRouter = Router();

/* GET /api/qemu/status — current install state */
router.get("/status", async (_req, res) => {
  try {
    const status = await getQemuStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Ошибка проверки QEMU" });
  }
});

/* GET /api/qemu/install — SSE stream of installation progress */
router.get("/install", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (e: InstallEvent) => {
    res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  };

  const emitter = new EventEmitter();
  emitter.on("event", send);

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    emitter.removeAllListeners();
  });

  installQemu(emitter);
});

export default router;
