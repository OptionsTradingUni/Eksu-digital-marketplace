import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { products } from '../products/products.schema';

export const reportStatusEnum = pgEnum("report_status_enum", ["pending", "reviewing", "action_taken", "dismissed"]);
export const reportTypeEnum = pgEnum("report_type", ["product", "user", "message", "post", "comment"]);

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportType: reportTypeEnum("report_type").notNull(),
  targetId: varchar("target_id").notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  reportedUserId: varchar("reported_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  evidence: text("evidence").array().default(sql`ARRAY[]::text[]`),
  status: reportStatusEnum("status").default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  actionTaken: varchar("action_taken", { length: 100 }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reports_reporter").on(table.reporterId),
  index("idx_reports_type").on(table.reportType),
  index("idx_reports_status").on(table.status),
]);

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewNotes: true,
  actionTaken: true,
  reviewedAt: true,
  createdAt: true,
});

export const createReportSchema = z.object({
  reportType: z.enum(["product", "user", "message", "post", "comment"]),
  targetId: z.string().min(1, "Target ID is required"),
  reason: z.string().min(1, "Reason is required").max(100),
  description: z.string().max(1000).optional(),
  evidence: z.array(z.string()).optional(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
