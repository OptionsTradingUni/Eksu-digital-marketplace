import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { resellerSites } from './sites.schema';
import { vtuPlans, vtuNetworkEnum } from '../vtu/plans.schema';

export const resellerPricing = pgTable("reseller_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellerSites.id, { onDelete: "cascade" }),
  network: vtuNetworkEnum("network").notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  planId: varchar("plan_id").references(() => vtuPlans.id, { onDelete: "set null" }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  profitMargin: decimal("profit_margin", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reseller_pricing_reseller").on(table.resellerId),
  index("idx_reseller_pricing_network").on(table.network),
]);

export const insertResellerPricingSchema = createInsertSchema(resellerPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResellerPricingSchema = z.object({
  sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price"),
  isActive: z.boolean().optional(),
});

export type ResellerPricing = typeof resellerPricing.$inferSelect;
export type InsertResellerPricing = z.infer<typeof insertResellerPricingSchema>;
