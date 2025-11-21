#!/usr/bin/env node

/**
 * Prepare Prisma schema based on database type
 * - Local: SQLite (file:./prisma/dev.db)
 * - Production: PostgreSQL
 */

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// Read current schema
let schema = fs.readFileSync(schemaPath, 'utf8');

// Determine provider based on DATABASE_URL
let provider = 'sqlite'; // default for local development
if (DATABASE_URL.toLowerCase().startsWith('postgresql://') || 
    DATABASE_URL.toLowerCase().startsWith('postgres://')) {
  provider = 'postgresql';
}

console.log(`📋 prepare-schema.js: DATABASE_URL starts with: ${DATABASE_URL.substring(0, 30)}`);
console.log(`📋 prepare-schema.js: Setting provider to: ${provider}`);

// Replace provider in schema
const providerRegex = /datasource db \{[\s\S]*?provider = "(sqlite|postgresql)"[\s\S]*?\}/;
const newDatasource = `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`;

if (providerRegex.test(schema)) {
  schema = schema.replace(providerRegex, newDatasource);
  console.log(`✅ prepare-schema.js: Updated schema provider to "${provider}"`);
} else {
  // Try simpler pattern
  schema = schema.replace(
    /datasource db \{\s*provider = "(sqlite|postgresql)"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/,
    newDatasource
  );
  console.log(`✅ prepare-schema.js: Updated schema provider to "${provider}" (v2)`);
}

// Write updated schema
fs.writeFileSync(schemaPath, schema, 'utf8');
console.log(`✅ prepare-schema.js: Schema written to ${schemaPath}`);
