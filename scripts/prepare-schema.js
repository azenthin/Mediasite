#!/usr/bin/env node

/**
 * Prepare Prisma schema based on database type
 * - Production: PostgreSQL (from DATABASE_URL)
 * - Development: PostgreSQL (from .env.local)
 * 
 * NOTE: This script ensures the schema matches the DATABASE_URL environment variable.
 * It will auto-detect PostgreSQL vs SQLite and set the appropriate provider.
 */

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

console.log(`📋 prepare-schema.js: DATABASE_URL starts with: ${DATABASE_URL.substring(0, 30)}`);

// Determine provider based on DATABASE_URL
let provider = 'postgresql'; // Default to PostgreSQL for modern development
if (DATABASE_URL.toLowerCase().startsWith('file:')) {
  provider = 'sqlite';
}

console.log(`📋 prepare-schema.js: Setting provider to: ${provider}`);

// Read current schema
let schema = fs.readFileSync(schemaPath, 'utf8');

// Replace provider in schema - match the exact pattern in schema.prisma
const newDatasource = `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`;

// Try multiple patterns to find and replace the datasource block
const patterns = [
  /datasource db \{[\s\S]*?provider = "(sqlite|postgresql)"[\s\S]*?\}/,
  /datasource db \{\s*provider = "(sqlite|postgresql)"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/,
];

let updated = false;
for (const pattern of patterns) {
  if (pattern.test(schema)) {
    schema = schema.replace(pattern, newDatasource);
    updated = true;
    break;
  }
}

if (updated) {
  console.log(`✅ prepare-schema.js: Updated schema provider to "${provider}"`);
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log(`✅ prepare-schema.js: Schema written to ${schemaPath}`);
} else {
  console.log(`⚠️  prepare-schema.js: Could not find datasource block to update`);
}
