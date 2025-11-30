import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { resellerSites } from './sites.schema';

export const resellerWithdrawalStatusEnum = pgEnum("reseller_withdrawal_status", ["pending", "processing", "completed", "failed", "cancelled"]);

export const resellerWithdrawals = pgTable("reseller_withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellerSites.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  status: resellerWithdrawalStatusEnum("status").default("pending"),
  transferReference: varchar("transfer_reference"),
  failureReason: varchar("failure_reason"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reseller_withdrawals_reseller").on(table.resellerId),
  index("idx_reseller_withdrawals_status").on(table.status),
]);

export const insertResellerWithdrawalSchema = createInsertSchema(resellerWithdrawals).omit({
  id: true,
  createdAt: true,
  status: true,
  processedAt: true,
});

export const initiateResellerWithdrawalSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  bankCode: z.string().optional(),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(10, "Invalid account number"),
  accountName: z.string().min(1, "Account name is required"),
});

export const createResellerWithdrawalSchema = z.object({
  amount: z.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bankName: z.string().min(2, "Bank name is required").max(100),
  accountNumber: z.string().min(10, "Account number must be 10 digits").max(20),
  accountName: z.string().min(2, "Account name is required").max(100),
});

export const updateResellerWithdrawalSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "failed", "rejected"]),
  adminNote: z.string().max(500).optional(),
});

export type ResellerWithdrawal = typeof resellerWithdrawals.$inferSelect;
export type InsertResellerWithdrawal = z.infer<typeof insertResellerWithdrawalSchema>;
export type CreateResellerWithdrawalInput = z.infer<typeof createResellerWithdrawalSchema>;
export type UpdateResellerWithdrawalInput = z.infer<typeof updateResellerWithdrawalSchema>;
