import { PrismaClient } from '@prisma/client';

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production');
    }
    process.env.DATABASE_URL = "file:./prisma/dev.db";
}

// Set DATABASE_PROVIDER for schema
if (!process.env.DATABASE_PROVIDER) {
    if (process.env.NODE_ENV === 'production') {
        process.env.DATABASE_PROVIDER = "postgresql";
    } else {
        process.env.DATABASE_PROVIDER = "sqlite";
    }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 