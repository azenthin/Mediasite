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

// API routes that need rate limiting
const apiRoutes = [
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/auth/verify',
  '/api/media/upload',
];

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
};

// Check if route is protected
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route));
}

// Check if route needs rate limiting
function isRateLimitedRoute(pathname: string): boolean {
  return apiRoutes.some(route => pathname.startsWith(route));
}

// Rate limiting function
function checkRateLimit(request: NextRequest): NextResponse | null {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const windowStart = now - rateLimitConfig.windowMs;

  // Get current rate limit data for this IP
  const current = rateLimitStore.get(ip);

  if (!current || current.resetTime < now) {
    // First request or window expired
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + rateLimitConfig.windowMs
    });
    return null; // No rate limit exceeded
  }

  if (current.count >= rateLimitConfig.maxRequests) {
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
          'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': current.resetTime.toString()
        }
      }
    );
  }

  // Increment count
  current.count++;
  rateLimitStore.set(ip, current);
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: https://placehold.co https://storage.googleapis.com https://source.unsplash.com https://images.unsplash.com https://dummyimage.com https://via.placeholder.com",
      "media-src 'self' https: https://storage.googleapis.com",
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
  if (isRateLimitedRoute(pathname)) {
    const rateLimitResult = checkRateLimit(request);
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
