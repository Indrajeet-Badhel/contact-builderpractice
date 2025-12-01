import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import multer from "multer";
import path from "path";
import { extractContactFromDocument, semanticSearchContacts, extractContactFromWebsite} from "./gemini";
import { enrichContact } from "./enrichment";
import { deduplicateContactData, improveConfidenceScore } from "./huggingface";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

function normalizeString(value?: string | null): string {
  return (value || "").toLowerCase().trim();
}

function normalizeUrl(value?: string | null): string {
  if (!value) return "";
  try {
    const u = new URL(value);
    // ignore trailing slashes & query for dedupe purposes
    return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return value.toLowerCase().trim();
  }
}

/**
 * Normalize a name for comparison (lowercase, remove extra spaces, punctuation)
 */
function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ") // normalize spaces
    .trim();
}

/**
 * Calculate similarity between two strings (0-1 score)
 * Simple Levenshtein-based similarity
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
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

/**
 * Enhanced duplicate detection with multiple strategies
 */
function findDuplicateContact(
  newContact: any,
  existingContacts: any[]
): any | null {
  
  // Strategy 1: Exact URL matches (highest priority)
  for (const existing of existingContacts) {
    // Check GitHub URL
    if (newContact.githubUrl && existing.githubUrl) {
      const newGh = normalizeUrl(newContact.githubUrl);
      const existingGh = normalizeUrl(existing.githubUrl);
      if (newGh && existingGh && newGh === existingGh) {
        console.log(`Duplicate found via GitHub URL: ${existing.id}`);
        return existing;
      }
    }
    
    // Check LinkedIn URL
    if (newContact.linkedinUrl && existing.linkedinUrl) {
      const newLi = normalizeUrl(newContact.linkedinUrl);
      const existingLi = normalizeUrl(existing.linkedinUrl);
      if (newLi && existingLi && newLi === existingLi) {
        console.log(`Duplicate found via LinkedIn URL: ${existing.id}`);
        return existing;
      }
    }
    
    // Check ORCID URL
    if (newContact.orcidUrl && existing.orcidUrl) {
      const newOrcid = normalizeUrl(newContact.orcidUrl);
      const existingOrcid = normalizeUrl(existing.orcidUrl);
      if (newOrcid && existingOrcid && newOrcid === existingOrcid) {
        console.log(`Duplicate found via ORCID URL: ${existing.id}`);
        return existing;
      }
    }
    
    // Check Email (exact match)
    if (newContact.email && existing.email) {
      const newEmail = normalizeString(newContact.email);
      const existingEmail = normalizeString(existing.email);
      if (newEmail && existingEmail && newEmail === existingEmail) {
        console.log(`Duplicate found via Email: ${existing.id}`);
        return existing;
      }
    }
  }
  
  // Strategy 2: Name similarity + partial URL match
  const newName = normalizeName(newContact.name);
  if (!newName) return null;
  
  for (const existing of existingContacts) {
    const existingName = normalizeName(existing.name);
    if (!existingName) continue;
    
    // Check if names are very similar (>0.85 similarity)
    const nameSim = stringSimilarity(newName, existingName);
    
    if (nameSim > 0.85) {
      // If names are similar, check if there's any URL overlap
      const hasUrlOverlap = (
        (newContact.githubUrl && existing.githubUrl) ||
        (newContact.linkedinUrl && existing.linkedinUrl) ||
        (newContact.websiteUrl && existing.websiteUrl)
      );
      
      // If names match closely and we have URL overlap, it's likely the same person
      if (hasUrlOverlap) {
        console.log(`Duplicate found via name similarity (${nameSim.toFixed(2)}) + URL overlap: ${existing.id}`);
        return existing;
      }
      
      // If names match very closely (>0.95) and same company, likely duplicate
      if (nameSim > 0.95 && newContact.company && existing.company) {
        const companySim = stringSimilarity(
          normalizeString(newContact.company),
          normalizeString(existing.company)
        );
        if (companySim > 0.8) {
          console.log(`Duplicate found via name (${nameSim.toFixed(2)}) + company (${companySim.toFixed(2)}): ${existing.id}`);
          return existing;
        }
      }
    }
  }
  
  // Strategy 3: Same email domain + similar name (for corporate emails)
  if (newContact.email) {
    const newEmailDomain = newContact.email.split('@')[1]?.toLowerCase();
    
    for (const existing of existingContacts) {
      if (!existing.email) continue;
      
      const existingEmailDomain = existing.email.split('@')[1]?.toLowerCase();
      
      if (newEmailDomain && existingEmailDomain && newEmailDomain === existingEmailDomain) {
        const nameSim = stringSimilarity(
          normalizeName(newContact.name),
          normalizeName(existing.name)
        );
        
        if (nameSim > 0.8) {
          console.log(`Duplicate found via email domain + name similarity: ${existing.id}`);
          return existing;
        }
      }
    }
  }
  
  return null;
}

function areLikelySamePerson(a: any, b: any): boolean {
  // Use the new enhanced detection
  const result = findDuplicateContact(a, [b]);
  return result !== null;
}

function mergeSources(
  existing: any[] = [],
  incoming: any[] = []
): any[] {
  const merged = [...existing];
  const seen = new Set(
    existing.map((s) => `${s.source}:${s.url || ""}`)
  );

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
  | 'github'
  | 'orcid'
  | 'stackoverflow'
  | 'gitlab'
  | 'devto'
  | 'linkedin'
  | 'website'
  | 'unknown' {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host === 'github.com') return 'github';
    if (host === 'orcid.org') return 'orcid';
    if (host === 'stackoverflow.com' || host.endsWith('.stackexchange.com')) return 'stackoverflow';
    if (host === 'gitlab.com') return 'gitlab';
    if (host === 'dev.to') return 'devto';
    if (host === 'www.linkedin.com' || host === 'linkedin.com') return 'linkedin';

    // everything else – treat as generic website
    return 'website';
  } catch {
    return 'unknown';
  }
}

// File upload configuration
const uploadDir = path.join(process.cwd(), "uploads");
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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
  });

  // Contact routes
  app.get('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contact = await storage.getContact(req.params.id, userId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contact = await storage.createContact({
        userId,
        ...req.body
      });
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contact = await storage.updateContact(req.params.id, userId, req.body);
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteContact(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post('/api/contacts/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query is required" });
      }

      // Get Gemini API key
      const geminiKey = await storage.getApiKeyByService(userId, 'gemini', 'api_key');
      if (!geminiKey) {
        return res.status(400).json({ message: "Gemini API key not configured. Please add it in your profile." });
      }

      // Get all contacts first
      const allContacts = await storage.getContacts(userId);
      
      // Use AI-powered semantic search
      const results = await semanticSearchContacts(query, allContacts, geminiKey.encryptedValue);
      res.json(results);
    } catch (error) {
      console.error("Error searching contacts:", error);
      res.status(500).json({ message: "Failed to search contacts" });
    }
  });

  // Document upload and extraction routes
  app.post('/api/documents/upload', isAuthenticated, upload.single('document'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Create document record
      const document = await storage.createDocument({
        userId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        status: 'processing',
        extractionProgress: 0,
      });

      // Start extraction process asynchronously
      processDocumentExtraction(document.id, userId, file.path, file.mimetype);

      res.json({ documentId: document.id, status: 'processing' });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getDocuments(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteDocument(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // API Keys routes
  app.get('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getApiKeys(userId);
      
      // Never send actual encrypted values to client
      const safeKeys = keys.map(k => ({
        ...k,
        encryptedValue: undefined
      }));
      
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { service, keyName, encryptedValue } = req.body;

      if (!service || !keyName || !encryptedValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if key already exists
      const existing = await storage.getApiKeyByService(userId, service, keyName);
      
      let apiKey;
      if (existing) {
        // Update existing key
        apiKey = await storage.updateApiKey(existing.id, userId, {
          encryptedValue,
          lastValidated: new Date(),
        });
      } else {
        // Create new key
        apiKey = await storage.createApiKey({
          userId,
          service,
          keyName,
          encryptedValue,
          isValid: true,
        });
      }

      res.json({ ...apiKey, encryptedValue: undefined });
    } catch (error) {
      console.error("Error saving API key:", error);
      res.status(500).json({ message: "Failed to save API key" });
    }
  });

  app.post('/api/api-keys/:id/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apiKey = await storage.getApiKey(req.params.id, userId);
      
      if (!apiKey) {
        return res.status(404).json({ message: "API key not found" });
      }

      // Update last validated timestamp
      await storage.updateApiKey(apiKey.id, userId, {
        lastValidated: new Date(),
        isValid: true,
      });

      res.json({ valid: true });
    } catch (error) {
      console.error("Error testing API key:", error);
      res.status(500).json({ message: "Failed to test API key" });
    }
  });

  app.delete('/api/api-keys/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteApiKey(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Extraction Jobs routes
  app.get('/api/extraction-jobs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobs = await storage.getExtractionJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching extraction jobs:", error);
      res.status(500).json({ message: "Failed to fetch extraction jobs" });
    }
  });

  app.get('/api/extraction-jobs/:id', isAuthenticated, async (req: any, res) => {
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
  });

  // Export contacts routes
  app.post('/api/contacts/export/vcard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contactIds } = req.body;
      
      // Generate vCard format
      // This is a simplified version - real implementation would use vcard library
      const vCardData = "BEGIN:VCARD\nVERSION:3.0\nEND:VCARD";
      
      res.setHeader('Content-Type', 'text/vcard');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.vcf"');
      res.send(vCardData);
    } catch (error) {
      console.error("Error exporting vCard:", error);
      res.status(500).json({ message: "Failed to export vCard" });
    }
  });

  app.post('/api/contacts/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getContacts(userId);
      
      // Generate comprehensive CSV with all fields
      const headers = [
        'Name', 'Email', 'Phone', 'Company', 'Title', 'Location', 
        'Bio', 'Skills', 'LinkedIn URL', 'GitHub URL', 'ORCID URL', 'Website URL',
        'Confidence Score', 'Data Sources', 'Created At'
      ];
      
      const rows = contacts.map(c => [
        c.name || '',
        c.email || '',
        c.phone || '',
        c.company || '',
        c.title || '',
        c.location || '',
        c.bio || '',
        (c.skills || []).join('; '),
        c.linkedinUrl || '',
        c.githubUrl || '',
        c.orcidUrl || '',
        c.websiteUrl || '',
        c.confidenceScore ? `${(c.confidenceScore * 100).toFixed(0)}%` : '',
        ((c.enrichedData as any)?.sources || []).map((s: any) => s.source).join(', '),
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
      ]);
      
      const csv = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  app.post('/api/contacts/export/excel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getContacts(userId);
      
      const worksheetData = [];
      
      worksheetData.push([
        'Name', 'Email', 'Phone', 'Company', 'Title', 'Location', 
        'Bio', 'Skills', 'LinkedIn URL', 'GitHub URL', 'ORCID URL', 'Website URL',
        'Confidence Score', 'Data Sources', 'GitHub Repos', 'Created At'
      ]);
      
      contacts.forEach(c => {
        const enrichedData = c.enrichedData as any;
        const sources = enrichedData?.sources || [];
        const repositories = enrichedData?.repositories || [];
        
        worksheetData.push([
          c.name || '',
          c.email || '',
          c.phone || '',
          c.company || '',
          c.title || '',
          c.location || '',
          c.bio || '',
          (c.skills || []).join(', '),
          c.linkedinUrl || '',
          c.githubUrl || '',
          c.orcidUrl || '',
          c.websiteUrl || '',
          c.confidenceScore ? `${(c.confidenceScore * 100).toFixed(0)}%` : '',
          sources.map((s: any) => s.source).join(', '),
          repositories.length > 0 ? repositories.slice(0, 3).map((r: any) => r.name).join(', ') : '',
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
        ]);
      });
      
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      const columnWidths = [
        { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 25 },
        { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 12 }
      ];
      worksheet['!cols'] = columnWidths;
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
      
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.xlsx"');
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      res.status(500).json({ message: "Failed to export Excel" });
    }
  });

  // Create / enrich a contact from a URL (GitHub, ORCID, etc.)
    // Create / enrich a contact from a URL (GitHub, ORCID, etc.)
  app.post("/api/contacts/from-url", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      // get Gemini key
      const geminiKey = await storage.getApiKeyByService(
        userId,
        "gemini",
        "api_key"
      );
      if (!geminiKey) {
        return res.status(400).json({
          message:
            "Gemini API key not configured. Please add it in your profile.",
        });
      }

      // 1) extract from website
      const extracted = await extractContactFromWebsite(
        url,
        geminiKey.encryptedValue
      );

      // 2) optional enrichment (GitHub, ORCID, etc.)
      const githubKey = await storage
        .getApiKeyByService(userId, "github", "api_key")
        .catch(() => null);
      const enriched = await enrichContact(
        extracted,
        githubKey?.encryptedValue,
        {
          conservative: true, // we’re already using a specific URL, be safer
        }
      );

      // 3) check for duplicates FIRST
      const existingContacts = await storage.getContacts(userId);

      // (A) find by email / GitHub / name using heuristic
      const possibleDuplicate = existingContacts.find((c) =>
        areLikelySamePerson(
          {
            name: enriched.name || extracted.name,
            email: enriched.email || extracted.email,
            githubUrl: enriched.githubUrl || extracted.githubUrl,
          },
          {
            name: c.name,
            email: c.email,
            githubUrl: c.githubUrl,
          }
        )
      );

      // if you also want to use HF dedupe here, you can add something like:
      // const hfKey = await storage.getApiKeyByService(userId, "huggingface", "api_key").catch(() => null);
      // and call deduplicateContactData(enriched, existingContacts, hfKey.encryptedValue)
      // then pick duplicateId from that result instead of / in addition to possibleDuplicate.

      const baseSources: any[] = [
        { source: "website", url, verified: false },
        ...(enriched.sources || []),
      ];

      if (possibleDuplicate) {
        // 4) merge into existing contact
        const mergedSources = mergeSources(
          (possibleDuplicate.sources as any[]) || [],
          baseSources
        );

        const mergedSkills = mergeSkills(
          possibleDuplicate.skills || [],
          enriched.skills || extracted.skills || []
        );

        const updated = await storage.updateContact(
          possibleDuplicate.id,
          userId,
          {
            name:
              possibleDuplicate.name ||
              enriched.name ||
              extracted.name ||
              "Unknown",
            email:
              possibleDuplicate.email ||
              enriched.email ||
              extracted.email,
            phone:
              possibleDuplicate.phone ||
              enriched.phone ||
              extracted.phone,
            company:
              possibleDuplicate.company ||
              enriched.company ||
              extracted.company,
            title:
              possibleDuplicate.title ||
              enriched.title ||
              extracted.title,
            location:
              possibleDuplicate.location ||
              enriched.location ||
              extracted.location,
            skills: mergedSkills,
            linkedinUrl:
              possibleDuplicate.linkedinUrl ||
              enriched.linkedinUrl ||
              extracted.linkedinUrl,
            githubUrl:
              possibleDuplicate.githubUrl ||
              enriched.githubUrl ||
              extracted.githubUrl,
            websiteUrl:
              possibleDuplicate.websiteUrl ||
              enriched.websiteUrl ||
              extracted.websiteUrl ||
              url,
            bio:
              possibleDuplicate.bio ||
              enriched.bio ||
              extracted.bio,
            confidenceScore:
              enriched.confidenceScore ??
              possibleDuplicate.confidenceScore ??
              0.85,
            sources: mergedSources,
            // keep old enrichedData but merge in new details
            enrichedData: {
              ...(possibleDuplicate.enrichedData as any),
              ...enriched,
            },
            // we could also store latest extractedData if you want
            extractedData: extracted,
          }
        );

        return res.json(updated);
      }

      // 5) no duplicate → create a brand new contact
      const contact = await storage.createContact({
        userId,
        name: enriched.name || extracted.name || "Unknown",
        email: enriched.email || extracted.email,
        phone: enriched.phone || extracted.phone,
        company: enriched.company || extracted.company,
        title: enriched.title || extracted.title,
        location: enriched.location || extracted.location,
        skills: enriched.skills || extracted.skills || [],
        linkedinUrl: enriched.linkedinUrl || extracted.linkedinUrl,
        githubUrl: enriched.githubUrl || extracted.githubUrl,
        websiteUrl: enriched.websiteUrl || extracted.websiteUrl || url,
        bio: enriched.bio || extracted.bio,
        confidenceScore: enriched.confidenceScore ?? 0.85,
        sources: baseSources,
        extractedData: extracted,
        enrichedData: enriched,
      });

      res.json(contact);
    } catch (err: any) {
      console.error("Error creating contact from URL:", err);
      const message =
        err?.message || "Failed to create contact from URL";
      res.status(500).json({ message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background task to process document extraction
async function processDocumentExtraction(documentId: string, userId: string, filePath: string, mimeType: string) {
  try {
    // Update document status
    await storage.updateDocument(documentId, userId, {
      status: 'processing',
      extractionProgress: 25,
    });

    // Get Gemini API key
    const geminiKey = await storage.getApiKeyByService(userId, 'gemini', 'api_key');
    if (!geminiKey) {
      throw new Error("Gemini API key not configured. Please add it in your profile.");
    }

    // Extract contact data using Gemini AI
    const extractedData = await extractContactFromDocument(filePath, mimeType, geminiKey.encryptedValue);

    // Update progress
    await storage.updateDocument(documentId, userId, {
      extractionProgress: 50,
    });

    // Get optional API keys for enrichment
    const githubKey = await storage.getApiKeyByService(userId, 'github', 'api_key').catch(() => null);
    const hfKey = await storage.getApiKeyByService(userId, 'huggingface', 'api_key').catch(() => null);

    // Enrich contact data from multiple sources (GitHub, ORCID, etc.)
    console.log('Starting multi-source enrichment...');
    const enrichedData = await enrichContact(
      extractedData,
      githubKey?.encryptedValue,
      {
        conservative: mimeType.startsWith("image/"),
      }
    );

    // Update progress
    await storage.updateDocument(documentId, userId, {
      extractionProgress: 75,
    });

    // Check for duplicates using HuggingFace if API key is available
    let isDuplicate = false;
    let duplicateId = undefined;
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
        // Update existing contact with new sources instead of creating duplicate
        const existing = await storage.getContact(duplicateId, userId);
        if (existing) {
          const existingSources = Array.isArray(existing.sources) ? existing.sources : [];
          const newSources = Array.isArray(enrichedData.sources) ? enrichedData.sources : [];
          const mergedSources = [...existingSources, ...newSources];
          const existingEnriched = existing.enrichedData && typeof existing.enrichedData === 'object' ? existing.enrichedData : {};
          await storage.updateContact(duplicateId, userId, {
            sources: mergedSources,
            enrichedData: { ...existingEnriched, ...enrichedData }
          });
        }
        
        await storage.updateDocument(documentId, userId, {
          status: 'completed',
          extractionProgress: 100,
        });
        
        console.log(`Updated existing contact ${duplicateId} with new data`);
        return;
      }
    }

    // Calculate improved confidence score using HuggingFace if available
    let confidenceScore = enrichedData.confidenceScore || 0.85;
    if (hfKey && hfKey.encryptedValue) {
      confidenceScore = await improveConfidenceScore(
        extractedData,
        enrichedData,
        enrichedData.sources,
        hfKey.encryptedValue
      );
    } else {
      console.log('HuggingFace API key not configured - using basic confidence scoring');
    }

    // Create contact from enriched data
    const contact = await storage.createContact({
      userId,
      name: enrichedData.name || 'Unknown',
      email: enrichedData.email,
      phone: enrichedData.phone,
      company: enrichedData.company,
      title: enrichedData.title,
      location: enrichedData.location,
      skills: enrichedData.skills || [],
      linkedinUrl: enrichedData.linkedinUrl,
      githubUrl: enrichedData.githubUrl,
      websiteUrl: enrichedData.websiteUrl,
      bio: enrichedData.bio,
      confidenceScore: confidenceScore,
      sources: enrichedData.sources,
      extractedData: extractedData,
      enrichedData: enrichedData,
    });

    // Update document as completed
    await storage.updateDocument(documentId, userId, {
      status: 'completed',
      extractionProgress: 100,
    });

    console.log(`Successfully extracted contact from document ${documentId}`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    await storage.updateDocument(documentId, userId, {
      status: 'failed',
    });
  }
}
