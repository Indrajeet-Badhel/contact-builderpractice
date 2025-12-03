// server/gemini.ts
import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import mammoth from "mammoth";
import puppeteer from "puppeteer";
import mime from "mime-types";

export interface ExtractedContactData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  location?: string;
  skills?: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  bio?: string;
  education?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    duration?: string;
  }>;
}

/** ---------- Utilities ---------- */

async function convertDocxToPdf(docxPath: string): Promise<string> {
  const outPath = docxPath.replace(/\.docx$/i, "") + ".converted.pdf";

  try {
    const html = (await mammoth.convertToHtml({ path: docxPath })).value;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: outPath, format: "A4" });
    await browser.close();

    console.log("DOCX → PDF conversion successful:", outPath);
    return outPath;
  } catch (err) {
    console.warn("DOCX conversion failed (falling back to original):", err);
    return docxPath;
  }
}

async function withRetries<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialWait = 1000
): Promise<T> {
  let attempt = 0;
  let wait = initialWait;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      if (attempt >= retries) throw err;
      console.warn(`Attempt ${attempt} failed. Retrying in ${wait}ms.`, err?.message || err);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 1.8; // exponential-ish backoff
    }
  }
}

/** ---------- Main functions ---------- */

/**
 * Extract structured contact data from a file (PDF/DOCX/image/text).
 * Ensures MIME detection and DOCX → PDF conversion for Gemini stability.
 */
export async function extractContactFromDocument(
  documentPath: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedContactData> {
  if (!apiKey) throw new Error("Gemini API key required");

  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1) Detect mime if missing
    let detectedMime = mimeType || mime.lookup(documentPath) || "";
    if (!detectedMime) {
      // If extension implies docx, set that; otherwise default to pdf (safer)
      if (documentPath.endsWith(".docx")) {
        detectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else {
        detectedMime = "application/pdf";
      }
      console.warn("Detected/forced MIME:", detectedMime);
    }

    // 2) If docx -> convert to PDF for compatibility
    let pathToSend = documentPath;
    if (/\.docx$/i.test(documentPath)) {
      pathToSend = await convertDocxToPdf(documentPath);
      detectedMime = "application/pdf";
    }

    // 3) Read file bytes
    const fileBytes = fs.readFileSync(pathToSend);

    const systemPrompt = `You are an expert at extracting structured contact information from documents.
Return valid JSON only. Fields to extract (if present): name, email, phone, company, title, location, skills (array),
linkedinUrl, githubUrl, websiteUrl, bio, education (array), experience (array of {company,title,duration}).`;

    // 4) Wrap the call in retries (Gemini Free/unstable can return intermittent errors)
    const response = await withRetries(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: fileBytes.toString("base64"),
                  mimeType: detectedMime,
                },
              },
              { text: systemPrompt },
            ],
          },
        ],
      });
    }, 3, 1200);

    const rawJson = (response as any).text;
    if (!rawJson) throw new Error("Empty response from Gemini");

    const parsed: ExtractedContactData = JSON.parse(rawJson);
    return parsed;
  } catch (err: any) {
    console.error("Error extracting contact data:", err);
    throw new Error(`Failed to extract contact data: ${err?.message || String(err)}`);
  }
}

/**
 * Extract contact info from a website URL (scrapes HTML and queries Gemini).
 */
export async function extractContactFromWebsite(url: string, apiKey: string): Promise<ExtractedContactData> {
  if (!apiKey) throw new Error("Gemini API key required");
  const ai = new GoogleGenAI({ apiKey });

  try {
    // fetch page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: (controller.signal as any) });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);

    let html = await resp.text();
    if (html.length > 15000) html = html.slice(0, 15000);

    const prompt = `You are an expert at extracting structured contact information from web pages.
Return valid JSON only with the following fields if present: name, email, phone, company, title, location, skills[], linkedinUrl, githubUrl, websiteUrl, bio, education[], experience[].

Page URL: ${url}
HTML: ${html}`;

    const response = await withRetries(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }), 3, 1200);

    const raw = (response as any).text;
    if (!raw) throw new Error("Empty response from Gemini (website)");

    const parsed: ExtractedContactData = JSON.parse(raw);
    if (!parsed.websiteUrl) parsed.websiteUrl = url;
    return parsed;
  } catch (err: any) {
    console.error("Error extracting contact from website:", err);
    throw new Error(`Failed to extract contact from website: ${err?.message || String(err)}`);
  }
}

/**
 * Semantic search contacts: returns ordered contact objects (not just IDs).
 * If Gemini fails, falls back to returning provided contacts.
 */
export async function semanticSearchContacts(query: string, contacts: any[], apiKey: string): Promise<any[]> {
  if (!apiKey) {
    console.warn("No Gemini key for semantic search → returning input contacts");
    return contacts;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (!contacts || contacts.length === 0) return [];

    const compact = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      company: c.company,
      skills: c.skills,
      location: c.location,
      bio: c.bio,
    }));

    const prompt = `You are an assistant that ranks contacts by relevance to a query.
Query: ${query}
Contacts: ${JSON.stringify(compact, null, 2)}
Return a JSON array of contact IDs in order of relevance. Example: ["id1","id2"].
If none match, return [].`;

    const response = await withRetries(() => ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: { responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }), 2, 800);

    const raw = (response as any).text;
    if (!raw) return contacts;

    const ids: string[] = JSON.parse(raw);
    const ordered = ids.map((id) => contacts.find((c) => c.id === id)).filter(Boolean);
    return ordered.length ? ordered : contacts;
  } catch (err) {
    console.error("Semantic search error (falling back):", err);
    return contacts;
  }
}
