// Quick test of query parsing
const { parseQuery } = require('./lib/query-interpreter.ts');

const testQueries = [
  'pop',
  'pop music',
  'i want pop',
  'sad pop',
  'energetic pop',
];

console.log('Testing Query Interpreter:\n');

testQueries.forEach(q => {
  try {
    const result = parseQuery(q);
    console.log(`Query: "${q}"`);
    console.log(`  Type: ${result.queryType}`);
    console.log(`  Genres: ${result.genres.join(', ') || '(none)'}`);
    console.log(`  Moods: ${result.moods.join(', ') || '(none)'}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log();
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
});
