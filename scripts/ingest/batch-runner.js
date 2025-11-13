const fs = require('fs');
const path = require('path');
const { readStaging } = require('./upsert-staging');

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Simple batch runner: given rows and a worker function, process in batches sequentially
async function runInBatches(rows, worker, batchSize = 10) {
  const chunks = chunkArray(rows, batchSize);
  for (const c of chunks) {
    await Promise.all(c.map(worker));
  }
  return readStaging();
}

module.exports = { runInBatches, chunkArray };
