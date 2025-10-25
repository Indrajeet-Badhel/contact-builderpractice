import fetch from 'node-fetch';

export interface DeduplicationResult {
  isDuplicate: boolean;
  similarity: number;
  mergedData?: any;
}

export async function deduplicateContactData(
  newData: any,
  existingContacts: any[],
  hfApiKey: string
): Promise<{ isDuplicate: boolean; duplicateId?: string; confidence: number }> {
  try {
    if (!existingContacts || existingContacts.length === 0) {
      return { isDuplicate: false, confidence: 1.0 };
    }

    const newContactText = createContactText(newData);
    
    for (const contact of existingContacts) {
      const existingText = createContactText(contact);
      
      const similarity = await calculateTextSimilarity(newContactText, existingText, hfApiKey);
      
      if (similarity > 0.85) {
        return {
          isDuplicate: true,
          duplicateId: contact.id,
          confidence: similarity
        };
      }
    }
    
    return { isDuplicate: false, confidence: 1.0 };
  } catch (error) {
    console.error('Error in deduplication:', error);
    return { isDuplicate: false, confidence: 0.8 };
  }
}

function createContactText(data: any): string {
  const parts = [
    data.name,
    data.email,
    data.phone,
    data.company,
    data.title,
    data.location
  ].filter(Boolean);
  
  return parts.join(' | ').toLowerCase();
}

export async function calculateTextSimilarity(
  text1: string,
  text2: string,
  hfApiKey: string
): Promise<number> {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            source_sentence: text1,
            sentences: [text2]
          }
        })
      }
    );

    if (!response.ok) {
      console.error('HuggingFace API error:', response.statusText);
      return 0;
    }

    const result = await response.json() as any;
    
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating similarity:', error);
    return 0;
  }
}

export async function extractStructuredDataWithHF(
  text: string,
  hfApiKey: string
): Promise<any> {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: [
              'person name',
              'email address',
              'phone number',
              'company',
              'job title',
              'location',
              'skills',
              'education'
            ]
          }
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as any;
    return result;
  } catch (error) {
    console.error('Error with HF extraction:', error);
    return null;
  }
}

export async function improveConfidenceScore(
  extractedData: any,
  enrichedData: any,
  sources: any[],
  hfApiKey: string
): Promise<number> {
  try {
    let baseScore = 0.5;
    
    const verifiedSources = sources.filter(s => s.verified).length;
    baseScore += verifiedSources * 0.15;
    
    const totalFields = ['name', 'email', 'phone', 'company', 'title', 'location', 'bio'];
    const filledFields = totalFields.filter(field => enrichedData[field]).length;
    const fieldCoverage = filledFields / totalFields.length;
    baseScore += fieldCoverage * 0.2;
    
    if (enrichedData.email) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enrichedData.email);
      if (isValidEmail) baseScore += 0.05;
    }
    
    if (enrichedData.githubUrl) baseScore += 0.05;
    if (enrichedData.linkedinUrl) baseScore += 0.05;
    if (enrichedData.orcidUrl) baseScore += 0.05;
    
    if (sources.length >= 3) {
      baseScore += 0.05;
    }
    
    return Math.min(baseScore, 1.0);
  } catch (error) {
    console.error('Error calculating confidence score:', error);
    return 0.85;
  }
}
