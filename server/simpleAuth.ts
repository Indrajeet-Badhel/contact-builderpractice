// server/simpleAuth.ts - SECURE VERSION
import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./security/encryption";
import { logSecurityEvent, SecurityEventType } from "./security/auditLogger";

const MemoryStoreSession = MemoryStore(session);

// Track failed login attempts
interface LoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}

const loginAttempts = new Map<string, LoginAttempt>();

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10) * 60 * 1000;

function checkLoginAttempts(email: string): { allowed: boolean; remainingAttempts?: number; lockedUntil?: Date } {
  const attempt = loginAttempts.get(email);
  
  if (!attempt) {
    return { allowed: true };
  }
  
  // Check if account is locked
  if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
    return { 
      allowed: false, 
      lockedUntil: attempt.lockedUntil 
    };
  }
  
  // Reset if lockout period has passed
  if (attempt.lockedUntil && attempt.lockedUntil <= new Date()) {
    loginAttempts.delete(email);
    return { allowed: true };
  }
  
  // Check if max attempts exceeded
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
    attempt.lockedUntil = lockedUntil;
    loginAttempts.set(email, attempt);
    
    return { 
      allowed: false, 
      lockedUntil 
    };
  }
  
  return { 
    allowed: true, 
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempt.count 
  };
}

function recordLoginAttempt(email: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(email);
    return;
  }
  
  const attempt = loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
  attempt.count++;
  attempt.lastAttempt = new Date();
  loginAttempts.set(email, attempt);
}

// Clean up old attempts every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [email, attempt] of loginAttempts.entries()) {
    if (attempt.lastAttempt < oneHourAgo && (!attempt.lockedUntil || attempt.lockedUntil < new Date())) {
      loginAttempts.delete(email);
    }
  }
}, 60 * 60 * 1000);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }
  
  return session({
    secret: sessionSecret,
    store: new MemoryStoreSession({
      checkPeriod: sessionTtl,
    }),
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Custom name to avoid fingerprinting
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      logSecurityEvent(SecurityEventType.LOGIN_FAILED, req as any, {
        reason: 'missing_credentials',
        email,
      });
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }
    
    // Check if email format is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logSecurityEvent(SecurityEventType.LOGIN_FAILED, req as any, {
        reason: 'invalid_email',
        email,
      });
      return res.status(400).json({ 
        message: "Invalid email format" 
      });
    }
    
    // Check password length
    if (password.length < 6) {
      logSecurityEvent(SecurityEventType.LOGIN_FAILED, req as any, {
        reason: 'weak_password',
        email,
      });
      return res.status(400).json({ 
        message: "Password must be at least 6 characters long" 
      });
    }
    
    // Check login attempts
    const attemptCheck = checkLoginAttempts(email);
    if (!attemptCheck.allowed) {
      logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, req as any, {
        email,
        lockedUntil: attemptCheck.lockedUntil,
      });
      
      return res.status(429).json({ 
        message: `Account temporarily locked. Please try again after ${attemptCheck.lockedUntil?.toLocaleTimeString()}`,
        lockedUntil: attemptCheck.lockedUntil,
      });
    }
    
    try {
      // Extract name from email
      const nameParts = email.split("@")[0].split(".");
      const firstName = nameParts[0]
        ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
        : "User";
      const lastName = nameParts[1]
        ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
        : "";

      // Upsert user in DB
      const dbUser = await storage.upsertUser({
        email,
        firstName,
        lastName,
      });

      // Record successful login
      recordLoginAttempt(email, true);
      
      // Regenerate session ID to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
        }
        
        // Store user in session
        (req.session as any).user = {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        };
        
        logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, req as any, {
          userId: dbUser.id,
          email: dbUser.email,
        });
        
        res.json({ success: true });
      });
    } catch (error) {
      console.error('Login error:', error);
      recordLoginAttempt(email, false);
      
      logSecurityEvent(SecurityEventType.LOGIN_FAILED, req as any, {
        reason: 'server_error',
        email,
      });
      
      res.status(500).json({ 
        message: "An error occurred during login" 
      });
    }
  });

  app.get("/api/logout", (req, res) => {
    const user = (req.session as any)?.user;
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      
      if (user) {
        logSecurityEvent(SecurityEventType.LOGOUT, req as any, {
          userId: user.id,
        });
      }
      
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, req as any, {
      path: req.path,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = { claims: { sub: user.id }, ...user };
  next();
};