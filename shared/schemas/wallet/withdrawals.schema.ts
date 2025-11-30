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
import { users } from '../auth/users.schema';

export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "processing", "completed", "failed", "cancelled"]);

export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  status: withdrawalStatusEnum("status").default("pending"),
  transferReference: varchar("transfer_reference"),
  failureReason: varchar("failure_reason"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_withdrawals_user").on(table.userId),
  index("idx_withdrawals_status").on(table.status),
]);

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
  status: true,
  processedAt: true,
});

export const initiateWithdrawalSchema = insertWithdrawalSchema.extend({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  bankCode: z.string().min(1, "Bank code is required").optional(),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(10, "Invalid account number"),
  accountName: z.string().min(1, "Account name is required"),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
