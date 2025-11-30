import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const announcementCategoryEnum = pgEnum("announcement_category", ["general", "update", "promotion", "maintenance", "policy"]);
export const announcementPriorityEnum = pgEnum("announcement_priority", ["low", "normal", "high", "urgent"]);

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  category: announcementCategoryEnum("category").default("general"),
  priority: announcementPriorityEnum("priority").default("normal"),
  imageUrl: text("image_url"),
  actionUrl: varchar("action_url", { length: 500 }),
  actionText: varchar("action_text", { length: 50 }),
  targetAudience: varchar("target_audience", { length: 50 }).default("all"),
  isActive: boolean("is_active").default(true),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_announcements_category").on(table.category),
  index("idx_announcements_active").on(table.isActive),
  index("idx_announcements_published").on(table.publishedAt),
]);

export const announcementReads = pgTable("announcement_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  announcementId: varchar("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => [
  index("idx_announcement_reads_announcement").on(table.announcementId),
  index("idx_announcement_reads_user").on(table.userId),
]);

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.enum(["general", "update", "promotion", "maintenance", "policy"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  imageUrl: z.string().optional(),
  actionUrl: z.string().optional(),
  actionText: z.string().max(50).optional(),
  targetAudience: z.string().optional(),
  publishedAt: z.date().optional(),
  expiresAt: z.date().optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
