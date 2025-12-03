import rateLimit from 'express-rate-limit';

// Authentication endpoints - strict limits
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API endpoints - moderate limits
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { message: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search endpoints - balanced limits
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 searches per minute
  message: { message: 'Too many search requests, please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin endpoints - very strict limits
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { message: 'Too many admin requests, please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// NO rate limit for file uploads as requested
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // Effectively unlimited
  standardHeaders: false,
  legacyHeaders: false,
});