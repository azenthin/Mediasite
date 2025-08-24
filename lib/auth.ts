import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from './database';

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      displayName?: string;
      avatarUrl?: string;
    }
  }
  
  interface User {
    id: string;
    email: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  }
}



export const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName || undefined,
          avatarUrl: user.avatarUrl || undefined,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });

          if (!existingUser) {
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                username: user.email!.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5),
                displayName: user.name || user.email!.split('@')[0],
                avatarUrl: user.image || undefined,
                emailVerified: true,
                password: '', // OAuth users don't need password
              }
            });
            return true;
          }
          return true;
        } catch (error) {
          console.error('OAuth sign-in error:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.displayName = user.displayName;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        // Always fetch fresh user data to get updated avatarUrl
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true, email: true, username: true, displayName: true, avatarUrl: true }
        });
        
        if (freshUser) {
          session.user.id = freshUser.id;
          session.user.email = freshUser.email;
          session.user.username = freshUser.username;
          session.user.displayName = freshUser.displayName;
          session.user.avatarUrl = freshUser.avatarUrl;
        } else {
          // Fallback to token data
          session.user.id = token.id as string;
          session.user.username = token.username as string;
          session.user.displayName = token.displayName as string;
          session.user.avatarUrl = token.avatarUrl as string;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === 'production' ? undefined : "test-secret-key"),
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export const { auth, handlers: { GET, POST } } = NextAuth(authOptions); 