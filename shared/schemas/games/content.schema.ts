import { sql } from "drizzle-orm";
import {
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const triviaQuestions = pgTable("trivia_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  category: varchar("category", { length: 100 }),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const wordLists = pgTable("word_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: varchar("word", { length: 50 }).notNull().unique(),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const typingTexts = pgTable("typing_texts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  wordCount: integer("word_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceGuessProducts = pgTable("price_guess_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  imageUrl: text("image_url"),
  actualPrice: decimal("actual_price", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTriviaQuestionSchema = createInsertSchema(triviaQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertTypingTextSchema = createInsertSchema(typingTexts).omit({
  id: true,
  createdAt: true,
});

export const insertPriceGuessProductSchema = createInsertSchema(priceGuessProducts).omit({
  id: true,
  createdAt: true,
});

export type TriviaQuestion = typeof triviaQuestions.$inferSelect;
export type InsertTriviaQuestion = z.infer<typeof insertTriviaQuestionSchema>;
export type WordList = typeof wordLists.$inferSelect;
export type TypingText = typeof typingTexts.$inferSelect;
export type InsertTypingText = z.infer<typeof insertTypingTextSchema>;
export type PriceGuessProduct = typeof priceGuessProducts.$inferSelect;
export type InsertPriceGuessProduct = z.infer<typeof insertPriceGuessProductSchema>;
