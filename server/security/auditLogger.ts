import type { Request, Response, NextFunction } from 'express';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  RESOURCE_CREATED = 'RESOURCE_CREATED',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED',
}

// ============================================
// AUDIT LOG INTERFACE
// ============================================
interface AuditLog {
  timestamp: Date;
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}

// ============================================
// IN-MEMORY AUDIT LOG STORAGE
// ============================================
const auditLogs: AuditLog[] = [];
const MAX_LOGS = 10000; // Keep last 10k logs in memory

// ============================================
// LOG SECURITY EVENT
// ============================================
export function logSecurityEvent(
  eventType: SecurityEventType,
  req: Request & { user?: any },
  metadata?: Record<string, any>
) {
  const log: AuditLog = {
    timestamp: new Date(),
    eventType,
    userId: req.user?.id,
    email: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method,
    metadata,
  };

  auditLogs.push(log);
  
  // Trim logs if exceeds max
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.shift();
  }

  // Log to console for monitoring
  const logMessage = formatLogMessage(log);
  
  // Color code based on severity
  if (isCriticalEvent(eventType)) {
    console.error('🚨 SECURITY ALERT:', logMessage);
  } else if (isWarningEvent(eventType)) {
    console.warn('⚠️  SECURITY WARNING:', logMessage);
  } else {
    console.log('ℹ️  SECURITY INFO:', logMessage);
  }
}

// ============================================
// AUDIT MIDDLEWARE
// ============================================
export function createAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      
      // Log suspicious requests
      if (res.statusCode === 401 || res.statusCode === 403) {
        logSecurityEvent(
          SecurityEventType.UNAUTHORIZED_ACCESS,
          req as any,
          {
            statusCode: res.statusCode,
            duration,
          }
        );
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function formatLogMessage(log: AuditLog): string {
  const parts = [
    `[${log.eventType}]`,
    log.userId ? `User: ${log.userId}` : null,
    log.email ? `Email: ${log.email}` : null,
    log.ipAddress ? `IP: ${log.ipAddress}` : null,
    log.path ? `Path: ${log.method} ${log.path}` : null,
    log.metadata ? `Metadata: ${JSON.stringify(log.metadata)}` : null,
  ].filter(Boolean);
  
  return parts.join(' | ');
}

function isCriticalEvent(eventType: SecurityEventType): boolean {
  return [
    SecurityEventType.SQL_INJECTION_ATTEMPT,
    SecurityEventType.XSS_ATTEMPT,
    SecurityEventType.ACCOUNT_LOCKED,
  ].includes(eventType);
}

function isWarningEvent(eventType: SecurityEventType): boolean {
  return [
    SecurityEventType.LOGIN_FAILED,
    SecurityEventType.UNAUTHORIZED_ACCESS,
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    SecurityEventType.ADMIN_ACCESS_DENIED,
  ].includes(eventType);
}

// ============================================
// AUDIT LOG RETRIEVAL (FOR ADMIN)
// ============================================
export function getAuditLogs(filters?: {
  eventType?: SecurityEventType;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): AuditLog[] {
  let logs = [...auditLogs];
  
  if (filters?.eventType) {
    logs = logs.filter(log => log.eventType === filters.eventType);
  }
  
  if (filters?.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }
  
  if (filters?.startDate) {
    logs = logs.filter(log => log.timestamp >= filters.startDate!);
  }
  
  if (filters?.endDate) {
    logs = logs.filter(log => log.timestamp <= filters.endDate!);
  }
  
  // Sort by most recent first
  logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  if (filters?.limit) {
    logs = logs.slice(0, filters.limit);
  }
  
  return logs;
}

// ============================================
// SECURITY METRICS
// ============================================
export function getSecurityMetrics() {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = auditLogs.filter(log => log.timestamp >= last24Hours);
  
  return {
    totalEvents: recentLogs.length,
    loginAttempts: recentLogs.filter(l => 
      l.eventType === SecurityEventType.LOGIN_SUCCESS || 
      l.eventType === SecurityEventType.LOGIN_FAILED
    ).length,
    failedLogins: recentLogs.filter(l => 
      l.eventType === SecurityEventType.LOGIN_FAILED
    ).length,
    sqlInjectionAttempts: recentLogs.filter(l => 
      l.eventType === SecurityEventType.SQL_INJECTION_ATTEMPT
    ).length,
    xssAttempts: recentLogs.filter(l => 
      l.eventType === SecurityEventType.XSS_ATTEMPT
    ).length,
    unauthorizedAccess: recentLogs.filter(l => 
      l.eventType === SecurityEventType.UNAUTHORIZED_ACCESS
    ).length,
    accountLockouts: recentLogs.filter(l => 
      l.eventType === SecurityEventType.ACCOUNT_LOCKED
    ).length,
  };
}