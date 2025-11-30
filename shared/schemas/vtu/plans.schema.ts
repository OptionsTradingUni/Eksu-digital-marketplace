import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vtuNetworkEnum = pgEnum("vtu_network", ["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]);

export const vtuPlans = pgTable("vtu_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  network: vtuNetworkEnum("network").notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  planCode: varchar("plan_code", { length: 50 }),
  dataAmount: varchar("data_amount", { length: 50 }),
  duration: varchar("duration", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  description: varchar("description", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vtu_plans_network").on(table.network),
  index("idx_vtu_plans_type").on(table.planType),
]);

export const insertVtuPlanSchema = createInsertSchema(vtuPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VtuPlan = typeof vtuPlans.$inferSelect;
export type InsertVtuPlan = z.infer<typeof insertVtuPlanSchema>;
