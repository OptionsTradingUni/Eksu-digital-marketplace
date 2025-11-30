import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { vtuNetworkEnum, vtuPlans } from './plans.schema';

export const scheduledVtuFrequencyEnum = pgEnum("scheduled_vtu_frequency", ["once", "daily", "weekly", "monthly"]);
export const scheduledPurchaseFrequencyEnum = pgEnum("scheduled_purchase_frequency", ["daily", "weekly", "monthly"]);
export const scheduledPurchaseStatusEnum = pgEnum("scheduled_purchase_status", ["active", "paused", "cancelled"]);
export const vtuServiceTypeEnum = pgEnum("vtu_service_type", ["data", "airtime"]);

export const scheduledVtuPurchases = pgTable("scheduled_vtu_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceType: vtuServiceTypeEnum("service_type").notNull(),
  planId: varchar("plan_id").references(() => vtuPlans.id, { onDelete: "set null" }),
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: scheduledPurchaseFrequencyEnum("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  timeOfDay: varchar("time_of_day", { length: 10 }),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").default(0),
  status: scheduledPurchaseStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("idx_scheduled_vtu_user").on(table.userId),
  index("idx_scheduled_vtu_next_run").on(table.nextRunAt),
]);

export const insertScheduledVtuPurchaseSchema = createInsertSchema(scheduledVtuPurchases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  runCount: true,
});

export const createScheduledVtuSchema = z.object({
  network: z.enum(["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]),
  phoneNumber: z.string().min(11, "Phone number must be at least 11 digits"),
  planId: z.string().optional(),
  serviceType: z.enum(["airtime", "data"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().optional(),
});

export const createScheduledPurchaseApiSchema = z.object({
  serviceType: z.enum(["data", "airtime"]),
  planId: z.string().optional(),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
  phoneNumber: z.string().min(10).max(15),
  amount: z.number().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  startDate: z.string(),
  endDate: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().optional(),
});

export type ScheduledVtuPurchase = typeof scheduledVtuPurchases.$inferSelect;
export type InsertScheduledVtuPurchase = z.infer<typeof insertScheduledVtuPurchaseSchema>;
export type CreateScheduledPurchaseInput = z.infer<typeof createScheduledPurchaseApiSchema>;
