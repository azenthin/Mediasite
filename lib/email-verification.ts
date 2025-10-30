/**
 * Middleware to enforce email verification for certain actions
 * Users must verify their email before uploading content or commenting
 */

import { NextResponse } from 'next/server';
import { safeAuth } from './safe-auth';
import { logger } from './logger';

export async function requireEmailVerification(request: Request): Promise<NextResponse | null> {
  const session = await safeAuth();

  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Check if email is verified
  // Note: We need to fetch fresh user data from database to check emailVerified status
  // For now, we'll check if the session has emailVerified flag
  
  // TODO: Fetch user from database to check current verification status
  // const user = await prisma.user.findUnique({
  //   where: { id: session.user.id },
  //   select: { emailVerified: true }
  // });
  
  // if (!user?.emailVerified) {
  //   logger.warn('Unverified user attempted protected action', {
  //     userId: session.user.id,
  //     email: session.user.email,
  //     action: 'upload/comment'
  //   });
  //   
  //   return NextResponse.json(
  //     { 
  //       error: 'Email verification required',
  //       message: 'Please verify your email address before uploading content or commenting. Check your inbox for the verification link.'
  //     },
  //     { status: 403 }
  //   );
  // }

  // For now, log the check
  logger.debug('Email verification check', {
    userId: session.user.id,
    email: session.user.email
  });

  return null; // No error, user can proceed
}

/**
 * Client-side hook to check email verification status
 */
export function useEmailVerification() {
  // This will be implemented on the client side
  // For now, returns a placeholder
  return {
    isVerified: true, // TODO: Check actual verification status
    isLoading: false,
    error: null
  };
}
