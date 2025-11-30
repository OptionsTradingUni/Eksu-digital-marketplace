import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users.schema';

export const userPhotos = pgTable("user_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  isProfilePhoto: boolean("is_profile_photo").default(false),
  sortOrder: integer("sort_order").default(0),
  caption: varchar("caption", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_photos_user_idx").on(table.userId),
  index("user_photos_sort_idx").on(table.userId, table.sortOrder),
]);

export const insertUserPhotoSchema = createInsertSchema(userPhotos).omit({
  id: true,
  createdAt: true,
});

export const addUserPhotoSchema = z.object({
  caption: z.string().max(200).optional(),
});

export const reorderPhotosSchema = z.object({
  photoIds: z.array(z.string()).min(1).max(6),
});

export type UserPhoto = typeof userPhotos.$inferSelect;
export type InsertUserPhoto = z.infer<typeof insertUserPhotoSchema>;
