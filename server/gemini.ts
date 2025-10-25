import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

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

export async function extractContactFromDocument(documentPath: string, mimeType: string, apiKey: string): Promise<ExtractedContactData> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const fileBytes = fs.readFileSync(documentPath);
    
    const systemPrompt = `You are an expert at extracting structured contact information from documents.
Analyze the provided document (resume, business card, or other professional document) and extract all relevant contact information.

Extract the following fields when available:
- name: Full name of the person
- email: Email address
- phone: Phone number
- company: Current company/organization
- title: Job title/position
- location: City, state, or country
- skills: Array of technical or professional skills
- linkedinUrl: LinkedIn profile URL
- githubUrl: GitHub profile URL  
- websiteUrl: Personal website or portfolio URL
- bio: Brief professional summary
- education: Array of educational qualifications
- experience: Array of work experience with company, title, and duration

Return ONLY valid JSON with the extracted data. If a field is not found, omit it from the response.
Be as accurate as possible. Extract all available information.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
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
                mimeType: mimeType,
              },
            },
            {
              text: systemPrompt
            }
          ]
        }
      ],
    });

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    const extractedData: ExtractedContactData = JSON.parse(rawJson);
    return extractedData;
  } catch (error: any) {
    console.error("Error extracting contact data:", error);
    throw new Error(`Failed to extract contact data: ${error.message || error}`);
  }
}

export async function semanticSearchContacts(query: string, contacts: any[], apiKey: string): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    if (!contacts || contacts.length === 0) {
      return [];
    }

    const systemPrompt = `You are an AI assistant that helps filter and rank contacts based on natural language queries.

Given a query like "Find Python developers with machine learning experience" or "Show me contacts from San Francisco",
analyze the list of contacts and return the IDs of contacts that match the query, ranked by relevance.

Query: ${query}

Contacts to search:
${JSON.stringify(contacts.map(c => ({
  id: c.id,
  name: c.name,
  title: c.title,
  company: c.company,
  skills: c.skills,
  location: c.location,
  bio: c.bio
})), null, 2)}

Return a JSON array of contact IDs in order of relevance. Example: ["id1", "id2", "id3"]
If no contacts match, return an empty array.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: systemPrompt
            }
          ]
        }
      ],
    });

    const rawJson = response.text;
    if (!rawJson) {
      return contacts;
    }

    const matchingIds: string[] = JSON.parse(rawJson);
    
    // Return contacts in the order of matching IDs
    const orderedContacts = matchingIds
      .map(id => contacts.find(c => c.id === id))
      .filter(Boolean);
    
    return orderedContacts.length > 0 ? orderedContacts : contacts;
  } catch (error) {
    console.error("Error in semantic search:", error);
    // Fallback to returning all contacts if AI search fails
    return contacts;
  }
}
