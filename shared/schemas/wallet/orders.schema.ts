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
import { products } from '../products/products.schema';

export const orderStatusEnum = pgEnum("order_status", [
  "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"
]);

export const deliveryMethodEnum = pgEnum("delivery_method", ["pickup", "delivery", "meetup"]);

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number", { length: 20 }).unique().notNull(),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: varchar("quantity").default("1"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending"),
  deliveryMethod: deliveryMethodEnum("delivery_method").default("meetup"),
  deliveryAddress: text("delivery_address"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  escrowId: varchar("escrow_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_orders_buyer").on(table.buyerId),
  index("idx_orders_seller").on(table.sellerId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_number").on(table.orderNumber),
]);

export const orderStatusHistory = pgTable("order_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull(),
  note: text("note"),
  changedBy: varchar("changed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_status_history_order").on(table.orderId),
]);

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  orderNumber: true,
  status: true,
  escrowId: true,
});

export const createOrderSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  deliveryMethod: z.enum(["pickup", "delivery", "meetup"]).optional().default("meetup"),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  quantity: z.number().min(1).optional().default(1),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  status: z.enum([
    "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"
  ]),
  note: z.string().max(500).optional(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
