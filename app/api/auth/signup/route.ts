import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import { createRateLimit } from '@/lib/rate-limit';
import { sanitizeEmail, sanitizeUsername, sanitizeForDisplay } from '@/lib/sanitize';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

// Rate limiting: 3 signups per hour
const signupRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many signup attempts. Please try again later.'
});

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = signupRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { email, username, password, displayName } = signupSchema.parse(body);

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedUsername = sanitizeUsername(username);
    const sanitizedDisplayName = displayName ? sanitizeForDisplay(displayName) : sanitizedUsername;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: sanitizedEmail },
          { username: sanitizedUsername }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with email verification
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        username: sanitizedUsername,
        password: hashedPassword,
        displayName: sanitizedDisplayName,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(
      sanitizedEmail,
      sanitizedUsername,
      verificationToken
    );

    if (!emailSent) {
      // If email fails, still create user but log the error
      console.error('Failed to send verification email to:', sanitizedEmail);
    }

    return NextResponse.json({
      message: emailSent 
        ? 'Account created successfully! Please check your email to verify your account.'
        : 'Account created successfully! Please check your email to verify your account.',
      user
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 