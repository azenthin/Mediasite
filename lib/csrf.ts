import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

// Store for CSRF tokens (in production, use Redis or database)
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

// Clean up expired tokens every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of csrfTokenStore.entries()) {
      if (data.expiresAt < now) {
        csrfTokenStore.delete(userId);
      }
    }
  }, 5 * 60 * 1000);
}

// Generate a CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Store CSRF token for a user session
export function storeCSRFToken(userId: string, token: string, expiresIn: number = 3600000): void {
  csrfTokenStore.set(userId, {
    token,
    expiresAt: Date.now() + expiresIn,
  });
}

// Get stored CSRF token for a user
export function getStoredCSRFToken(userId: string): string | null {
  const data = csrfTokenStore.get(userId);
  if (!data) return null;
  
  // Check if expired
  if (data.expiresAt < Date.now()) {
    csrfTokenStore.delete(userId);
    return null;
  }
  
  return data.token;
}

// Validate a CSRF token
export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(storedToken, 'hex')
    );
  } catch (error) {
    // Buffers are different lengths
    return false;
  }
}

// Generate a CSRF token for forms
export function getCSRFToken(): string {
  return generateCSRFToken();
}

// Verify CSRF token from request
export function verifyCSRFToken(requestToken: string, sessionToken: string): boolean {
  return validateCSRFToken(requestToken, sessionToken);
}

/**
 * Middleware helper to validate CSRF tokens on state-changing requests
 * Use this in POST, PUT, DELETE, PATCH handlers
 */
export async function validateCSRFMiddleware(
  request: NextRequest,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  // Get CSRF token from header or body
  const csrfToken = 
    request.headers.get('x-csrf-token') || 
    request.headers.get('csrf-token');

  if (!csrfToken) {
    logger.warn('CSRF token missing', { userId, path: request.nextUrl.pathname });
    return { valid: false, error: 'CSRF token required' };
  }

  // Get stored token for this user
  const storedToken = getStoredCSRFToken(userId);
  
  if (!storedToken) {
    logger.warn('CSRF token expired or not found', { userId });
    return { valid: false, error: 'CSRF token expired. Please refresh the page.' };
  }

  // Validate token
  const isValid = validateCSRFToken(csrfToken, storedToken);
  
  if (!isValid) {
    logger.warn('CSRF token validation failed', { 
      userId, 
      path: request.nextUrl.pathname 
    });
    return { valid: false, error: 'Invalid CSRF token' };
  }

  logger.debug('CSRF token validated successfully', { userId });
  return { valid: true };
}

/**
 * Helper to create CSRF error response
 */
export function csrfErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status: 403 }
  );
} 