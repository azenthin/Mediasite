const fs = require('fs');

function validateRows(rows) {
  const errors = [];
  rows.forEach((r, i) => {
    if (!r.Artist || !r.Title) errors.push({ row: i + 1, reason: 'missing Artist or Title' });
  });
  return { valid: errors.length === 0, errors };
}

function parseCSV(txt) {
  const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const [header, ...rows] = lines;
  const cols = header.split(',').map(c=>c.trim());
  return rows.map(r=>{
    const parts = r.split(','); const obj = {};
    cols.forEach((c,i)=> obj[c] = (parts[i]||'').trim());
    return obj;
  });
}

function validateFile(path) {
  const txt = fs.readFileSync(path,'utf8');
  const rows = parseCSV(txt);
  return validateRows(rows);
}

module.exports = { validateRows, parseCSV, validateFile };
