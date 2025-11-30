import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { products } from './products.schema';

export const boostRequests = pgTable("boost_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  duration: integer("duration").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBoostRequestSchema = createInsertSchema(boostRequests).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const createBoostSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.enum(["boost", "featured"]),
  duration: z.number().min(1).max(720),
  amount: z.number().positive(),
});

export type BoostRequest = typeof boostRequests.$inferSelect;
export type InsertBoostRequest = z.infer<typeof insertBoostRequestSchema>;
