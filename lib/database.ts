import { PrismaClient } from '@prisma/client';

// Centralized Prisma client with robust DATABASE_URL handling.
// Some Windows environments may leak a user-level env var like DATABASE_URL="file:./prisma/dev.db"
// which causes Prisma to throw at runtime. We detect invalid protocols and override safely.

function isPostgresUrl(url: string | undefined): url is string {
    if (!url) return false;
    const u = url.trim().toLowerCase();
    return u.startsWith('postgresql://') || u.startsWith('postgres://');
}

function resolveDatasourceUrl(): string {
    const raw = process.env.DATABASE_URL;
    const alt = process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || process.env.PG_URL;

    // Happy path: valid Postgres URL in DATABASE_URL
    if (isPostgresUrl(raw)) return raw!;

    // If an alternate Postgres URL is provided, prefer it and log a warning
    if (isPostgresUrl(alt)) {
        return alt!;
    }

    // Development convenience: fall back to the common local Postgres URL
    // This keeps dev working even if a stray user-level env var is set to SQLite.
    if (process.env.NODE_ENV !== 'production') {
        const devDefault = 'postgresql://postgres:postgres@localhost:5432/mediasite';
        return devDefault;
    }

    // Production: be strict and provide guidance
    const details = `Invalid DATABASE_URL. Received: ${raw ?? '(unset)'}\n` +
        'Expected a URL starting with postgresql:// or postgres://.\n' +
        'Fix: Set a proper Postgres connection string in your environment (.env) and ensure no user/system env overrides.\n' +
        'On Windows, check System Properties → Environment Variables and remove any leftover DATABASE_URL pointing to SQLite.';
    throw new Error(details);
}

const datasourceUrl = resolveDatasourceUrl();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ?? new PrismaClient({ datasources: { db: { url: datasourceUrl } } });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;