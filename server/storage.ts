import {
  users,
  contacts,
  documents,
  apiKeys,
  extractionJobs,
  type User,
  type UpsertUser,
  type Contact,
  type InsertContact,
  type Document,
  type InsertDocument,
  type ApiKey,
  type InsertApiKey,
  type ExtractionJob,
  type InsertExtractionJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Contact operations
  getContacts(userId: string): Promise<Contact[]>;
  getContact(id: string, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, userId: string, data: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string, userId: string): Promise<void>;
  searchContacts(userId: string, query: string): Promise<Contact[]>;

  // Document operations
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string, userId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, userId: string, data: Partial<Document>): Promise<Document>;
  deleteDocument(id: string, userId: string): Promise<void>;

  // API Key operations
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKey(id: string, userId: string): Promise<ApiKey | undefined>;
  getApiKeyByService(userId: string, service: string, keyName: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, userId: string, data: Partial<ApiKey>): Promise<ApiKey>;
  deleteApiKey(id: string, userId: string): Promise<void>;

  // Extraction Job operations
  getExtractionJobs(userId: string): Promise<ExtractionJob[]>;
  getExtractionJob(id: string, userId: string): Promise<ExtractionJob | undefined>;
  createExtractionJob(job: InsertExtractionJob): Promise<ExtractionJob>;
  updateExtractionJob(id: string, userId: string, data: Partial<ExtractionJob>): Promise<ExtractionJob>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Contact operations
  async getContacts(userId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.userId, userId));
  }

  async getContact(id: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return contact;
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(contactData as any).returning();
    return contact;
  }

  async updateContact(id: string, userId: string, data: Partial<Contact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    return contact;
  }

  async deleteContact(id: string, userId: string): Promise<void> {
    await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  }

  async searchContacts(userId: string, query: string): Promise<Contact[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          or(
            ilike(contacts.name, searchPattern),
            ilike(contacts.email, searchPattern),
            ilike(contacts.company, searchPattern),
            ilike(contacts.title, searchPattern)
          )
        )
      );
  }

  // Document operations
  async getDocuments(userId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.userId, userId));
  }

  async getDocument(id: string, userId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return document;
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(documentData).returning();
    return document;
  }

  async updateDocument(id: string, userId: string, data: Partial<Document>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(data)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    return document;
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  // API Key operations
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
  }

  async getApiKey(id: string, userId: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
    return apiKey;
  }

  async getApiKeyByService(userId: string, service: string, keyName: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.service, service),
          eq(apiKeys.keyName, keyName)
        )
      );
    return apiKey;
  }

  async createApiKey(apiKeyData: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db.insert(apiKeys).values(apiKeyData).returning();
    return apiKey;
  }

  async updateApiKey(id: string, userId: string, data: Partial<ApiKey>): Promise<ApiKey> {
    const [apiKey] = await db
      .update(apiKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();
    return apiKey;
  }

  async deleteApiKey(id: string, userId: string): Promise<void> {
    await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
  }

  // Extraction Job operations
  async getExtractionJobs(userId: string): Promise<ExtractionJob[]> {
    return await db.select().from(extractionJobs).where(eq(extractionJobs.userId, userId));
  }

  async getExtractionJob(id: string, userId: string): Promise<ExtractionJob | undefined> {
    const [job] = await db
      .select()
      .from(extractionJobs)
      .where(and(eq(extractionJobs.id, id), eq(extractionJobs.userId, userId)));
    return job;
  }

  async createExtractionJob(jobData: InsertExtractionJob): Promise<ExtractionJob> {
    const [job] = await db.insert(extractionJobs).values(jobData).returning();
    return job;
  }

  async updateExtractionJob(id: string, userId: string, data: Partial<ExtractionJob>): Promise<ExtractionJob> {
    const [job] = await db
      .update(extractionJobs)
      .set(data)
      .where(and(eq(extractionJobs.id, id), eq(extractionJobs.userId, userId)))
      .returning();
    return job;
  }
}

export const storage = new DatabaseStorage();
