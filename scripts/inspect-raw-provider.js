const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('prisma/prisma/dev.db');

db.all(
  `SELECT id, artist, rawProvider FROM VerifiedTrack WHERE rawProvider IS NOT NULL LIMIT 5`,
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    rows.forEach((row, idx) => {
      console.log(`\n✅ Track ${idx + 1}: ${row.artist}`);
      try {
        const raw = JSON.parse(row.rawProvider);
        console.log('Structure:');
        console.log('  - Has spotify?', !!raw.spotify);
        if (raw.spotify) {
          console.log('  - Has spotify.raw?', !!raw.spotify.raw);
          if (raw.spotify.raw) {
            console.log('  - Has artists?', !!raw.spotify.raw.artists);
            if (raw.spotify.raw.artists && raw.spotify.raw.artists.length > 0) {
              const artist = raw.spotify.raw.artists[0];
              console.log('  - First artist ID:', artist.id);
              console.log('  - Has country in artist?', !!artist.country);
              console.log('  - Keys:', Object.keys(artist).slice(0, 10));
              if (artist.country) {
                console.log('  - Country:', artist.country);
              }
            }
          }
        }
        // Show full structure
        console.log('Full rawProvider keys:', Object.keys(raw));
      } catch (e) {
        console.log('Failed to parse:', e.message);
      }
    });

    db.close();
  }
);
