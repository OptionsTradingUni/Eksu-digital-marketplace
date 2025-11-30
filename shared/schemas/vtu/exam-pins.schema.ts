import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const examTypeEnum = pgEnum("exam_type", ["waec", "neco", "nabteb", "jamb"]);
export const examPinStatusEnum = pgEnum("exam_pin_status", ["pending", "completed", "failed"]);

export const examPinPurchases = pgTable("exam_pin_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  examType: examTypeEnum("exam_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: examPinStatusEnum("status").default("pending"),
  pins: jsonb("pins"),
  transactionRef: varchar("transaction_ref").unique(),
  apiResponse: jsonb("api_response"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_exam_pins_user").on(table.userId),
  index("idx_exam_pins_status").on(table.status),
]);

export const insertExamPinPurchaseSchema = createInsertSchema(examPinPurchases).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  pins: true,
  apiResponse: true,
});

export const purchaseExamPinSchema = z.object({
  examType: z.enum(["waec", "neco", "nabteb", "jamb"]),
  quantity: z.number().min(1).max(10).default(1),
});

export type ExamPinPurchase = typeof examPinPurchases.$inferSelect;
export type InsertExamPinPurchase = z.infer<typeof insertExamPinPurchaseSchema>;
