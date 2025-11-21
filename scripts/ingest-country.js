/**
 * Ingest artist country data from Spotify and populate VerifiedTrack.country field
 * Fetches country for each unique artist from Spotify API
 * Caches results to avoid duplicate API calls
 */

const sqlite3 = require('sqlite3').verbose();
const pg = require('pg');
const { exec } = require('child_process');

// Determine which database to use
const dbType = process.env.POSTGRES_URL ? 'postgres' : 'sqlite';
console.log(`📊 Using database: ${dbType}`);

let db;
let pgClient;

async function initDatabase() {
  if (dbType === 'postgres') {
    pgClient = new pg.Client({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();
    console.log('✅ Connected to Postgres');
  } else {
    // SQLite for local development
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database('prisma/prisma/dev.db', (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Connected to SQLite');
          resolve();
        }
      });
    });
  }
}

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getArtistCountry(artistName, accessToken) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch artist "${artistName}": ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const artist = data.artists?.items?.[0];

    if (!artist || !artist.country) {
      console.warn(`⚠️  No country data for artist: ${artistName}`);
      return null;
    }

    return artist.country; // ISO 3166-1 alpha-2 code
  } catch (error) {
    console.error(`❌ Error fetching country for "${artistName}":`, error.message);
    return null;
  }
}

async function getUniqueArtists() {
  if (dbType === 'postgres') {
    const result = await pgClient.query(`
      SELECT DISTINCT artist 
      FROM "VerifiedTrack" 
      WHERE artist IS NOT NULL 
      ORDER BY artist
    `);
    return result.rows.map(r => r.artist);
  } else {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT artist FROM VerifiedTrack WHERE artist IS NOT NULL ORDER BY artist`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.artist));
        }
      );
    });
  }
}

async function updateTrackCountry(artist, country) {
  if (dbType === 'postgres') {
    await pgClient.query(
      `UPDATE "VerifiedTrack" SET country = $1 WHERE artist = $2`,
      [country, artist]
    );
  } else {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE VerifiedTrack SET country = ? WHERE artist = ?`,
        [country, artist],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

async function getCountryStats() {
  if (dbType === 'postgres') {
    const result = await pgClient.query(`
      SELECT 
        COUNT(*) as total_tracks,
        COUNT(country) as tracks_with_country,
        COUNT(DISTINCT country) as unique_countries
      FROM "VerifiedTrack"
    `);
    return result.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total_tracks,
          COUNT(country) as tracks_with_country,
          COUNT(DISTINCT country) as unique_countries
        FROM VerifiedTrack`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

async function main() {
  try {
    console.log('🚀 Starting country ingestion from Spotify...\n');
    
    await initDatabase();

    const accessToken = await getSpotifyAccessToken();
    console.log('✅ Got Spotify access token\n');

    // Get all unique artists
    console.log('📊 Fetching unique artists...');
    const artists = await getUniqueArtists();
    console.log(`✅ Found ${artists.length} unique artists\n`);

    // Fetch country for each artist with rate limiting
    let updated = 0;
    let skipped = 0;
    const batchSize = 1; // Reduce to 1 artist per batch
    const delayMs = 3000; // 3 seconds between requests to avoid rate limiting

    for (let i = 0; i < artists.length; i += batchSize) {
      const batch = artists.slice(i, i + batchSize);
      
      for (const artist of batch) {
        const country = await getArtistCountry(artist, accessToken);
        if (country) {
          await updateTrackCountry(artist, country);
          updated++;
          console.log(`✅ ${artist} → ${country} (${updated}/${artists.length})`);
        } else {
          skipped++;
          console.log(`⏭️  Skipped: ${artist} (${skipped} skipped so far)`);
        }
      }

      // Rate limiting: wait before next batch
      if (i + batchSize < artists.length) {
        console.log(`⏸️  Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('\n📊 Ingestion complete!');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);

    // Show final stats
    const stats = await getCountryStats();
    console.log('\n📈 Final Statistics:');
    console.log(`   Total tracks: ${stats.total_tracks}`);
    console.log(`   Tracks with country: ${stats.tracks_with_country}`);
    console.log(`   Unique countries: ${stats.unique_countries}`);

    if (dbType === 'postgres') await pgClient.end();
    else db.close();
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
