import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { disksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CreateDiskBody, DeleteDiskParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const disks = await db.select().from(disksTable).orderBy(disksTable.createdAt);
    res.json(disks.map(formatDisk));
  } catch (err) {
    res.status(500).json({ error: "Failed to list disks" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateDiskBody.parse(req.body);
    const path = `/storage/emulated/0/MyVMs/${body.name}.${body.format}`;
    const [disk] = await db
      .insert(disksTable)
      .values({
        name: body.name,
        sizeMb: body.sizeMb,
        format: body.format,
        path,
      })
      .returning();
    res.status(201).json(formatDisk(disk));
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteDiskParams.parse({ id: Number(req.params.id) });
    await db.delete(disksTable).where(eq(disksTable.id, id));
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function formatDisk(disk: typeof disksTable.$inferSelect) {
  return {
    id: disk.id,
    name: disk.name,
    sizeMb: disk.sizeMb,
    format: disk.format,
    path: disk.path,
    createdAt: disk.createdAt.toISOString(),
  };
}

export default router;
