import { parseQuery } from './lib/query-interpreter';

// Test cases
const testCases = [
  "phonk",
  "phonk sad slow pace",
  "phonk sad slow pace by EVVORTEX",
  "justin bieber",
  "sad rain vibes",
  "workout hype",
  "gaming vibe trap",
  "chill study music",
  "pop",
  "fast upbeat electronic",
];

console.log("Query Interpreter Test Results\n" + "=".repeat(60));

for (const prompt of testCases) {
  const result = parseQuery(prompt);
  console.log(`\n📝 Prompt: "${prompt}"`);
  console.log(`   Type: ${result.queryType} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
  if (result.genres.length > 0) console.log(`   Genres: ${result.genres.join(', ')}`);
  if (result.artists.length > 0) console.log(`   Artists: ${result.artists.join(', ')}`);
  if (result.moods.length > 0) console.log(`   Moods: ${result.moods.join(', ')}`);
  if (result.bpmRange) console.log(`   BPM: ${result.bpmRange.min}-${result.bpmRange.max}`);
  if (result.explanation) console.log(`   → ${result.explanation}`);
}
