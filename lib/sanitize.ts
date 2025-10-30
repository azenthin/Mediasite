import DOMPurify from 'dompurify';

// Client-side sanitization
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic HTML entity encoding
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  
  // Client-side: use DOMPurify
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'target'],
  });
}

// Enhanced text sanitization with SQL injection protection
export function sanitizeText(text: string): string {
  if (typeof window === 'undefined') {
    // Server-side: remove HTML tags and SQL injection patterns
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/['";\\]/g, '') // Remove SQL injection characters
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL comment start
      .replace(/\*\//g, '') // Remove SQL comment end
      .replace(/xp_/gi, '') // Remove SQL Server extended procedures
      .replace(/sp_/gi, ''); // Remove SQL Server stored procedures
  }
  
  // Client-side: use DOMPurify to strip HTML
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

// Sanitize user input for display
export function sanitizeForDisplay(input: string): string {
  return sanitizeText(input).trim();
}

// Enhanced email validation and sanitization
export function sanitizeEmail(email: string): string {
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  
  // Additional security checks
  if (sanitized.length > 254) { // RFC 5321 limit
    throw new Error('Email too long');
  }
  
  if (sanitized.includes('..') || sanitized.startsWith('.') || sanitized.endsWith('.')) {
    throw new Error('Invalid email format');
  }
  
  return sanitized;
}

// Validate and sanitize username
export function sanitizeUsername(username: string): string {
  const sanitized = username.trim();
  
  // Username rules: 3-20 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  
  if (!usernameRegex.test(sanitized)) {
    throw new Error('Username must be 3-20 characters, letters, numbers, and underscores only');
  }
  
  return sanitized;
}

// Sanitize file names
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

// Sanitize URLs
export function sanitizeUrl(url: string): string {
  const sanitized = url.trim();
  
  try {
    const parsed = new URL(sanitized);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return sanitized;
  } catch {
    throw new Error('Invalid URL format');
  }
}

// Enhanced password validation
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak patterns
  const weakPatterns = [
    'password', '123456', 'qwerty', 'admin', 'letmein',
    'welcome', 'monkey', 'dragon', 'master', 'football'
  ];
  
  if (weakPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    errors.push('Password contains common weak patterns');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Content Security Policy helper
export function generateCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
} 