/**
 * Safe auth wrapper for NextAuth v4
 * Gets the session from the request using getServerSession
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { logger } from './logger';

export async function safeAuth() {
  try {
    const session = await getServerSession(authOptions);
    return session;
  } catch (error: any) {
    // Handle JWT session errors (invalid/expired tokens)
    logger.warn('Invalid session token, treating as unauthenticated', {
      error: error.message,
    });
    
    // Return null session (user not authenticated)
    return null;
  }
}

export default safeAuth;
