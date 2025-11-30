import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { vtuNetworkEnum, vtuPlans } from './plans.schema';

export const vtuStatusEnum = pgEnum("vtu_status", ["pending", "processing", "completed", "failed", "refunded"]);

export const vtuTransactions = pgTable("vtu_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  planId: varchar("plan_id").references(() => vtuPlans.id, { onDelete: "set null" }),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  costAmount: decimal("cost_amount", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  status: vtuStatusEnum("status").default("pending"),
  transactionRef: varchar("transaction_ref").unique(),
  apiResponse: jsonb("api_response"),
  errorMessage: varchar("error_message"),
  retryCount: varchar("retry_count").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_vtu_transactions_user").on(table.userId),
  index("idx_vtu_transactions_status").on(table.status),
  index("idx_vtu_transactions_ref").on(table.transactionRef),
]);

export const insertVtuTransactionSchema = createInsertSchema(vtuTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  apiResponse: true,
});

export const purchaseVtuSchema = z.object({
  network: z.enum(["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]),
  phoneNumber: z.string().min(11, "Phone number must be at least 11 digits"),
  planId: z.string().optional(),
  planType: z.enum(["airtime", "data", "cable", "electricity"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
});

export const purchaseAirtimeSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required").max(15),
  amount: z.number().min(50, "Minimum airtime is 50 Naira").max(50000, "Maximum airtime is 50,000 Naira"),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
});

export type VtuTransaction = typeof vtuTransactions.$inferSelect;
export type InsertVtuTransaction = z.infer<typeof insertVtuTransactionSchema>;
export type PurchaseAirtimeInput = z.infer<typeof purchaseAirtimeSchema>;
