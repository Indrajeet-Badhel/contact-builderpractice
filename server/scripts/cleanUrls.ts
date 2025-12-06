// Create this as: server/scripts/cleanUrls.ts
// Run once to clean all existing URLs in the database

import { db } from "../db";
import { contacts } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Decode HTML entities from a string
 */
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
 * Clean and normalize a URL
 */
function cleanUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  let cleaned = decodeHtmlEntities(url);
  cleaned = cleaned.replace(/\/+$/, '');
  
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  
  return cleaned;
}

/**
 * Clean all URLs in a contact object
 */
function cleanContactUrls(contact: any): any {
  const cleaned = { ...contact };
  
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
  
  // Clean URLs in enrichedData
  if (cleaned.enrichedData && typeof cleaned.enrichedData === 'object') {
    const enriched = cleaned.enrichedData as any;
    
    if (enriched.linkedinUrl) enriched.linkedinUrl = cleanUrl(enriched.linkedinUrl);
    if (enriched.githubUrl) enriched.githubUrl = cleanUrl(enriched.githubUrl);
    if (enriched.websiteUrl) enriched.websiteUrl = cleanUrl(enriched.websiteUrl);
    if (enriched.orcidUrl) enriched.orcidUrl = cleanUrl(enriched.orcidUrl);
    
    if (Array.isArray(enriched.sources)) {
      enriched.sources = enriched.sources.map((source: any) => ({
        ...source,
        url: source.url ? cleanUrl(source.url) : source.url,
      }));
    }
    
    cleaned.enrichedData = enriched;
  }
  
  return cleaned;
}

/**
 * Main cleanup function
 */
async function cleanAllUrls() {
  try {
    console.log('🧹 Starting URL cleanup...');
    
    // Get all contacts
    const allContacts = await db.select().from(contacts);
    console.log(`📊 Found ${allContacts.length} contacts to process`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const contact of allContacts) {
      try {
        // Check if any URLs need cleaning
        const needsCleaning = 
          (contact.linkedinUrl && contact.linkedinUrl.includes('&#x')) ||
          (contact.githubUrl && contact.githubUrl.includes('&#x')) ||
          (contact.websiteUrl && contact.websiteUrl.includes('&#x')) ||
          (contact.orcidUrl && contact.orcidUrl.includes('&#x')) ||
          (contact.sources && JSON.stringify(contact.sources).includes('&#x')) ||
          (contact.enrichedData && JSON.stringify(contact.enrichedData).includes('&#x'));
        
        if (!needsCleaning) {
          skipped++;
          continue;
        }
        
        // Clean the contact
        const cleaned = cleanContactUrls(contact);
        
        // Update in database
        await db
          .update(contacts)
          .set({
            linkedinUrl: cleaned.linkedinUrl,
            githubUrl: cleaned.githubUrl,
            websiteUrl: cleaned.websiteUrl,
            orcidUrl: cleaned.orcidUrl,
            sources: cleaned.sources,
            enrichedData: cleaned.enrichedData,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id));
        
        updated++;
        console.log(`✅ Cleaned URLs for: ${contact.name} (${contact.id})`);
      } catch (err) {
        console.error(`❌ Failed to clean contact ${contact.id}:`, err);
      }
    }
    
    console.log('\n✨ Cleanup complete!');
    console.log(`   Updated: ${updated} contacts`);
    console.log(`   Skipped: ${skipped} contacts (already clean)`);
    console.log(`   Total: ${allContacts.length} contacts`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanAllUrls();