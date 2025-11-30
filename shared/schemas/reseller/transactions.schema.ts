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
import { resellerSites } from './sites.schema';
import { resellerCustomers } from './customers.schema';
import { vtuNetworkEnum } from '../vtu/plans.schema';

export const resellerTransactionStatusEnum = pgEnum("reseller_transaction_status", ["pending", "completed", "failed", "refunded"]);

export const resellerTransactions = pgTable("reseller_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellerSites.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => resellerCustomers.id, { onDelete: "set null" }),
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  costAmount: decimal("cost_amount", { precision: 10, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 10, scale: 2 }).notNull(),
  status: resellerTransactionStatusEnum("status").default("pending"),
  transactionRef: varchar("transaction_ref").unique(),
  apiResponse: jsonb("api_response"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_reseller_transactions_reseller").on(table.resellerId),
  index("idx_reseller_transactions_status").on(table.status),
]);

export const insertResellerTransactionSchema = createInsertSchema(resellerTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  apiResponse: true,
});

export type ResellerTransaction = typeof resellerTransactions.$inferSelect;
export type InsertResellerTransaction = z.infer<typeof insertResellerTransactionSchema>;
