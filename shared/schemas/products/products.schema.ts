import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { categories } from './categories.schema';

export const productConditionEnum = pgEnum("product_condition", ["new", "like_new", "good", "fair"]);

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  isOnSale: boolean("is_on_sale").default(false),
  condition: productConditionEnum("condition").notNull().default("good"),
  location: varchar("location"),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  isAvailable: boolean("is_available").default(true),
  isSold: boolean("is_sold").default(false),
  isFeatured: boolean("is_featured").default(false),
  isApproved: boolean("is_approved").default(true),
  isFlagged: boolean("is_flagged").default(false),
  flagReason: text("flag_reason"),
  views: integer("views").default(0),
  watchers: integer("watchers").default(0),
  inquiries: integer("inquiries").default(0),
  isBoosted: boolean("is_boosted").default(false),
  boostedUntil: timestamp("boosted_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_products_seller").on(table.sellerId),
  index("idx_products_category").on(table.categoryId),
  index("idx_products_created_at").on(table.createdAt),
  index("idx_products_boosted").on(table.isBoosted, table.boostedUntil),
]);

export const productViews = pgTable("product_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").references(() => users.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("idx_product_views_product").on(table.productId),
  index("idx_product_views_viewer").on(table.viewerId),
]);

export const insertProductSchema = createInsertSchema(products, {
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Please select a category"),
  price: z.string().min(1, "Price is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    "Please enter a valid price"
  ),
  originalPrice: z.string().optional().nullable().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Please enter a valid original price"
  ),
  isOnSale: z.boolean().optional().default(false),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("good"),
  location: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]),
  isAvailable: z.boolean().optional().default(true),
  isSold: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  isBoosted: z.boolean().optional().default(false),
  boostedUntil: z.date().optional().nullable(),
  inquiries: z.number().optional().default(0),
}).omit({
  id: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
  views: true,
  watchers: true,
  isApproved: true,
  isFlagged: true,
  flagReason: true,
});

export const updateProductSchema = insertProductSchema.partial();

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type Product = typeof products.$inferSelect;
export type ProductView = typeof productViews.$inferSelect;
