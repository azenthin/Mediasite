import { PrismaClient } from '@prisma/client';

// Centralized Prisma client with robust DATABASE_URL handling.
// In development, defaults to SQLite for simplicity.
// In production, requires a proper PostgreSQL or database URL.

function resolveDatasourceUrl(): string {
    const raw = process.env.DATABASE_URL?.trim();
    if (raw) {
        const lower = raw.toLowerCase();
        if (lower.startsWith('postgres://') || lower.startsWith('postgresql://') || lower.startsWith('file:')) {
            return raw;
        }
        throw new Error('Unsupported DATABASE_URL format. Expected postgres:// or file: URL.');
    }

    if (process.env.NODE_ENV !== 'production') {
        console.warn('DATABASE_URL not set. Falling back to local SQLite dev database.');
        return 'file:./prisma/dev.db';
    }

    throw new Error('DATABASE_URL must be set in production.');
}

const datasourceUrl = resolveDatasourceUrl();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ?? new PrismaClient({ 
        datasources: { db: { url: datasourceUrl } },
        errorFormat: 'pretty',
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;