const fs = require('fs');
const path = require('path');

// Create a small sample file for testing
const stagingFile = path.join(__dirname, 'ingest/staging-results-500k.json');
const sampleFile = path.join(__dirname, 'ingest/sample-100-tracks.json');

console.log('📂 Loading full staging file...');
const staging = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));

console.log('✂️  Creating sample of 100 tracks...');
const sample = {
  results: staging.results.slice(0, 100).filter(r => {
    return r.spotify?.found && r.spotify?.spotify_id && r.isrc;
  })
};

console.log(`✅ Sample has ${sample.results.length} valid tracks`);

fs.writeFileSync(sampleFile, JSON.stringify(sample, null, 2));
console.log(`💾 Saved to: ${sampleFile}\n`);
console.log('🚀 Now run: node scripts/turbo-upsert.js scripts/ingest/sample-100-tracks.json');
