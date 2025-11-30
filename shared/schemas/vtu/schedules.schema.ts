import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  boolean,
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
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  planId: varchar("plan_id").references(() => vtuPlans.id, { onDelete: "set null" }),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: scheduledVtuFrequencyEnum("frequency").default("once"),
  scheduledTime: timestamp("scheduled_time").notNull(),
  nextRun: timestamp("next_run"),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  runCount: varchar("run_count").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_vtu_user").on(table.userId),
  index("idx_scheduled_vtu_next_run").on(table.nextRun),
]);

export const insertScheduledVtuPurchaseSchema = createInsertSchema(scheduledVtuPurchases).omit({
  id: true,
  createdAt: true,
  lastRunAt: true,
  runCount: true,
});

export const createScheduledVtuSchema = z.object({
  network: z.enum(["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]),
  phoneNumber: z.string().min(11, "Phone number must be at least 11 digits"),
  planId: z.string().optional(),
  planType: z.enum(["airtime", "data"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  frequency: z.enum(["once", "daily", "weekly", "monthly"]).optional().default("once"),
  scheduledTime: z.string().or(z.date()),
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
});

export type ScheduledVtuPurchase = typeof scheduledVtuPurchases.$inferSelect;
export type InsertScheduledVtuPurchase = z.infer<typeof insertScheduledVtuPurchaseSchema>;
export type CreateScheduledPurchaseInput = z.infer<typeof createScheduledPurchaseApiSchema>;
