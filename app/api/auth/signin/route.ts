import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { verifyPassword } from '@/lib/auth';
import { z } from 'zod';
import { createRateLimit } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/sanitize';


// Rate limiting: 5 attempts per 15 minutes
const signinRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many signin attempts. Please try again later.'
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  csrfToken: z.string().min(1, 'CSRF token is required'),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = signinRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { email, password, csrfToken } = signinSchema.parse(body);

    // Verify CSRF token
    if (!csrfToken || csrfToken.length < 32) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email address before signing in. Check your email for a verification link.' },
        { status: 401 }
      );
    }


    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    return NextResponse.json({
      message: 'Signin successful',
      user: userData
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 