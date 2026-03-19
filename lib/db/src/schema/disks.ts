import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const disksTable = pgTable("virtual_disks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sizeMb: integer("size_mb").notNull(),
  format: text("format").notNull().default("qcow2"),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDiskSchema = createInsertSchema(disksTable).omit({ id: true, createdAt: true, path: true });
export type InsertDisk = z.infer<typeof insertDiskSchema>;
export type Disk = typeof disksTable.$inferSelect;
