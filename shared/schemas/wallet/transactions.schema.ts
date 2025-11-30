import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { wallets } from './wallets.schema';

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit", "withdrawal", "sale", "purchase", "refund", "boost", "featured", 
  "referral_bonus", "welcome_bonus", "escrow_hold", "escrow_release", "escrow_refund",
  "vtu_purchase", "gift_sent", "gift_received", "reward_earned", "reward_redeemed",
  "transfer_out", "transfer_in"
]);

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: varchar("reference_id"),
  externalReference: varchar("external_reference"),
  status: varchar("status", { length: 20 }).default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_transactions_wallet").on(table.walletId),
  index("idx_transactions_type").on(table.type),
  index("idx_transactions_created_at").on(table.createdAt),
]);

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
