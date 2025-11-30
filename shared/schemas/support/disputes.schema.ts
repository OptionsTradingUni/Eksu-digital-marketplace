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
import { orders } from '../wallet/orders.schema';
import { escrowTransactions } from '../wallet/escrow.schema';

export const disputeStatusEnum = pgEnum("dispute_status", ["pending", "investigating", "resolved_buyer", "resolved_seller", "cancelled"]);
export const disputeReasonEnum = pgEnum("dispute_reason", ["item_not_received", "item_not_as_described", "damaged", "wrong_item", "other"]);

export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  escrowId: varchar("escrow_id").references(() => escrowTransactions.id, { onDelete: "set null" }),
  raisedBy: varchar("raised_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  againstUser: varchar("against_user").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: disputeReasonEnum("reason").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array().default(sql`ARRAY[]::text[]`),
  status: disputeStatusEnum("status").default("pending"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_disputes_order").on(table.orderId),
  index("idx_disputes_raised_by").on(table.raisedBy),
  index("idx_disputes_status").on(table.status),
]);

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  status: true,
  resolution: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const createDisputeSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.enum(["item_not_received", "item_not_as_described", "damaged", "wrong_item", "other"]),
  description: z.string().min(20, "Please provide a detailed description"),
  evidence: z.array(z.string()).optional(),
});

export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
