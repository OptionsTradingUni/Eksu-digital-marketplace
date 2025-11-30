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

export const materialTypeEnum = pgEnum("material_type", ["pdf", "notes", "past_questions", "textbook", "slides", "other"]);
export const academicLevelEnum = pgEnum("academic_level", ["100", "200", "300", "400", "500", "postgraduate", "all"]);

export const studyMaterials = pgTable("study_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploaderId: varchar("uploader_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  type: materialTypeEnum("type").notNull(),
  level: academicLevelEnum("level").default("all"),
  department: varchar("department", { length: 100 }),
  course: varchar("course", { length: 200 }),
  courseCode: varchar("course_code", { length: 20 }),
  semester: varchar("semester", { length: 20 }),
  session: varchar("session", { length: 20 }),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00"),
  isFree: boolean("is_free").default(true),
  downloadsCount: integer("downloads_count").default(0),
  viewsCount: integer("views_count").default(0),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  ratingsCount: integer("ratings_count").default(0),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  isApproved: boolean("is_approved").default(true),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_study_materials_uploader").on(table.uploaderId),
  index("idx_study_materials_type").on(table.type),
  index("idx_study_materials_level").on(table.level),
  index("idx_study_materials_department").on(table.department),
]);

export const studyMaterialPurchases = pgTable("study_material_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_study_material_purchases_material").on(table.materialId),
  index("idx_study_material_purchases_buyer").on(table.buyerId),
]);

export const studyMaterialRatings = pgTable("study_material_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_study_material_ratings_material").on(table.materialId),
  index("idx_study_material_ratings_user").on(table.userId),
]);

export const insertStudyMaterialSchema = createInsertSchema(studyMaterials).omit({
  id: true,
  downloadsCount: true,
  viewsCount: true,
  rating: true,
  ratingsCount: true,
  createdAt: true,
  updatedAt: true,
});

export const uploadStudyMaterialSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(300),
  description: z.string().max(2000).optional(),
  type: z.enum(["pdf", "notes", "past_questions", "textbook", "slides", "other"]),
  level: z.enum(["100", "200", "300", "400", "500", "postgraduate", "all"]).optional(),
  department: z.string().max(100).optional(),
  course: z.string().max(200).optional(),
  courseCode: z.string().max(20).optional(),
  semester: z.string().optional(),
  session: z.string().optional(),
  price: z.string().optional(),
  isFree: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(),
});

export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type InsertStudyMaterial = z.infer<typeof insertStudyMaterialSchema>;
export type StudyMaterialPurchase = typeof studyMaterialPurchases.$inferSelect;
export type StudyMaterialRating = typeof studyMaterialRatings.$inferSelect;
