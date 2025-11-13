const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'skipped.json');

function enqueue(obj) {
  let cur = { items: [] };
  try { cur = JSON.parse(fs.readFileSync(OUT,'utf8')); } catch (e) {}
  cur.items.push(Object.assign({ createdAt: new Date().toISOString() }, obj));
  fs.writeFileSync(OUT, JSON.stringify(cur, null, 2));
}

function list() {
  try { return JSON.parse(fs.readFileSync(OUT,'utf8')).items || []; } catch (e) { return []; }
}

module.exports = { enqueue, list };
