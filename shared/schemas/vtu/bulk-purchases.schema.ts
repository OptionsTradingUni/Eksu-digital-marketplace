import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { vtuNetworkEnum } from './plans.schema';

export const bulkPurchaseStatusEnum = pgEnum("bulk_purchase_status", ["pending", "processing", "completed", "partial", "failed"]);

export const bulkPurchases = pgTable("bulk_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  network: vtuNetworkEnum("network").notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  totalRecipients: integer("total_recipients").notNull(),
  successfulCount: integer("successful_count").default(0),
  failedCount: integer("failed_count").default(0),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  amountPerRecipient: decimal("amount_per_recipient", { precision: 10, scale: 2 }).notNull(),
  status: bulkPurchaseStatusEnum("status").default("pending"),
  recipients: jsonb("recipients").notNull(),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_bulk_purchases_user").on(table.userId),
  index("idx_bulk_purchases_status").on(table.status),
]);

export const insertBulkPurchaseSchema = createInsertSchema(bulkPurchases).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  successfulCount: true,
  failedCount: true,
  results: true,
});

export const createBulkPurchaseSchema = z.object({
  network: z.enum(["mtn", "airtel", "glo", "9mobile"]),
  planType: z.enum(["airtime", "data"]),
  amountPerRecipient: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  recipients: z.array(z.object({
    phoneNumber: z.string().min(11),
    name: z.string().optional(),
  })).min(2, "At least 2 recipients required").max(100, "Maximum 100 recipients allowed"),
});

export type BulkPurchase = typeof bulkPurchases.$inferSelect;
export type InsertBulkPurchase = z.infer<typeof insertBulkPurchaseSchema>;
