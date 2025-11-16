import { PrismaClient } from '@prisma/client';

// Centralized Prisma client with robust DATABASE_URL handling.
// In development, defaults to SQLite for simplicity.
// In production, requires a proper PostgreSQL or database URL.

function resolveDatasourceUrl(): string {
    const raw = process.env.DATABASE_URL;
    console.log('🔍 DATABASE.TS: Resolving datasource URL');
    console.log('🔍 DATABASE.TS: DATABASE_URL exists:', !!raw);
    console.log('🔍 DATABASE.TS: DATABASE_URL prefix:', raw?.substring(0, 30));

    // If DATABASE_URL is set and looks valid, use it
    if (raw && raw.trim()) {
        // For SQLite, must start with file:
        if (raw.toLowerCase().includes('sqlite') || raw.toLowerCase().startsWith('file:')) {
            console.log('🔍 DATABASE.TS: Detected SQLite connection');
            return raw;
        }
        // For PostgreSQL
        if (raw.toLowerCase().startsWith('postgresql://') || raw.toLowerCase().startsWith('postgres://')) {
            console.log('🔍 DATABASE.TS: Detected PostgreSQL connection');
            return raw;
        }
    }

    // Development convenience: fall back to SQLite
    if (process.env.NODE_ENV !== 'production') {
        const devDefault = 'file:./prisma/dev.db';
        return devDefault;
    }

    // Production: require proper DATABASE_URL
    const details = `Invalid DATABASE_URL. Received: ${raw ?? '(unset)'}\n` +
        'Expected: file:./path/to/db.db (SQLite) or postgresql://... (PostgreSQL)\n' +
        'Fix: Set a proper database connection string in your environment.';
    throw new Error(details);
}

const datasourceUrl = resolveDatasourceUrl();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

console.log('🔍 DATABASE.TS: Creating Prisma client with URL:', datasourceUrl.substring(0, 30));

export const prisma =
    globalForPrisma.prisma ?? new PrismaClient({ 
        datasources: { db: { url: datasourceUrl } },
        errorFormat: 'pretty',
        log: ['query', 'error', 'warn'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;