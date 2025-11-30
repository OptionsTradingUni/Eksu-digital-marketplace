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

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "pending", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["general", "payment", "order", "account", "technical", "report"]);

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 20 }).unique().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: ticketCategoryEnum("category").default("general"),
  priority: ticketPriorityEnum("priority").default("medium"),
  status: ticketStatusEnum("status").default("open"),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`),
  relatedOrderId: varchar("related_order_id"),
  relatedProductId: varchar("related_product_id"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_support_tickets_user").on(table.userId),
  index("idx_support_tickets_status").on(table.status),
  index("idx_support_tickets_number").on(table.ticketNumber),
]);

export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`),
  isStaffReply: boolean("is_staff_reply").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ticket_replies_ticket").on(table.ticketId),
]);

import { boolean } from 'drizzle-orm/pg-core';

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  ticketNumber: true,
  status: true,
  assignedTo: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const createTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters"),
  category: z.enum(["general", "payment", "order", "account", "technical", "report"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  attachments: z.array(z.string()).optional(),
  relatedOrderId: z.string().optional(),
  relatedProductId: z.string().optional(),
});

export const createSupportTicketSchema = insertSupportTicketSchema.extend({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Please provide more details (minimum 20 characters)"),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;
