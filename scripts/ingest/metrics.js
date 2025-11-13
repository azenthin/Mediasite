const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'metrics.json');

let metrics = { processed: 0, accepted: 0, queued: 0, skipped: 0, errors: 0, byReason: {} };

function load() {
  try { metrics = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
}

function save() { fs.writeFileSync(OUT, JSON.stringify(metrics, null, 2)); }

function incProcessed() { metrics.processed++; save(); }
function incAccepted() { metrics.accepted++; save(); }
function incQueued() { metrics.queued++; save(); }
function incSkipped(reason) { metrics.skipped++; metrics.byReason[reason] = (metrics.byReason[reason] || 0) + 1; save(); }
function incError() { metrics.errors++; save(); }

module.exports = { load, save, incProcessed, incAccepted, incQueued, incSkipped, incError, get: () => metrics };
