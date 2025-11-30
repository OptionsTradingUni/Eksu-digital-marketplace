import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const resellerTierEnum = pgEnum("reseller_tier", ["basic", "silver", "gold", "platinum"]);
export const resellerStatusEnum = pgEnum("reseller_status", ["pending", "active", "suspended", "rejected"]);

export const resellerSites = pgTable("reseller_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  businessName: varchar("business_name", { length: 200 }).notNull(),
  subdomain: varchar("subdomain", { length: 50 }).unique().notNull(),
  customDomain: varchar("custom_domain", { length: 200 }).unique(),
  logo: text("logo"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#3B82F6"),
  description: text("description"),
  tier: resellerTierEnum("tier").default("basic"),
  status: resellerStatusEnum("status").default("pending"),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).default("0.00"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default("0.00"),
  settings: jsonb("settings"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reseller_sites_user").on(table.userId),
  index("idx_reseller_sites_subdomain").on(table.subdomain),
  index("idx_reseller_sites_status").on(table.status),
]);

export const insertResellerSiteSchema = createInsertSchema(resellerSites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  walletBalance: true,
  totalEarnings: true,
  totalSales: true,
  isVerified: true,
});

export const createResellerSiteSchema = z.object({
  businessName: z.string().min(3, "Business name must be at least 3 characters").max(200),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
  description: z.string().max(500).optional(),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
});

export const updateResellerSiteSchema = createResellerSiteSchema.partial();

export type ResellerSite = typeof resellerSites.$inferSelect;
export type InsertResellerSite = z.infer<typeof insertResellerSiteSchema>;
