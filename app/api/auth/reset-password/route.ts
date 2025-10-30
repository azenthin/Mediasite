import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import { createRateLimit } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/sanitize';
import { generateVerificationToken, sendPasswordResetEmail } from '@/lib/email';

// Rate limiting: 3 reset requests per hour
const resetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many password reset attempts. Please try again later.'
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = resetRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { token, newPassword } = resetPasswordSchema.parse(body);

    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date() // Token not expired
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user's password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }
    });

    return NextResponse.json({
      message: 'Password reset successful'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Request password reset
export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = resetRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { email } = z.object({
      email: z.string().email('Invalid email address')
    }).parse(body);

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({
        message: 'If an account with this email exists, a reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = generateVerificationToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: resetToken,
        emailVerificationExpires: resetExpires,
      }
    });

    // Send reset email
    const emailSent = await sendPasswordResetEmail(
      sanitizedEmail,
      user.username,
      resetToken
    );

    if (!emailSent) {
      console.error('Failed to send password reset email to:', sanitizedEmail);
    }

    return NextResponse.json({
      message: 'If an account with this email exists, a reset link has been sent'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 