import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, storeCSRFToken } from '@/lib/csrf';
import { safeAuth } from '@/lib/safe-auth';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/csrf
 * Generate and return a CSRF token for the current session
 */
export async function GET(request: NextRequest) {
  try {
    const session = await safeAuth();
    
    if (!session?.user?.id) {
      logger.warn('CSRF token requested without session');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Generate CSRF token
    const token = generateCSRFToken();
    
    // Store token for validation (expires in 1 hour)
    storeCSRFToken(session.user.id, token, 3600000);
    
    logger.debug('CSRF token generated and stored', {
      userId: session.user.id,
      tokenLength: token.length,
    });

    // Return token (client will store it and send it back with POST/PUT/DELETE requests)
    return NextResponse.json({
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });

  } catch (error) {
    logger.error('CSRF token generation error', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
