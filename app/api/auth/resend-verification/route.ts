import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { createRateLimit } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/sanitize';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

// Rate limiting: 3 resend attempts per hour
const resendRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many resend attempts. Please try again later.'
});

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = resendRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { email } = resendSchema.parse(body);

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({
        message: 'If an account with this email exists, a verification link has been sent'
      });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      }
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(
      sanitizedEmail,
      user.username,
      verificationToken
    );

    if (!emailSent) {
      console.error('Failed to send verification email to:', sanitizedEmail);
    }

    return NextResponse.json({
      message: 'If an account with this email exists, a verification link has been sent'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 