import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const chatbotConversations = pgTable("chatbot_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }),
  context: jsonb("context"),
  messagesCount: integer("messages_count").default(0),
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chatbot_conversations_user").on(table.userId),
  index("idx_chatbot_conversations_active").on(table.isActive),
]);

export const chatbotMessages = pgTable("chatbot_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => chatbotConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_chatbot_messages_conversation").on(table.conversationId),
  index("idx_chatbot_messages_created").on(table.createdAt),
]);

export const insertChatbotConversationSchema = createInsertSchema(chatbotConversations).omit({
  id: true,
  messagesCount: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatbotMessageSchema = createInsertSchema(chatbotMessages).omit({
  id: true,
  createdAt: true,
});

export const sendChatbotMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "Message cannot be empty").max(4000),
});

export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type InsertChatbotConversation = z.infer<typeof insertChatbotConversationSchema>;
export type ChatbotMessage = typeof chatbotMessages.$inferSelect;
export type InsertChatbotMessage = z.infer<typeof insertChatbotMessageSchema>;
