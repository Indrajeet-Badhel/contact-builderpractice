import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { logSecurityEvent, SecurityEventType } from './auditLogger';

// ============================================
// SQL INJECTION DETECTION
// ============================================
const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION(?:\s+ALL)?\s+SELECT/i,
  /INSERT(?:\s+INTO)?\s+/i,
  /UPDATE\s+\w+\s+SET/i,
  /DELETE\s+FROM/i,
  /DROP\s+(TABLE|DATABASE)/i,
  /TRUNCATE\s+TABLE/i,
  /;\s*DROP/i,
  /'\s*OR\s*'1'\s*=\s*'1/i,
  /'\s*OR\s*1\s*=\s*1/i,
];

export function detectSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

// ============================================
// XSS ATTACK DETECTION
// ============================================
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /<img[^>]+src[^>]*>/gi,
  /<embed\b/gi,
  /<object\b/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
];

export function detectXSS(input: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

// ============================================
// HTML ENTITY ENCODING
// ============================================
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ============================================
// ZOD SCHEMAS
// ============================================

// Contact validation schema
export const contactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  skills: z.array(z.string().max(100)).optional(),
  linkedinUrl: z.string().url().max(500).optional(),
  githubUrl: z.string().url().max(500).optional(),
  websiteUrl: z.string().url().max(500).optional(),
  orcidUrl: z.string().url().max(500).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(5000).optional(),
});

// Search query schema
export const searchSchema = z.object({
  query: z.string().min(1).max(500),
});

// URL import schema
export const urlSchema = z.object({
  url: z.string().url().max(1000),
});

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// API key schema
export const apiKeySchema = z.object({
  service: z.string().min(1).max(100),
  keyName: z.string().min(1).max(100),
  encryptedValue: z.string().min(1).max(1000),
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for SQL injection in all string inputs
      const checkForSQLInjection = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return detectSQLInjection(obj);
        }
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj).some(checkForSQLInjection);
        }
        return false;
      };

      if (checkForSQLInjection(req.body)) {
        logSecurityEvent(SecurityEventType.SQL_INJECTION_ATTEMPT, req as any, {
          body: req.body,
          path: req.path,
        });
        return res.status(400).json({ 
          message: 'Invalid input detected. Please check your data.' 
        });
      }

      // Check for XSS in all string inputs
      const checkForXSS = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return detectXSS(obj);
        }
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj).some(checkForXSS);
        }
        return false;
      };

      if (checkForXSS(req.body)) {
        logSecurityEvent(SecurityEventType.XSS_ATTEMPT, req as any, {
          body: req.body,
          path: req.path,
        });
        return res.status(400).json({ 
          message: 'Invalid input detected. Please check your data.' 
        });
      }

      // Validate with Zod schema
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: 'Validation error',
          errors: result.error.errors 
        });
      }

      // Replace body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ message: 'Validation failed' });
    }
  };
}

// ============================================
// SANITIZATION HELPER
// ============================================
export function validateAndSanitize(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(validateAndSanitize);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = validateAndSanitize(value);
    }
    return sanitized;
  }
  
  return data;
}