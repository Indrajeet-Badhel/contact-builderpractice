import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import multer from "multer";
import path from "path";
import { 
  extractContactFromDocument, 
  semanticSearchContacts, 
  extractContactFromWebsite 
} from "./gemini";
import { enrichContact } from "./enrichment";
import { deduplicateContactData, improveConfidenceScore } from "./huggingface";
import * as XLSX from "xlsx";
import { pool, db } from "./db";
import { contacts, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import AdmZip from "adm-zip";
import fs from "fs";
import pLimit from "p-limit";
import mime from "mime-types";
import { isAdmin } from "./security/adminAuth";



import { 
  apiRateLimiter, 
  authRateLimiter, 
  searchRateLimiter,
  adminRateLimiter,
  uploadRateLimiter 
} from "./security/rateLimiter";

import { 
  validateRequest, 
  contactSchema, 
  searchSchema,
  urlSchema,
  idParamSchema,
  sanitizeString 
} from "./security/validation";

import { securityHeaders, corsHeaders } from "./security/header";

import { 
  createAuditMiddleware, 
  logSecurityEvent, 
  SecurityEventType 
} from "./security/auditLogger";
import { requireAdmin } from "./security/adminAuth";
import { encrypt, decrypt } from "./security/encryption";


const limit = pLimit(1); 

// -----------------------------------------
// Helpers
// -----------------------------------------

// Simple retry helper for async tasks (attempts, with optional delay)

function decodeUrlsInObject(obj: any): any {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    // Check if it looks like a URL
    if (obj.includes('http') || obj.includes('&#x')) {
      return decodeHtmlEntities(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => decodeUrlsInObject(item));
  }
  
  if (typeof obj === 'object') {
    const decoded: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Decode URL fields specifically
      if (key.toLowerCase().includes('url') || key === 'websiteUrl' || key === 'githubUrl' || key === 'linkedinUrl' || key === 'orcidUrl') {
        decoded[key] = typeof value === 'string' ? decodeHtmlEntities(value) : value;
      } else {
        decoded[key] = decodeUrlsInObject(value);
      }
    }
    return decoded;
  }
  
  return obj;
}

function cleanUrl(url: string | null | undefined): string {
  if (!url) return '';
  
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

function cleanSkills(skills: any): string[] {
  if (!skills) return [];

  let list = skills;

  if (typeof list === "string") {
    try {
      const decoded = decodeHtmlEntities(list);
      list = JSON.parse(decoded);
    } catch {
      list = list
        .split(/[,;\n\r]+/)
        .map((s: string) => decodeHtmlEntities(s).trim());
    }
  }

  return (Array.isArray(list) ? list : [list])
    .map((s: any) => decodeHtmlEntities(String(s || "")).replace(/[\[\]\"]/g, "").trim())
    .filter(Boolean);
}

async function retry<T>(
  fn: () => Promise<T>, 
  attempts = 3, 
  delayMs = 500
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

function normalizeString(value?: string | null): string {
  return (value || "").toLowerCase().trim();
}

function deriveNameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    let host = u.hostname.toLowerCase(); // ecellvitpune.in
    host = host.replace(/^www\./, "");   // remove www.

    const main = host.split(".")[0];     // "ecellvitpune"
    if (!main) return "";

    const spaced = main.replace(/[-_]/g, " "); // "ecell vit pune" if hyphenated

    // Capitalize words → "Ecellvitpune" / "Ecell Vit Pune"
    return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "";
  }
}

function normalizeUrl(value?: string | null): string {
  if (!value) return "";
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return value.toLowerCase().trim();
  }
}

function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function findDuplicateContact(
  newContact: any,
  existingContacts: any[]
): any | null {
  // Strategy 1: Exact URL matches (highest priority)
  for (const existing of existingContacts) {
    // GitHub URL
    if (newContact.githubUrl && existing.githubUrl) {
      const newGh = normalizeUrl(newContact.githubUrl);
      const existingGh = normalizeUrl(existing.githubUrl);
      if (newGh && existingGh && newGh === existingGh) {
        console.log(`Duplicate found via GitHub URL: ${existing.id}`);
        return existing;
      }
    }

    // LinkedIn URL
    if (newContact.linkedinUrl && existing.linkedinUrl) {
      const newLi = normalizeUrl(newContact.linkedinUrl);
      const existingLi = normalizeUrl(existing.linkedinUrl);
      if (newLi && existingLi && newLi === existingLi) {
        console.log(`Duplicate found via LinkedIn URL: ${existing.id}`);
        return existing;
      }
    }

    // ORCID URL
    if (newContact.orcidUrl && existing.orcidUrl) {
      const newOrcid = normalizeUrl(newContact.orcidUrl);
      const existingOrcid = normalizeUrl(existing.orcidUrl);
      if (newOrcid && existingOrcid && newOrcid === existingOrcid) {
        console.log(`Duplicate found via ORCID URL: ${existing.id}`);
        return existing;
      }
    }

    // Email exact match
    if (newContact.email && existing.email) {
      const newEmail = normalizeString(newContact.email);
      const existingEmail = normalizeString(existing.email);
      if (newEmail && existingEmail && newEmail === existingEmail) {
        console.log(`Duplicate found via Email: ${existing.id}`);
        return existing;
      }
    }
  }

  // Strategy 2: Name similarity + URL/company
  const newName = normalizeName(newContact.name);
  if (!newName) return null;

  for (const existing of existingContacts) {
    const existingName = normalizeName(existing.name);
    if (!existingName) continue;

    const nameSim = stringSimilarity(newName, existingName);

    if (nameSim > 0.85) {
      const hasUrlOverlap = (
        (newContact.githubUrl && existing.githubUrl) ||
        (newContact.linkedinUrl && existing.linkedinUrl) ||
        (newContact.websiteUrl && existing.websiteUrl)
      );

      if (hasUrlOverlap) {
        console.log(`Duplicate via name similarity (${nameSim.toFixed(2)}) + URL overlap: ${existing.id}`);
        return existing;
      }

      if (nameSim > 0.95 && newContact.company && existing.company) {
        const companySim = stringSimilarity(
          normalizeString(newContact.company),
          normalizeString(existing.company)
        );
        if (companySim > 0.8) {
          console.log(`Duplicate via name (${nameSim.toFixed(2)}) + company (${companySim.toFixed(2)}): ${existing.id}`);
          return existing;
        }
      }
    }
  }

  // Strategy 3: Same email domain + similar name
  if (newContact.email) {
    const newEmailDomain = newContact.email.split("@")[1]?.toLowerCase();
    for (const existing of existingContacts) {
      if (!existing.email) continue;
      const existingEmailDomain = existing.email.split("@")[1]?.toLowerCase();

      if (newEmailDomain && existingEmailDomain && newEmailDomain === existingEmailDomain) {
        const nameSim = stringSimilarity(
          normalizeName(newContact.name),
          normalizeName(existing.name)
        );
        if (nameSim > 0.8) {
          console.log(`Duplicate via email domain + name similarity: ${existing.id}`);
          return existing;
        }
      }
    }
  }

  return null;
}

function areLikelySamePerson(a: any, b: any): boolean {
  const result = findDuplicateContact(a, [b]);
  return result !== null;
}

function mergeSources(existing: any[] = [], incoming: any[] = []): any[] {
  const merged = [...existing];
  const seen = new Set(existing.map((s) => `${s.source}:${s.url || ""}`));

  for (const s of incoming) {
    const key = `${s.source}:${s.url || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}

function mergeSkills(existing: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...(existing || []), ...(incoming || [])]));
}

// url based searching
function detectProvider(rawUrl: string):
  | "github"
  | "orcid"
  | "stackoverflow"
  | "gitlab"
  | "devto"
  | "linkedin"
  | "website"
  | "unknown" {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host === "github.com") return "github";
    if (host === "orcid.org") return "orcid";
    if (host === "stackoverflow.com" || host.endsWith(".stackexchange.com")) return "stackoverflow";
    if (host === "gitlab.com") return "gitlab";
    if (host === "dev.to") return "devto";
    if (host === "www.linkedin.com" || host === "linkedin.com") return "linkedin";

    return "website";
  } catch {
    return "unknown";
  }
}

// -----------------------------------------
// File upload config
// -----------------------------------------
const uploadDir = path.join(process.cwd(), "uploads");

const upload = multer({
  dest: uploadDir,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // <-- .xlsx
  "text/csv", // <-- CSV support

  "application/zip",
  "application/x-zip-compressed",

  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain"
];

    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// -----------------------------------------
// Main router
// -----------------------------------------
export async function registerRoutes(app: Express): Promise<Server> {
  app.use(securityHeaders);
  app.use(corsHeaders);
  app.use(createAuditMiddleware());

  await setupAuth(app);

  // AUTH USER
  app.get(
    "/api/auth/user", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const sessionUser = (req.session as any)?.user;
        if (sessionUser) {
          res.json({
            id: sessionUser.id,
            email: sessionUser.email,
            firstName: sessionUser.firstName,
            lastName: sessionUser.lastName,
          });
        } else {
          const userId = req.user.claims.sub;
          const user = await storage.getUser(userId);
          res.json(user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    }
  );

  // -------------------------------------
  // CONTACTS CRUD
  // -------------------------------------
  app.get(
    "/api/contacts", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contacts = await storage.getContacts(userId);
        
        // Clean all URLs in the response
        const cleanedContacts = contacts.map(contact => decodeUrlsInObject(contact));
        
        res.json(cleanedContacts);
      } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ message: "Failed to fetch contacts" });
      }
    }
  );

  app.get(
    "/api/contacts/:id", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contact = await storage.getContact(req.params.id, userId);
        
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
        
        // Clean all URLs before sending
        const cleanedContact = decodeUrlsInObject(contact);
        
        res.json(cleanedContact);
      } catch (error) {
        console.error("Error fetching contact:", error);
        res.status(500).json({ message: "Failed to fetch contact" });
      }
    }
  );

  app.post(
    "/api/contacts", 
    isAuthenticated, 
    apiRateLimiter,
    validateRequest(contactSchema),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contact = await storage.createContact({
          userId,
          ...req.body
        });
        
        logSecurityEvent(
          SecurityEventType.RESOURCE_CREATED,
          req,
          { resourceType: "contact", resourceId: contact.id }
        );
        
        res.json(contact);
      } catch (error) {
        console.error("Error creating contact:", error);
        res.status(500).json({ message: "Failed to create contact" });
      }
    }
  );

  app.patch(
    "/api/contacts/:id", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contact = await storage.updateContact(
          req.params.id, 
          userId, 
          req.body
        );
        res.json(contact);
      } catch (error) {
        console.error("Error updating contact:", error);
        res.status(500).json({ message: "Failed to update contact" });
      }
    }
  );

  app.delete(
    "/api/contacts/:id", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await storage.deleteContact(req.params.id, userId);
        
        logSecurityEvent(
          SecurityEventType.RESOURCE_DELETED,
          req,
          { resourceType: "contact", resourceId: req.params.id }
        );
        
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting contact:", error);
        res.status(500).json({ message: "Failed to delete contact" });
      }
    }
  );

  // -------------------------------------
  // CONTACT SEARCH
  // -------------------------------------
  app.post(
    "/api/contacts/search", 
    isAuthenticated, 
    searchRateLimiter,
    validateRequest(searchSchema),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { query } = req.body;

        const geminiKey = await storage.getApiKeyByService(
          userId, 
          "gemini", 
          "api_key"
        );
        if (!geminiKey) {
          return res.status(400).json({ 
            message: "Gemini API key not configured. Please add it in your profile." 
          });
        }

        const allContacts = await storage.getContacts(userId);
        const results = await semanticSearchContacts(
          query, 
          allContacts, 
          geminiKey.encryptedValue
        );
        res.json(results);
      } catch (error) {
        console.error("Error searching contacts:", error);
        res.status(500).json({ message: "Failed to search contacts" });
      }
    }
  );

  // -------------------------------------
  // CONTACT FROM URL (single unified route)
  // -------------------------------------
  app.post(
    "/api/contacts/from-url",
    isAuthenticated,
    searchRateLimiter,
    validateRequest(urlSchema),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { url } = req.body;

        // 🔥 CLEAN the incoming URL immediately
        const cleanedUrl = cleanUrl(url);
        
        console.log('Original URL:', url);
        console.log('Cleaned URL:', cleanedUrl);

        // Validate cleaned URL
        if (!cleanedUrl || !cleanedUrl.startsWith('http')) {
          return res.status(400).json({
            message: "Invalid URL format",
          });
        }

        // get Gemini key
        const geminiKey = await storage.getApiKeyByService(
          userId,
          "gemini",
          "api_key"
        );
        if (!geminiKey) {
          return res.status(400).json({
            message: "Gemini API key not configured. Please add it in your profile.",
          });
        }

        // 1) extract from website using the cleaned URL
        const extracted = await extractContactFromWebsite(
          cleanedUrl,
          geminiKey.encryptedValue
        );

        // 2) Clean all URLs in extracted data
        const cleanedExtracted = decodeUrlsInObject(extracted);

        // 3) optional enrichment
        const githubKey = await storage
          .getApiKeyByService(userId, "github", "api_key")
          .catch(() => null);

        const enriched = await enrichContact(
          cleanedExtracted,
          githubKey?.encryptedValue,
          { conservative: true }
        );

        // 4) Clean all URLs in enriched data
        const cleanedEnriched = decodeUrlsInObject(enriched);

        // Clean sources array
        const normalizedEnrichedSources = (cleanedEnriched.sources || []).map((s: any) => ({
          ...s,
          url: cleanUrl(s.url),
        }));

        const derivedNameFromUrl = deriveNameFromUrl(cleanedUrl);

        const finalName =
          cleanedEnriched.name ||
          cleanedExtracted.name ||
          derivedNameFromUrl ||
          "Unknown";

        const finalCompany =
          cleanedEnriched.company ||
          cleanedExtracted.company ||
          derivedNameFromUrl ||
          undefined;

        // 5) check duplicates
        const existingContacts = await storage.getContacts(userId);

        const possibleDuplicate = existingContacts.find((c) =>
          areLikelySamePerson(
            {
              name: cleanedEnriched.name || cleanedExtracted.name || finalName,
              email: cleanedEnriched.email || cleanedExtracted.email,
              githubUrl: cleanUrl(cleanedEnriched.githubUrl || cleanedExtracted.githubUrl),
              linkedinUrl: cleanUrl(cleanedEnriched.linkedinUrl || cleanedExtracted.linkedinUrl),
              websiteUrl: cleanedUrl,
            },
            {
              name: c.name,
              email: c.email,
              githubUrl: c.githubUrl,
              linkedinUrl: c.linkedinUrl,
              websiteUrl: c.websiteUrl,
            }
          )
        );

        // 🔥 Base sources: always store CLEAN URLs
        const baseSources: any[] = [
          { source: "website", url: cleanedUrl, verified: false },
          ...normalizedEnrichedSources,
        ];

        if (possibleDuplicate) {
          const mergedSources = mergeSources(
            (possibleDuplicate.sources as any[]) || [],
            baseSources
          );

          const mergedSkills = mergeSkills(
            possibleDuplicate.skills || [],
            cleanedEnriched.skills || cleanedExtracted.skills || []
          );

          const updated = await storage.updateContact(
            possibleDuplicate.id,
            userId,
            {
              name: possibleDuplicate.name || finalName,
              email:
                possibleDuplicate.email ||
                cleanedEnriched.email ||
                cleanedExtracted.email,
              phone:
                possibleDuplicate.phone ||
                cleanedEnriched.phone ||
                cleanedExtracted.phone,
              company:
                possibleDuplicate.company ||
                finalCompany,
              title:
                possibleDuplicate.title ||
                cleanedEnriched.title ||
                cleanedExtracted.title,
              location:
                possibleDuplicate.location ||
                cleanedEnriched.location ||
                cleanedExtracted.location,
              skills: mergedSkills,
              linkedinUrl: cleanUrl(
                possibleDuplicate.linkedinUrl ||
                cleanedEnriched.linkedinUrl ||
                cleanedExtracted.linkedinUrl
              ),
              githubUrl: cleanUrl(
                possibleDuplicate.githubUrl ||
                cleanedEnriched.githubUrl ||
                cleanedExtracted.githubUrl
              ),
              websiteUrl: cleanUrl(possibleDuplicate.websiteUrl || cleanedUrl),
              bio:
                possibleDuplicate.bio ||
                cleanedEnriched.bio ||
                cleanedExtracted.bio,
              confidenceScore:
                cleanedEnriched.confidenceScore ??
                possibleDuplicate.confidenceScore ??
                0.85,
              sources: mergedSources,
              enrichedData: {
                ...(possibleDuplicate.enrichedData as any),
                ...cleanedEnriched,
              },
              extractedData: cleanedExtracted,
            }
          );

          // Clean the response before sending
          const cleanedResponse = decodeUrlsInObject(updated);
          return res.json(cleanedResponse);
        }

        // 6) No duplicate → create
        const contact = await storage.createContact({
          userId,
          name: finalName,
          email: cleanedEnriched.email || cleanedExtracted.email,
          phone: cleanedEnriched.phone || cleanedExtracted.phone,
          company: finalCompany,
          title: cleanedEnriched.title || cleanedExtracted.title,
          location: cleanedEnriched.location || cleanedExtracted.location,
          skills: cleanedEnriched.skills || cleanedExtracted.skills || [],
          linkedinUrl: cleanUrl(cleanedEnriched.linkedinUrl || cleanedExtracted.linkedinUrl),
          githubUrl: cleanUrl(cleanedEnriched.githubUrl || cleanedExtracted.githubUrl),
          websiteUrl: cleanedUrl,
          bio: cleanedEnriched.bio || cleanedExtracted.bio,
          confidenceScore: cleanedEnriched.confidenceScore ?? 0.85,
          sources: baseSources,
          extractedData: cleanedExtracted,
          enrichedData: cleanedEnriched,
        });

        // Clean the response before sending
        const cleanedResponse = decodeUrlsInObject(contact);
        res.json(cleanedResponse);
      } catch (err: any) {
        console.error("Error creating contact from URL:", err);
        const message = err?.message || "Failed to create contact from URL";
        res.status(500).json({ message });
      }
    }
  );

  // -------------------------------------
  // DOCUMENT UPLOAD + EXTRACTION (single route, with ZIP + rate-limit)
  // -------------------------------------
  app.post(
    "/api/documents/upload", 
    isAuthenticated, 
    uploadRateLimiter,
    upload.single("document"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
// -----------------------------------------
// CASE 0: Excel sheet upload (.xlsx / .csv)
// -----------------------------------------
if (
  file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  file.mimetype === "text/csv"
) {
  console.log("Excel file detected → parsing contacts...");
    let excelDocument: any = undefined;

    try {
    const buffer = fs.readFileSync(file.path);

    // Create a document record so the UI shows an upload card for Excel imports
    try {
      excelDocument = await storage.createDocument({
        userId,
        filename: file.filename,
        originalName: file.originalname || file.originalName || file.originalname || 'excel_upload',
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        status: 'processing',
        extractionProgress: 0,
      });
    } catch (e) {
      console.warn('Could not create document record for Excel import', e);
      excelDocument = undefined;
    }
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const createdContacts: any[] = [];

    // Fetch optional GitHub key for enrichment and current contacts for dedupe checks
    const githubKey = await storage
      .getApiKeyByService(userId, "github", "api_key")
      .catch(() => null);

    let existingContacts = await storage.getContacts(userId);

    for (const row of rows) {
      const name =
        row.name || row.Name || row.fullname || row.FullName || "Unknown";

      const email = row.email || row.Email || null;
      const phone = row.phone || row.Phone || null;
      const company = row.company || row.Company || null;
      const title = row.title || row.Title || null;
      const website = row.website || row.Website || null;

      // Build a minimal extracted object from the Excel row
      const extracted: any = {
        name,
        email,
        phone,
        company,
        title,
        websiteUrl: website,
        skills: row.skills || row.Skills || row.skill || null,
      };

      // Enrich the row (conservative to avoid aggressive name-only searches)
      const enriched = await enrichContact(extracted, githubKey?.encryptedValue, { conservative: true });

      // Check duplicates against existing contacts
      const possibleDuplicate = existingContacts.find((c) =>
        areLikelySamePerson(
          {
            name: enriched.name || extracted.name,
            email: enriched.email || extracted.email,
            githubUrl: enriched.githubUrl || extracted.githubUrl,
            linkedinUrl: enriched.linkedinUrl || extracted.linkedinUrl,
            websiteUrl: enriched.websiteUrl || extracted.websiteUrl,
          },
          {
            name: c.name,
            email: c.email,
            githubUrl: c.githubUrl,
            linkedinUrl: c.linkedinUrl,
            websiteUrl: c.websiteUrl,
          }
        )
      );

      const baseSources: any[] = [
        { source: "excel", url: "", verified: true },
        ...(enriched.sources || []),
      ];

      if (possibleDuplicate) {
        // merge sources and skills, update existing contact
        const mergedSources = mergeSources(
          (possibleDuplicate.sources as any[]) || [],
          baseSources
        );

        const incomingSkills = cleanSkills(enriched.skills || extracted.skills || []);
        const mergedSkills = mergeSkills(possibleDuplicate.skills || [], incomingSkills);

        const updated = await storage.updateContact(possibleDuplicate.id, userId, {
          name: possibleDuplicate.name || enriched.name || extracted.name || "Unknown",
          email: possibleDuplicate.email || enriched.email || extracted.email,
          phone: possibleDuplicate.phone || enriched.phone || extracted.phone,
          company: possibleDuplicate.company || enriched.company || extracted.company,
          title: possibleDuplicate.title || enriched.title || extracted.title,
          location: possibleDuplicate.location || enriched.location || extracted.location,
          skills: mergedSkills,
          linkedinUrl: possibleDuplicate.linkedinUrl || enriched.linkedinUrl || extracted.linkedinUrl,
          githubUrl: possibleDuplicate.githubUrl || enriched.githubUrl || extracted.githubUrl,
          websiteUrl: possibleDuplicate.websiteUrl || enriched.websiteUrl || extracted.websiteUrl || website,
          bio: possibleDuplicate.bio || enriched.bio || extracted.bio,
          confidenceScore: enriched.confidenceScore ?? possibleDuplicate.confidenceScore ?? 0.85,
          sources: mergedSources,
          enrichedData: { ...(possibleDuplicate.enrichedData as any), ...enriched },
          extractedData: { excelRow: row },
        });

        createdContacts.push(updated);
        // refresh existingContacts so subsequent rows can detect duplicates against the updated contact
        existingContacts = existingContacts.map((c) => (c.id === updated.id ? updated : c));
        continue;
      }

      // No duplicate → create
      const skillsClean = cleanSkills(enriched.skills || extracted.skills || []);

      const contact = await storage.createContact({
        userId,
        name: enriched.name || extracted.name || "Unknown",
        email: enriched.email || extracted.email,
        phone: enriched.phone || extracted.phone,
        company: enriched.company || extracted.company,
        title: enriched.title || extracted.title,
        location: enriched.location || extracted.location,
        skills: skillsClean,
        linkedinUrl: enriched.linkedinUrl || extracted.linkedinUrl,
        githubUrl: enriched.githubUrl || extracted.githubUrl,
        websiteUrl: enriched.websiteUrl || extracted.websiteUrl || website,
        bio: enriched.bio || extracted.bio,
        confidenceScore: enriched.confidenceScore ?? 0.85,
        sources: baseSources,
        extractedData: { excelRow: row },
        enrichedData: enriched,
        notes: "Imported from Excel",
      });

      createdContacts.push(contact);
      existingContacts.push(contact);
    }

    // Mark document as completed (if created) so the client shows it as processed
    try {
      if (excelDocument && excelDocument.id) {
        await storage.updateDocument(excelDocument.id, userId, {
          status: 'completed',
          extractionProgress: 100,
        });
      }
    } catch (e) {
      console.warn('Failed to update excel document status:', e);
    }

    return res.json({
      success: true,
      document: excelDocument,
      contactsCreated: createdContacts.length,
      contacts: createdContacts,
    });
  } catch (err) {
    console.error("Excel import failed:", err);
    // mark document failed if we created one
    try {
      if (typeof excelDocument !== 'undefined' && excelDocument && excelDocument.id) {
        await storage.updateDocument(excelDocument.id, userId, {
          status: 'failed',
          extractionProgress: 0,
        });
      }
    } catch (e) {
      console.warn('Failed to mark excel document as failed:', e);
    }

    return res.status(500).json({ message: "Failed to import Excel file" });
  }
}
    
        // CASE 1: ZIP file → extract & process each file
        if (
          file.mimetype === "application/zip" || 
          file.mimetype === "application/x-zip-compressed"
        ) {
          console.log("ZIP file detected, extracting...");

          const zip = new AdmZip(file.path);
          const entries = zip.getEntries();
          const extractedDocuments: any[] = [];

          for (const entry of entries) {
            if (entry.isDirectory) continue;

            const nameLower = entry.entryName.toLowerCase();
            const allowed = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".txt"];
            if (!allowed.some(a => nameLower.endsWith(a))) continue;

            const outputPath = path.join(
              uploadDir, 
              `${Date.now()}-${path.basename(entry.entryName)}`
            );

            fs.writeFileSync(outputPath, entry.getData());
            const stat = fs.statSync(outputPath);

            const mimeType =
              mime.lookup(outputPath) ||
              (outputPath.endsWith(".docx")
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "");

            const doc = await storage.createDocument({
              userId,
              filename: path.basename(outputPath),
              originalName: entry.entryName,
              mimeType,
              fileSize: stat.size,
              filePath: outputPath,
              status: "processing",
              extractionProgress: 0,
            });

            extractedDocuments.push(doc);

            // Queue + retry extraction
            limit(() =>
              retry(() =>
                processDocumentExtraction(
                  doc.id,
                  userId,
                  outputPath,
                  mimeType || ""
                ),
                3,
                1500
              )
            );
          }

          return res.json({
            success: true,
            extractedFiles: extractedDocuments.length,
            documents: extractedDocuments,
          });
        }

        // CASE 2: Single normal file
        const document = await storage.createDocument({
          userId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
          status: "processing",
          extractionProgress: 0,
        });

        processDocumentExtraction(
          document.id, 
          userId, 
          file.path, 
          file.mimetype
        );

        res.json({ documentId: document.id, status: "processing" });
      } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    }
  );

  app.get(
    "/api/documents", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documents = await storage.getDocuments(userId);
        res.json(documents);
      } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ message: "Failed to fetch documents" });
      }
    }
  );

  app.delete(
    "/api/documents/:id", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await storage.deleteDocument(req.params.id, userId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ message: "Failed to delete document" });
      }
    }
  );

  // Extraction jobs
  app.get(
    "/api/extraction-jobs", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const jobs = await storage.getExtractionJobs(userId);
        res.json(jobs);
      } catch (error) {
        console.error("Error fetching extraction jobs:", error);
        res.status(500).json({ message: "Failed to fetch extraction jobs" });
      }
    }
  );

  app.get(
    "/api/extraction-jobs/:id", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const job = await storage.getExtractionJob(req.params.id, userId);
        if (!job) {
          return res.status(404).json({ message: "Extraction job not found" });
        }
        res.json(job);
      } catch (error) {
        console.error("Error fetching extraction job:", error);
        res.status(500).json({ message: "Failed to fetch extraction job" });
      }
    }
  );

  // -------------------------------------
  // EXPORT ROUTES (user scope)
  // -------------------------------------
  app.post(
    "/api/contacts/export/vcard", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        // const { contactIds } = req.body; // TODO: filter subset if needed
        const vCardData = "BEGIN:VCARD\nVERSION:3.0\nEND:VCARD";
        
        res.setHeader("Content-Type", "text/vcard");
        res.setHeader(
          "Content-Disposition", 
          'attachment; filename="contacts.vcf"'
        );
        res.send(vCardData);
      } catch (error) {
        console.error("Error exporting vCard:", error);
        res.status(500).json({ message: "Failed to export vCard" });
      }
    }
  );

  app.post(
    "/api/contacts/export/csv", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contacts = await storage.getContacts(userId);
        
        const headers = [
          "Name", "Email", "Phone", "Company", "Title", "Location", 
          "Bio", "Skills", "LinkedIn URL", "GitHub URL", "ORCID URL", "Website URL",
          "Confidence Score", "Data Sources", "Created At"
        ];
        
        const rows = contacts.map(c => [
          c.name || "",
          c.email || "",
          c.phone || "",
          c.company || "",
          c.title || "",
          c.location || "",
          c.bio || "",
          (c.skills || []).join("; "),
          c.linkedinUrl || "",
          c.githubUrl || "",
          c.orcidUrl || "",
          c.websiteUrl || "",
          c.confidenceScore ? `${(c.confidenceScore * 100).toFixed(0)}%` : "",
          ((c.enrichedData as any)?.sources || [])
            .map((s: any) => s.source)
            .join(", "),
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
        ]);
        
        const csv = [headers, ...rows]
          .map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          )
          .join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition", 
          'attachment; filename="contacts.csv"'
        );
        res.send(csv);
      } catch (error) {
        console.error("Error exporting CSV:", error);
        res.status(500).json({ message: "Failed to export CSV" });
      }
    }
  );

  app.post(
    "/api/contacts/export/excel", 
    isAuthenticated, 
    apiRateLimiter,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const contacts = await storage.getContacts(userId);
        
        const worksheetData: any[] = [];
        
        worksheetData.push([
          "Name", "Email", "Phone", "Company", "Title", "Location", 
          "Bio", "Skills", "LinkedIn URL", "GitHub URL", "ORCID URL", "Website URL",
          "Confidence Score", "Data Sources", "GitHub Repos", "Created At"
        ]);
        
        contacts.forEach(c => {
          const enrichedData = c.enrichedData as any;
          const sources = enrichedData?.sources || [];
          const repositories = enrichedData?.repositories || [];
          
          worksheetData.push([
            c.name || "",
            c.email || "",
            c.phone || "",
            c.company || "",
            c.title || "",
            c.location || "",
            c.bio || "",
            (c.skills || []).join(", "),
            c.linkedinUrl || "",
            c.githubUrl || "",
            c.orcidUrl || "",
            c.websiteUrl || "",
            c.confidenceScore ? `${(c.confidenceScore * 100).toFixed(0)}%` : "",
            sources.map((s: any) => s.source).join(", "),
            repositories.length > 0 
              ? repositories.slice(0, 3).map((r: any) => r.name).join(", ") 
              : "",
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
          ]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const columnWidths = [
          { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
          { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 25 },
          { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 12 }
        ];
        (worksheet as any)["!cols"] = columnWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
        
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        
        res.setHeader(
          "Content-Type", 
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition", 
          'attachment; filename="contacts.xlsx"'
        );
        res.send(excelBuffer);
      } catch (error) {
        console.error("Error exporting Excel:", error);
        res.status(500).json({ message: "Failed to export Excel" });
      }
    }
  );

  // -------------------------------------
  // ADMIN ROUTES
  // -------------------------------------
  app.get(
  "/api/admin/status",
  isAuthenticated,
  apiRateLimiter,
  async (req: any, res) => {
    try {
      const user = req.user;
      const userEmail = user.email || (req.session as any)?.user?.email;
      
      // Check if user is admin
      const adminStatus = {
        isAdmin: isAdmin(userEmail),
        email: userEmail,
      };
      
      res.json(adminStatus);
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ message: "Failed to check admin status" });
    }
  }
);

  app.get(
    "/api/admin/contacts", 
    isAuthenticated, 
    requireAdmin, 
    adminRateLimiter,
    async (req: any, res) => {
      try {
        const allContacts = await db.select().from(contacts);

        const contactsWithUsers = await Promise.all(
          allContacts.map(async (contact) => {
            const [user] = await db
              .select({
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(users)
              .where(eq(users.id, contact.userId));

            return {
              ...contact,
              userInfo: user || { email: "Unknown", firstName: "", lastName: "" },
            };
          })
        );

        res.json(contactsWithUsers);
      } catch (error) {
        console.error("Error fetching all contacts:", error);
        res.status(500).json({ message: "Failed to fetch all contacts" });
      }
    }
  );
  
    app.delete(
      "/api/admin/contacts/:id",
      isAuthenticated,
      requireAdmin,
      adminRateLimiter,
      async (req: any, res) => {
        try {
          const contactId = req.params.id as string;

          // Optional: log security event
          logSecurityEvent(SecurityEventType.RESOURCE_DELETED, req, {
            resourceType: "contact",
            resourceId: contactId,
            scope: "admin",
          });

          await db.delete(contacts).where(eq(contacts.id, contactId));

          return res.json({ success: true });
        } catch (error) {
          console.error("Error deleting contact as admin:", error);
          res.status(500).json({ message: "Failed to delete contact" });
        }
      }
    );

    app.patch(
      "/api/admin/contacts/:id",
      isAuthenticated,
      requireAdmin,
      adminRateLimiter,
      async (req: any, res) => {
        try {
          const contactId = req.params.id;
          const updates = req.body;

          const updated = await db
            .update(contacts)
            .set(updates)
            .where(eq(contacts.id, contactId))
            .returning();

          res.json(updated[0]);

        } catch (error) {
          console.error("Admin update failed:", error);
          res.status(500).json({ message: "Failed to update contact" });
        }
      }
    );

  app.post(
    "/api/admin/contacts/search", 
    isAuthenticated, 
    requireAdmin, 
    adminRateLimiter,
    validateRequest(searchSchema),
    async (req: any, res) => {
      try {
        const adminUserId = req.user.claims.sub;
        const { query } = req.body;

        const geminiKey = await storage.getApiKeyByService(
          adminUserId, 
          "gemini", 
          "api_key"
        );
        if (!geminiKey) {
          return res.status(400).json({ 
            message: "Gemini API key not configured. Please add it in your profile." 
          });
        }

        const allContacts = await db.select().from(contacts);
        const results = await semanticSearchContacts(
          query, 
          allContacts, 
          geminiKey.encryptedValue
        );
        
        const resultsWithUsers = await Promise.all(
          results.map(async (contact: any) => {
            const [user] = await db
              .select({
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(users)
              .where(eq(users.id, contact.userId));

            return {
              ...contact,
              userInfo: user || { email: "Unknown", firstName: "", lastName: "" },
            };
          })
        );

        res.json(resultsWithUsers);
      } catch (error) {
        console.error("Error searching all contacts:", error);
        res.status(500).json({ message: "Failed to search contacts" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}

// -----------------------------------------
// Background task processing
// -----------------------------------------
async function processDocumentExtraction(
  documentId: string, 
  userId: string, 
  filePath: string, 
  mimeType: string
) {
  try {
    await storage.updateDocument(documentId, userId, {
      status: "processing",
      extractionProgress: 25,
    });

    const geminiKey = await storage.getApiKeyByService(
      userId, 
      "gemini", 
      "api_key"
    );
    if (!geminiKey) {
      throw new Error("Gemini API key not configured. Please add it in your profile.");
    }

    const extractedData = await extractContactFromDocument(
      filePath, 
      mimeType, 
      geminiKey.encryptedValue
    );

    await storage.updateDocument(documentId, userId, {
      extractionProgress: 50,
    });

    const githubKey = await storage
      .getApiKeyByService(userId, "github", "api_key")
      .catch(() => null);

    const hfKey = await storage
      .getApiKeyByService(userId, "huggingface", "api_key")
      .catch(() => null);

    console.log("Starting multi-source enrichment...");
    const enrichedData = await enrichContact(
      extractedData,
      githubKey?.encryptedValue,
      { conservative: mimeType.startsWith("image/") }
    );

    await storage.updateDocument(documentId, userId, {
      extractionProgress: 75,
    });

    let isDuplicate = false;
    let duplicateId: string | undefined = undefined;

    if (hfKey && hfKey.encryptedValue) {
      const existingContacts = await storage.getContacts(userId);
      const dedupeResult = await deduplicateContactData(
        enrichedData,
        existingContacts,
        hfKey.encryptedValue
      );

      isDuplicate = dedupeResult.isDuplicate;
      duplicateId = dedupeResult.duplicateId;
      
      if (isDuplicate && duplicateId) {
        console.log(`Duplicate contact detected: ${duplicateId}. Merging data...`);
        const existing = await storage.getContact(duplicateId, userId);
        if (existing) {
          const existingSources = Array.isArray(existing.sources) 
            ? existing.sources 
            : [];
          const newSources = Array.isArray(enrichedData.sources) 
            ? enrichedData.sources 
            : [];
          const mergedSources = [...existingSources, ...newSources];
          const existingEnriched = 
            existing.enrichedData && typeof existing.enrichedData === "object" 
              ? existing.enrichedData 
              : {};
          await storage.updateContact(duplicateId, userId, {
            sources: mergedSources,
            enrichedData: { ...existingEnriched, ...enrichedData }
          });
        }
        
        await storage.updateDocument(documentId, userId, {
          status: "completed",
          extractionProgress: 100,
        });
        
        console.log(`Updated existing contact ${duplicateId} with new data`);
        return;
      }
    }

    let confidenceScore = enrichedData.confidenceScore || 0.85;
    if (hfKey && hfKey.encryptedValue) {
      confidenceScore = await improveConfidenceScore(
        extractedData,
        enrichedData,
        enrichedData.sources,
        hfKey.encryptedValue
      );
    } else {
      console.log("HuggingFace API key not configured - using basic confidence scoring");
    }

    await storage.createContact({
      userId,
      name: enrichedData.name || "Unknown",
      email: enrichedData.email,
      phone: enrichedData.phone,
      company: enrichedData.company,
      title: enrichedData.title,
      location: enrichedData.location,
      skills: cleanSkills(enrichedData.skills) || [],
      linkedinUrl: enrichedData.linkedinUrl,
      githubUrl: enrichedData.githubUrl,
      websiteUrl: enrichedData.websiteUrl,
      bio: enrichedData.bio,
      confidenceScore,
      sources: enrichedData.sources,
      extractedData,
      enrichedData,
    });

    await storage.updateDocument(documentId, userId, {
      status: "completed",
      extractionProgress: 100,
    });

    console.log(`Successfully extracted contact from document ${documentId}`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    await storage.updateDocument(documentId, userId, {
      status: "failed",
    });
  }
}