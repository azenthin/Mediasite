import { PrismaClient } from '@prisma/client';

// Enforce Postgres in all environments by requiring DATABASE_URL.
// This avoids accidental SQLite fallback that conflicts with the Prisma schema (provider = postgresql).
if (!process.env.DATABASE_URL) {
    throw new Error(
        'DATABASE_URL is not set. Please configure a PostgreSQL connection string in .env.local.\n' +
        'Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mediasite"\n' +
        'Tip: You can run Postgres locally via docker-compose (see README).'
    );
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;