import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store for rate limiting
// In production, use Redis or a proper database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

export function createRateLimit(config: RateLimitConfig) {
  return function rateLimit(request: NextRequest) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current rate limit data for this IP
    const current = rateLimitStore.get(ip);

    if (!current || current.resetTime < now) {
      // First request or window expired
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return null; // No rate limit exceeded
    }

    if (current.count >= config.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        { 
          error: config.message || 'Too many requests',
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
    rateLimitStore.set(ip, current);
    return null; // No rate limit exceeded
  };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000); // Clean up every minute 