import type { Request, Response, NextFunction } from 'express';

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Content Security Policy (CSP)
  // Prevents XSS attacks by controlling what resources can be loaded
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.anthropic.com https://api-inference.huggingface.co https://api.github.com https://pub.orcid.org https://www.wikidata.org https://api.stackexchange.com https://gitlab.com https://dev.to https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // X-Frame-Options: Prevents clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection: Enables XSS filtering (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: Controls referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: Controls browser features
  res.setHeader(
    'Permissions-Policy',
    [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', ')
  );

  // Strict-Transport-Security (HSTS): Forces HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // X-DNS-Prefetch-Control: Controls DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // X-Download-Options: Prevents IE from executing downloads
  res.setHeader('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies: Controls Adobe Flash/PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}

// ============================================
// CORS HEADERS MIDDLEWARE
// ============================================
export function corsHeaders(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5000',
    'http://localhost:5173',
  ];

  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

// ============================================
// CACHE CONTROL HEADERS
// ============================================
export function cacheControlHeaders(req: Request, res: Response, next: NextFunction) {
  // Disable caching for API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

// ============================================
// SECURITY HEADERS FOR STATIC FILES
// ============================================
export function staticFileHeaders(req: Request, res: Response, next: NextFunction) {
  // Set caching for static assets
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
}