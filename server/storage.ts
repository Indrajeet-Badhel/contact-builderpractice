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
import { encrypt, decrypt } from "./security/encryption";
import { validateAndSanitize } from "./security/validation";

function decodeHtmlEntities(str: string): string {
  if (!str) return "";

  let result = String(str);

  // Fix double-encoded ampersands first: &amp;#x2F; -> &#x2F;
  result = result.replace(/&amp;#/g, "&#");

  // Hex entities: &#x2F;
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // Decimal entities: &#47;
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  );

  // Common named entities
  result = result
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;#34;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;amp;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return result;
}

/**
 * Clean and normalize a URL - decode entities and remove trailing slashes
 */
function cleanUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // First decode any HTML entities
  let cleaned = decodeHtmlEntities(url);
  
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  
  // Ensure it starts with http:// or https://
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  
  return cleaned;
}

/**
 * Clean all URL fields in an object
 */
function cleanContactUrls(data: any): any {
  if (!data) return data;
  
  const cleaned = { ...data };
  
  // Clean direct URL fields
  if (cleaned.linkedinUrl) cleaned.linkedinUrl = cleanUrl(cleaned.linkedinUrl);
  if (cleaned.githubUrl) cleaned.githubUrl = cleanUrl(cleaned.githubUrl);
  if (cleaned.websiteUrl) cleaned.websiteUrl = cleanUrl(cleaned.websiteUrl);
  if (cleaned.orcidUrl) cleaned.orcidUrl = cleanUrl(cleaned.orcidUrl);
  
  // Clean URLs in sources array
  if (Array.isArray(cleaned.sources)) {
    cleaned.sources = cleaned.sources.map((source: any) => ({
      ...source,
      url: source.url ? cleanUrl(source.url) : source.url,
    }));
  }
  
  // Clean URLs in enrichedData if it exists
  if (cleaned.enrichedData && typeof cleaned.enrichedData === 'object') {
    if (cleaned.enrichedData.linkedinUrl) {
      cleaned.enrichedData.linkedinUrl = cleanUrl(cleaned.enrichedData.linkedinUrl);
    }
    if (cleaned.enrichedData.githubUrl) {
      cleaned.enrichedData.githubUrl = cleanUrl(cleaned.enrichedData.githubUrl);
    }
    if (cleaned.enrichedData.websiteUrl) {
      cleaned.enrichedData.websiteUrl = cleanUrl(cleaned.enrichedData.websiteUrl);
    }
    if (cleaned.enrichedData.orcidUrl) {
      cleaned.enrichedData.orcidUrl = cleanUrl(cleaned.enrichedData.orcidUrl);
    }
    
    // Clean sources in enrichedData
    if (Array.isArray(cleaned.enrichedData.sources)) {
      cleaned.enrichedData.sources = cleaned.enrichedData.sources.map((source: any) => ({
        ...source,
        url: source.url ? cleanUrl(source.url) : source.url,
      }));
    }
  }
  
  return cleaned;
}

export interface IStorage {
  // User operations
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

  // API Key operations (with encryption)
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
    // Sanitize user data
    const sanitized = validateAndSanitize(userData);
    
    const [user] = await db
      .insert(users)
      .values(sanitized)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: sanitized.firstName,
          lastName: sanitized.lastName,
          profileImageUrl: sanitized.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Contact operations with sanitization and URL cleaning
  async getContacts(userId: string): Promise<Contact[]> {
    const allContacts = await db.select().from(contacts).where(eq(contacts.userId, userId));
    
    // Clean all URLs before returning
    return allContacts.map((contact: Contact) => cleanContactUrls(contact));
  }

  async getContact(id: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    
    if (!contact) return undefined;
    
    // Clean all URLs before returning
    return cleanContactUrls(contact);
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    // First sanitize all string fields
    const sanitized = validateAndSanitize(contactData);
    
    // Then clean all URLs
    const cleaned = cleanContactUrls(sanitized);
    
    const [contact] = await db.insert(contacts).values(cleaned as any).returning();
    
    // Return with cleaned URLs
    return cleanContactUrls(contact);
  }

  async updateContact(id: string, userId: string, data: Partial<Contact>): Promise<Contact> {
    // Sanitize update data
    const sanitized = validateAndSanitize(data);
    
    // Clean all URLs
    const cleaned = cleanContactUrls(sanitized);
    
    const [contact] = await db
      .update(contacts)
      .set({ ...cleaned, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    
    if (!contact) {
      throw new Error('Contact not found or unauthorized');
    }
    
    // Return with cleaned URLs
    return cleanContactUrls(contact);
  }

  async deleteContact(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Contact not found or unauthorized');
    }
  }

  async searchContacts(userId: string, query: string): Promise<Contact[]> {
    // Sanitize search query
    const sanitizedQuery = validateAndSanitize(query);
    const searchPattern = `%${sanitizedQuery}%`;
    
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
    
    if (!document) {
      throw new Error('Document not found or unauthorized');
    }
    
    return document;
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Document not found or unauthorized');
    }
  }

  // API Key operations with encryption
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
    
    // Decrypt values before returning
    return keys.map(key => ({
      ...key,
      encryptedValue: key.encryptedValue ? decrypt(key.encryptedValue) : '',
    }));
  }

  async getApiKey(id: string, userId: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
    
    if (!apiKey) return undefined;
    
    // Decrypt value before returning
    return {
      ...apiKey,
      encryptedValue: apiKey.encryptedValue ? decrypt(apiKey.encryptedValue) : '',
    };
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
    
    if (!apiKey) return undefined;
    
    // Decrypt value before returning
    return {
      ...apiKey,
      encryptedValue: apiKey.encryptedValue ? decrypt(apiKey.encryptedValue) : '',
    };
  }

  async createApiKey(apiKeyData: InsertApiKey): Promise<ApiKey> {
    // Encrypt the API key before storing
    const encrypted = {
      ...apiKeyData,
      encryptedValue: encrypt(apiKeyData.encryptedValue),
    };
    
    const [apiKey] = await db.insert(apiKeys).values(encrypted).returning();
    
    // Return with decrypted value
    return {
      ...apiKey,
      encryptedValue: apiKeyData.encryptedValue,
    };
  }

  async updateApiKey(id: string, userId: string, data: Partial<ApiKey>): Promise<ApiKey> {
    // Encrypt value if it's being updated
    const updateData = { ...data };
    if (updateData.encryptedValue) {
      updateData.encryptedValue = encrypt(updateData.encryptedValue);
    }
    
    const [apiKey] = await db
      .update(apiKeys)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();
    
    if (!apiKey) {
      throw new Error('API key not found or unauthorized');
    }
    
    // Return with decrypted value
    return {
      ...apiKey,
      encryptedValue: apiKey.encryptedValue ? decrypt(apiKey.encryptedValue) : '',
    };
  }

  async deleteApiKey(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error('API key not found or unauthorized');
    }
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
    
    if (!job) {
      throw new Error('Extraction job not found or unauthorized');
    }
    
    return job;
  }
}

export const storage = new DatabaseStorage();