import crypto from 'crypto';

// Generate a CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Validate a CSRF token
export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(storedToken, 'hex')
  );
}

// Generate a CSRF token for forms
export function getCSRFToken(): string {
  return generateCSRFToken();
}

// Verify CSRF token from request
export function verifyCSRFToken(requestToken: string, sessionToken: string): boolean {
  return validateCSRFToken(requestToken, sessionToken);
} 