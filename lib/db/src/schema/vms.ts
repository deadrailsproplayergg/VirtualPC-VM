import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vmsTable = pgTable("vms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ramMb: integer("ram_mb").notNull().default(1024),
  cpuCores: integer("cpu_cores").notNull().default(1),
  architecture: text("architecture").notNull().default("x86_64"),
  machineType: text("machine_type").notNull().default("q35"),
  firmware: text("firmware").notNull().default("bios"),
  enableMtcg: boolean("enable_mtcg").notNull().default(false),
  enableKvm: boolean("enable_kvm").notNull().default(false),
  disableTsc: boolean("disable_tsc").notNull().default(false),
  isoPath: text("iso_path"),
  diskId: integer("disk_id"),
  status: text("status").notNull().default("stopped"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVmSchema = createInsertSchema(vmsTable).omit({ id: true, createdAt: true, status: true });
export type InsertVm = z.infer<typeof insertVmSchema>;
export type Vm = typeof vmsTable.$inferSelect;
