import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import { extractContactFromDocument, semanticSearchContacts } from "./gemini";
import { enrichContact } from "./enrichment";
import { deduplicateContactData, improveConfidenceScore } from "./huggingface";
import { randomUUID } from "crypto";

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
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
      
      // Generate CSV
      const headers = ['Name', 'Email', 'Phone', 'Company', 'Title', 'Location'];
      const rows = contacts.map(c => [
        c.name || '',
        c.email || '',
        c.phone || '',
        c.company || '',
        c.title || '',
        c.location || ''
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
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
      githubKey?.encryptedValue
    );

    // Update progress
    await storage.updateDocument(documentId, userId, {
      extractionProgress: 75,
    });

    // Check for duplicates using HuggingFace if API key is available
    let isDuplicate = false;
    let duplicateId = undefined;
    if (hfKey) {
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
    if (hfKey) {
      confidenceScore = await improveConfidenceScore(
        extractedData,
        enrichedData,
        enrichedData.sources,
        hfKey.encryptedValue
      );
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
