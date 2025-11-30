import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
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

export const squadPaymentStatusEnum = pgEnum("squad_payment_status", ["pending", "successful", "failed", "cancelled"]);
export const squadPaymentPurposeEnum = pgEnum("squad_payment_purpose", [
  "wallet_deposit", "boost_payment", "featured_payment", "escrow_payment", "checkout_payment"
]);

export const squadPayments = pgTable("squad_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionRef: varchar("transaction_ref").unique().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purpose: squadPaymentPurposeEnum("purpose").notNull(),
  status: squadPaymentStatusEnum("status").default("pending"),
  paymentChannel: varchar("payment_channel", { length: 50 }),
  paymentDescription: text("payment_description"),
  checkoutUrl: text("checkout_url"),
  squadResponse: jsonb("squad_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_squad_payments_user").on(table.userId),
  index("idx_squad_payments_ref").on(table.transactionRef),
  index("idx_squad_payments_status").on(table.status),
]);

export const squadTransfers = pgTable("squad_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionRef: varchar("transaction_ref").unique().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }).notNull(),
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  narration: text("narration"),
  status: varchar("status", { length: 20 }).default("pending"),
  squadResponse: jsonb("squad_response"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_squad_transfers_user").on(table.userId),
  index("idx_squad_transfers_ref").on(table.transactionRef),
]);

export const insertSquadPaymentSchema = createInsertSchema(squadPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSquadTransferSchema = createInsertSchema(squadTransfers).omit({
  id: true,
  createdAt: true,
});

export const initiateSquadPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  purpose: z.enum(["wallet_deposit", "boost_payment", "featured_payment", "escrow_payment", "checkout_payment"]),
  paymentDescription: z.string().max(200).optional(),
  paymentChannel: z.enum(["transfer", "card", "ussd"]).optional(),
});

export type SquadPayment = typeof squadPayments.$inferSelect;
export type InsertSquadPayment = z.infer<typeof insertSquadPaymentSchema>;
export type SquadTransfer = typeof squadTransfers.$inferSelect;
export type InsertSquadTransfer = z.infer<typeof insertSquadTransferSchema>;
