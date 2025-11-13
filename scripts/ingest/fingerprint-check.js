const { execSync } = require('child_process');

function hasFpCalc() {
  try {
    const out = execSync('fpcalc -version', { stdio: 'pipe' }).toString();
    return !!out;
  } catch (e) {
    return false;
  }
}

module.exports = { hasFpCalc };
