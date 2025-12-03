import type { Request, Response, NextFunction } from 'express';
import { logSecurityEvent, SecurityEventType } from './auditLogger';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Fallback for development - add your email here
if (process.env.NODE_ENV === 'development' && ADMIN_EMAILS.length === 0) {
  console.warn('⚠️  No ADMIN_EMAILS configured. Add ADMIN_EMAILS to .env file.');
  console.warn('⚠️  Example: ADMIN_EMAILS=admin@example.com,manager@example.com');
}

// ============================================
// CHECK IF USER IS ADMIN
// ============================================
export function isAdmin(email?: string): boolean {
  if (!email) return false;
  
  const normalizedEmail = email.toLowerCase().trim();
  return ADMIN_EMAILS.includes(normalizedEmail);
}

// ============================================
// ADMIN AUTHORIZATION MIDDLEWARE
// ============================================
export function requireAdmin(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const user = req.user;
  
  if (!user || !user.email) {
    logSecurityEvent(SecurityEventType.ADMIN_ACCESS_DENIED, req, {
      reason: 'no_user',
      path: req.path,
    });
    return res.status(401).json({ 
      message: 'Authentication required' 
    });
  }

  if (!isAdmin(user.email)) {
    logSecurityEvent(SecurityEventType.ADMIN_ACCESS_DENIED, req, {
      reason: 'not_admin',
      email: user.email,
      path: req.path,
    });
    return res.status(403).json({ 
      message: 'Admin access required. You do not have permission to access this resource.' 
    });
  }

  // Log successful admin access
  logSecurityEvent(SecurityEventType.ADMIN_ACCESS, req, {
    email: user.email,
    path: req.path,
  });

  next();
}

// ============================================
// GET ADMIN STATUS
// ============================================
export function getAdminStatus(req: Request & { user?: any }): {
  isAdmin: boolean;
  email?: string;
  adminEmails: number;
} {
  return {
    isAdmin: isAdmin(req.user?.email),
    email: req.user?.email,
    adminEmails: ADMIN_EMAILS.length,
  };
}

// ============================================
// CONFIGURE ADMIN EMAILS
// ============================================
export function setAdminEmails(emails: string[]) {
  ADMIN_EMAILS.length = 0;
  ADMIN_EMAILS.push(...emails.map(e => e.trim().toLowerCase()).filter(Boolean));
  console.log(`✓ Configured ${ADMIN_EMAILS.length} admin email(s)`);
}

// ============================================
// LOG ADMIN CONFIGURATION
// ============================================
if (ADMIN_EMAILS.length > 0) {
  console.log(`✓ Admin authorization enabled for ${ADMIN_EMAILS.length} email(s)`);
  console.log('  Admin emails:', ADMIN_EMAILS.map(e => e.replace(/@.*/, '@***')).join(', '));
} else {
  console.warn('⚠️  No admin emails configured. Admin routes will be inaccessible.');
  console.warn('   Set ADMIN_EMAILS in .env: ADMIN_EMAILS=admin@example.com');
}