(async ()=>{
  const fs = require('fs');
  const path = require('path');
  const BASE = process.env.SOUNDCHARTS_BASE || 'https://customer.api.soundcharts.com';
  const APP_ID = process.env.SOUNDCHARTS_APP_ID || 'soundcharts';
  const API_KEY = process.env.SOUNDCHARTS_API_KEY || 'soundcharts';
  const outDir = path.join(__dirname, 'output'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const outFile = path.join(outDir,'soundcharts_genres_raw.json');
  const headers = { 'x-app-id': APP_ID, 'x-api-key': API_KEY, 'Accept':'application/json' };
  try {
    console.log('Fetching referential genres...');
    const res = await fetch(`${BASE}/api/v2/referential/song/genres`, { headers });
    console.log('Genres status', res.status);
    const j = await res.json();
    fs.writeFileSync(outFile, JSON.stringify(j,null,2),'utf8');
    console.log('Wrote genres to', outFile);
  } catch (e) {
    console.error('Failed to fetch genres:', e.message);
  }
  // try fetching sample song UUIDs from the sandbox manifest you provided
  const sampleUuids = ['2ffc5f25-f191-4551-a1b4-40fe9ddcc075','7d534228-5165-11e9-9375-549f35161576'];
  for (const uuid of sampleUuids) {
    const urls = [
      `${BASE}/api/v2/song/${encodeURIComponent(uuid)}`,
      `${BASE}/api/v2/songs/${encodeURIComponent(uuid)}`,
      `${BASE}/api/v2/referential/song/${encodeURIComponent(uuid)}`,
      `${BASE}/api/v2/song?uuid=${encodeURIComponent(uuid)}`
    ];
    let found = false;
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers });
        console.log('Try', url, '=>', r.status);
        if (r.ok) {
          const data = await r.json();
          const outFile2 = path.join(outDir, `song_${uuid}.json`);
          fs.writeFileSync(outFile2, JSON.stringify(data,null,2),'utf8');
          console.log('Wrote song data to', outFile2);
          found = true;
          break;
        }
      } catch (e) {
        console.error('Error fetching', url, e.message);
      }
    }
    if (!found) console.log('No song data found for', uuid);
  }
})();
