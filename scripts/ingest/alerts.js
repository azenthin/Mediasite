const path = require('path');
const metrics = require('./metrics');
const fs = require('fs');
const OUT = path.join(__dirname, 'alerts.json');

function evaluateAlerts(thresholds = { skipRate: 0.25 }) {
  const m = metrics.get();
  const processed = m.processed || 0;
  const skipped = m.skipped || 0;
  const skipRate = processed === 0 ? 0 : skipped / processed;
  const alerts = [];
  if (skipRate > thresholds.skipRate) alerts.push({ type: 'high-skip-rate', skipRate, threshold: thresholds.skipRate });
  // persist latest alerts
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), alerts, metrics: m }, null, 2));
  return alerts;
}

module.exports = { evaluateAlerts };
