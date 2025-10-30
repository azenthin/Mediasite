import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting store (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Protected routes that require authentication
const protectedRoutes = [
  '/upload',
  '/profile',
  '/settings',
  '/playlists',
  '/liked-content',
  '/history',
  '/subscriptions',
];

// API routes that need rate limiting with different limits
const strictRateLimitRoutes = [
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

const moderateRateLimitRoutes = [
  '/api/auth/verify',
  '/api/media/upload',
  '/api/comments',
  '/api/profile',
];

const generalRateLimitRoutes = [
  '/api/search',
  '/api/media',
];

// Rate limiting configurations
const rateLimitConfigs = {
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes (auth endpoints)
  },
  moderate: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30, // 30 requests per 15 minutes (uploads, comments)
  },
  general: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute (search, browsing)
  },
};

// Check if route is protected
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route));
}

// Get rate limit config for route
function getRateLimitConfig(pathname: string): typeof rateLimitConfigs.strict | null {
  if (strictRateLimitRoutes.some(route => pathname.startsWith(route))) {
    return rateLimitConfigs.strict;
  }
  if (moderateRateLimitRoutes.some(route => pathname.startsWith(route))) {
    return rateLimitConfigs.moderate;
  }
  if (generalRateLimitRoutes.some(route => pathname.startsWith(route))) {
    return rateLimitConfigs.general;
  }
  return null;
}

// Rate limiting function with configurable limits
function checkRateLimit(request: NextRequest, config: typeof rateLimitConfigs.strict): NextResponse | null {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const pathname = request.nextUrl.pathname;
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  // Get current rate limit data for this IP + path combination
  const current = rateLimitStore.get(key);

  if (!current || current.resetTime < now) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return null; // No rate limit exceeded
  }

  if (current.count >= config.maxRequests) {
    // Rate limit exceeded
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': current.resetTime.toString()
        }
      }
    );
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);
  return null; // No rate limit exceeded
}

// Generate security headers
function generateSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://vercel.com https://*.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: https://placehold.co https://storage.googleapis.com https://source.unsplash.com https://images.unsplash.com https://dummyimage.com https://via.placeholder.com",
      "media-src 'self' https: https://storage.googleapis.com",
      "connect-src 'self' https://va.vercel-scripts.com https://vercel.live https://vercel.com https://*.vercel-scripts.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; '),
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and NextAuth.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth/[...nextauth]') ||
    pathname.startsWith('/api/auth/session') ||
    pathname.startsWith('/api/auth/csrf') ||
    pathname.startsWith('/api/auth/providers') ||
    pathname.startsWith('/api/auth/signin') ||
    pathname.startsWith('/api/auth/signout') ||
    pathname.startsWith('/api/auth/callback') ||
    pathname.startsWith('/api/auth/verify') ||
    pathname.startsWith('/api/auth/reset-password') ||
    pathname.startsWith('/api/auth/resend-verification')
  ) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  const rateLimitConfig = getRateLimitConfig(pathname);
  if (rateLimitConfig) {
    const rateLimitResult = checkRateLimit(request, rateLimitConfig);
    if (rateLimitResult) {
      return rateLimitResult;
    }
  }

  // Create response with security headers
  const response = NextResponse.next();
  
  // Add security headers
  const securityHeaders = generateSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Clean up old rate limit entries periodically (runs in the background)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
      if (data.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/* (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
