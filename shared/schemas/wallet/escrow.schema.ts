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
import { products } from '../products/products.schema';

export const escrowStatusEnum = pgEnum("escrow_status", ["pending", "held", "released", "refunded", "disputed"]);

export const escrowTransactions = pgTable("escrow_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  hostelId: varchar("hostel_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0.00"),
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 4, scale: 2 }).default("5.00"),
  status: escrowStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  releasedAt: timestamp("released_at"),
}, (table) => [
  index("idx_escrow_buyer").on(table.buyerId),
  index("idx_escrow_seller").on(table.sellerId),
  index("idx_escrow_status").on(table.status),
]);

export const insertEscrowTransactionSchema = createInsertSchema(escrowTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  releasedAt: true,
  status: true,
});

export const createEscrowSchema = z.object({
  sellerId: z.string(),
  productId: z.string().optional(),
  hostelId: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  platformFeePercentage: z.number().min(3).max(6).default(5),
});

export type EscrowTransaction = typeof escrowTransactions.$inferSelect;
export type InsertEscrowTransaction = z.infer<typeof insertEscrowTransactionSchema>;
