import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  real,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// API Keys storage - encrypted storage for user's third-party API credentials
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: varchar("service").notNull(), // 'gmail', 'hubspot', 'gemini', 'huggingface'
  keyName: varchar("key_name").notNull(), // 'api_key', 'client_id', 'client_secret', etc.
  encryptedValue: text("encrypted_value").notNull(),
  isValid: boolean("is_valid").default(true),
  lastValidated: timestamp("last_validated"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Contacts - extracted and enriched contact profiles
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  title: varchar("title"),
  location: varchar("location"),
  skills: text("skills").array(),
  linkedinUrl: varchar("linkedin_url"),
  githubUrl: varchar("github_url"),
  twitterUrl: varchar("twitter_url"),
  websiteUrl: varchar("website_url"),
  bio: text("bio"),
  confidenceScore: real("confidence_score").default(0), // 0-1 scale
  sources: jsonb("sources").$type<{ source: string; url: string; verified: boolean }[]>().default([]),
  extractedData: jsonb("extracted_data"), // Raw extracted data
  enrichedData: jsonb("enriched_data"), // OSINT enriched data
  tags: text("tags").array().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Documents - uploaded files for extraction
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  filePath: varchar("file_path").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  extractionProgress: integer("extraction_progress").default(0), // 0-100
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Extraction Jobs - track AI extraction processes
export const extractionJobs = pgTable("extraction_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: 'set null' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  status: varchar("status").notNull().default('queued'), // 'queued', 'processing', 'completed', 'failed'
  stage: varchar("stage"), // 'ocr', 'extraction', 'enrichment', 'verification'
  progress: integer("progress").default(0), // 0-100
  result: jsonb("result"), // Extraction result data
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertExtractionJobSchema = createInsertSchema(extractionJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;
export type ExtractionJob = typeof extractionJobs.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  contacts: many(contacts),
  documents: many(documents),
  extractionJobs: many(extractionJobs),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const extractionJobsRelations = relations(extractionJobs, ({ one }) => ({
  user: one(users, {
    fields: [extractionJobs.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [extractionJobs.documentId],
    references: [documents.id],
  }),
  contact: one(contacts, {
    fields: [extractionJobs.contactId],
    references: [contacts.id],
  }),
}));
