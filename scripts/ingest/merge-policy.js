const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'merge-log.json');

function recordMerge({ fromId, toId, reason, actor = 'system' }) {
  const entry = { fromId, toId, reason, actor, at: new Date().toISOString() };
  let cur = { merges: [] };
  try { cur = JSON.parse(fs.readFileSync(OUT,'utf8')); } catch (e) {}
  cur.merges.push(entry);
  fs.writeFileSync(OUT, JSON.stringify(cur, null, 2));
  return entry;
}

module.exports = { recordMerge };
