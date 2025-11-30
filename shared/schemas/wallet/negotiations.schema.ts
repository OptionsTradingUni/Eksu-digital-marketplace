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
import { products } from '../products/products.schema';

export const negotiationStatusEnum = pgEnum("negotiation_status", ["pending", "accepted", "rejected", "countered", "expired"]);

export const negotiations = pgTable("negotiations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  offerPrice: decimal("offer_price", { precision: 10, scale: 2 }).notNull(),
  counterOfferPrice: decimal("counter_offer_price", { precision: 10, scale: 2 }),
  status: negotiationStatusEnum("status").default("pending"),
  message: text("message"),
  sellerMessage: text("seller_message"),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_negotiations_product").on(table.productId),
  index("idx_negotiations_buyer").on(table.buyerId),
  index("idx_negotiations_seller").on(table.sellerId),
  index("idx_negotiations_status").on(table.status),
]);

export const insertNegotiationSchema = createInsertSchema(negotiations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
  rejectedAt: true,
});

export const createNegotiationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  offerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid offer price"),
  message: z.string().max(500).optional(),
});

export const respondToNegotiationSchema = z.object({
  negotiationId: z.string().min(1, "Negotiation ID is required"),
  action: z.enum(["accept", "reject", "counter"]),
  counterOfferPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid counter offer price").optional(),
  message: z.string().max(500).optional(),
});

export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;
