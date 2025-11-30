import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
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
import { products } from '../products/products.schema';

export const sponsoredAdTypeEnum = pgEnum("sponsored_ad_type", ["product", "banner", "story", "feed"]);
export const sponsoredAdStatusEnum = pgEnum("sponsored_ad_status", ["draft", "pending", "active", "paused", "completed", "rejected"]);

export const sponsoredAds = pgTable("sponsored_ads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advertiserId: varchar("advertiser_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  type: sponsoredAdTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  imageUrl: text("image_url"),
  targetUrl: varchar("target_url", { length: 500 }),
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(),
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0.00"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  ctr: decimal("ctr", { precision: 5, scale: 2 }).default("0.00"),
  cpc: decimal("cpc", { precision: 10, scale: 2 }),
  status: sponsoredAdStatusEnum("status").default("draft"),
  targetAudience: jsonb("target_audience"),
  targetLocations: text("target_locations").array().default(sql`ARRAY[]::text[]`),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sponsored_ads_advertiser").on(table.advertiserId),
  index("idx_sponsored_ads_status").on(table.status),
  index("idx_sponsored_ads_type").on(table.type),
  index("idx_sponsored_ads_dates").on(table.startDate, table.endDate),
]);

export const insertSponsoredAdSchema = createInsertSchema(sponsoredAds).omit({
  id: true,
  spent: true,
  impressions: true,
  clicks: true,
  ctr: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const createSponsoredAdSchema = z.object({
  productId: z.string().optional(),
  type: z.enum(["product", "banner", "story", "feed"]),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().optional(),
  targetUrl: z.string().url().optional(),
  budget: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid budget"),
  dailyBudget: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid daily budget").optional(),
  cpc: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid CPC").optional(),
  targetAudience: z.record(z.any()).optional(),
  targetLocations: z.array(z.string()).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
});

export type SponsoredAd = typeof sponsoredAds.$inferSelect;
export type InsertSponsoredAd = z.infer<typeof insertSponsoredAdSchema>;
