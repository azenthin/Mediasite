#!/usr/bin/env node

/**
 * Setup schema for build environment
 * Swaps between SQLite (local) and PostgreSQL (production) based on DATABASE_URL
 */

const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '..', 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const postgresSchemaPath = path.join(prismaDir, 'schema.postgres.prisma');

const databaseUrl = process.env.DATABASE_URL || '';
const isProduction = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');

console.log(`🔍 DATABASE_URL: ${databaseUrl.substring(0, 30)}...`);
console.log(`🔍 Detected environment: ${isProduction ? 'PRODUCTION (PostgreSQL)' : 'DEVELOPMENT (SQLite)'}`);

if (isProduction) {
  // Copy PostgreSQL schema
  const postgresSchema = fs.readFileSync(postgresSchemaPath, 'utf8');
  fs.writeFileSync(schemaPath, postgresSchema, 'utf8');
  console.log('✅ Using PostgreSQL schema for production');
} else {
  console.log('✅ Using SQLite schema for local development');
}
