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
    company: string;
    title: string;
    duration: string;
  }>;
}

/* ------------------------------------------
   DOCX → PDF Converter 
------------------------------------------- */
async function convertDocxToPdf(docxPath: string): Promise<string> {
  const outPath = docxPath.replace(/\.docx$/i, "") + ".converted.pdf";

  try {
    const html = (await mammoth.convertToHtml({ path: docxPath })).value;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: outPath, format: "A4" });
    await browser.close();

    console.log("DOCX → PDF conversion OK:", outPath);
    return outPath;
  } catch (err) {
    console.error("DOCX conversion failed, using original file:", err);
    return docxPath;
  }
}

/* ------------------------------------------
   MAIN DOCUMENT EXTRACTION FUNCTION
   (THIS IS THE ONLY PART YOU REPLACE)
------------------------------------------- */
export async function extractContactFromDocument(
  documentPath: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedContactData> {
  const ai = new GoogleGenAI({ apiKey });

  try {
    // Step 1 — Fix MIME type
    let detectedMime =
      mimeType ||
      mime.lookup(documentPath) ||
      (documentPath.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "");

    if (!detectedMime) {
      console.warn("⚠ No MIME type detected → defaulting to PDF");
      detectedMime = "application/pdf";
    }

    // Step 2 — Convert DOCX → PDF for Gemini stability
    if (documentPath.endsWith(".docx")) {
      console.log("Converting DOCX to PDF...");
      documentPath = await convertDocxToPdf(documentPath);
      detectedMime = "application/pdf";
    }

    // Step 3 — Load file
    const fileBytes = fs.readFileSync(documentPath);

    const systemPrompt = `
You are an expert at extracting structured contact information from documents.
Extract:
name, email, phone, company, title, location, skills[], linkedinUrl, githubUrl,
websiteUrl, bio, education[], experience[].
Return ONLY valid JSON.
`.trim();

    // Step 4 — Call Gemini
    const response = await ai.models.generateContent({
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

    const raw = response.text;
    if (!raw) throw new Error("Empty response from Gemini");

    return JSON.parse(raw);
  } catch (err: any) {
    console.error("Gemini extraction error:", err);
    throw new Error("Failed to extract contact: " + err.message);
  }
}

/* ------------------------------------------
   WEBSITE EXTRACTION (unchanged)
------------------------------------------- */
export async function extractContactFromWebsite(url: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  let html = await res.text();
  if (html.length > 15000) html = html.slice(0, 15000);

  const systemPrompt = `
Extract structured contact info from this HTML page.
Return valid JSON only.
`.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: { responseMimeType: "application/json" },
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          { text: `URL: ${url}\n\nHTML:\n${html}` },
        ],
      },
    ],
  });

  const raw = response.text;
  if (!raw) throw new Error("Empty response");

  const obj = JSON.parse(raw);
  if (!obj.websiteUrl) obj.websiteUrl = url;

  return obj;
}

/* ------------------------------------------
   SEMANTIC SEARCH (unchanged)
------------------------------------------- */
export async function semanticSearchContacts(
  query: string,
  contacts: Array<any>,
  apiKey: string
): Promise<Array<any>> {
  const ai = new GoogleGenAI({ apiKey });

  const body = JSON.stringify(
    contacts.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      company: c.company,
      skills: c.skills,
      location: c.location,
      bio: c.bio,
    }))
  );

  const prompt = `
Rank the following contacts by relevance to the query: "${query}".
Return JSON array of IDs only.
Contacts:
${body}
`;

  const res = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    config: { responseMimeType: "application/json" },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const raw = res.text;
  if (!raw) return contacts;

  const ids: Array<any> = JSON.parse(raw);
  return ids
    .map((id: any) => contacts.find((c: any) => c.id === id))
    .filter(Boolean) as Array<any>;
}
