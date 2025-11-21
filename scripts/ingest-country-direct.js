/**
 * Ingest country data from Spotify API directly
 * Fetches artist country for all unique artists and updates tracks
 * 
 * Usage:
 * DATABASE_URL=file:./prisma/dev.db \
 * SPOTIFY_CLIENT_ID=xxx \
 * SPOTIFY_CLIENT_SECRET=yyy \
 * node scripts/ingest-country-direct.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 50;        // Spotify API allows 50 artists per request
const RATE_LIMIT_MS = 100;    // 100ms between requests = 10 req/sec (below Spotify's 14 req/sec)

let spotifyToken = null;
let tokenExpireTime = 0;

/**
 * Get Spotify access token
 */
async function getSpotifyToken() {
  const now = Date.now();
  
  // Reuse token if still valid (with 30s buffer)
  if (spotifyToken && now < tokenExpireTime - 30000) {
    return spotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required');
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Spotify auth failed: ${response.statusText}`);
    }

    const data = await response.json();
    spotifyToken = data.access_token;
    tokenExpireTime = now + (data.expires_in * 1000);
    
    console.log(`✅ Got new Spotify token (expires in ${Math.round(data.expires_in / 60)}m)`);
    return spotifyToken;
  } catch (error) {
    console.error('❌ Failed to get Spotify token:', error.message);
    throw error;
  }
}

/**
 * Fetch artist data from Spotify API
 */
async function fetchArtistsBySpotifyId(artistIds) {
  const token = await getSpotifyToken();
  
  const idsParam = artistIds.join(',');
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/artists?ids=${idsParam}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        console.warn(`⚠️  Rate limited! Retry after ${retryAfter}s`);
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        return fetchArtistsBySpotifyId(artistIds); // Retry
      }
      console.warn(`⚠️  API error: ${response.statusText}`);
      return {};
    }

    const data = await response.json();
    const result = {};

    (data.artists || []).forEach(artist => {
      if (artist && artist.id && artist.country) {
        result[artist.id] = artist.country;
      }
    });

    return result;
  } catch (error) {
    console.error(`❌ Error fetching artists:`, error.message);
    return {};
  }
}

/**
 * Get all unique tracks with their Spotify artist IDs
 */
async function getTracksWithSpotifyArtistIds() {
  console.log('📊 Fetching tracks from database...');
  
  const tracks = await prisma.verifiedTrack.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,  // This is the track Spotify ID
    },
    where: {
      spotifyId: { not: null },
      country: null,  // Only tracks without country
    },
    take: 10000,  // Get first 10k to test
  });

  console.log(`✅ Found ${tracks.length} tracks with Spotify IDs but no country`);
  return tracks;
}

/**
 * Fetch artist info from Spotify using track ID
 * This requires searching for the track first to get artist info
 */
async function fetchArtistCountryByTrackId(spotifyTrackId) {
  const token = await getSpotifyToken();

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${spotifyTrackId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        console.warn(`⚠️  Rate limited! Retry after ${retryAfter}s`);
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        return null;
      }
      return null;
    }

    const trackData = await response.json();
    
    if (trackData.artists && trackData.artists.length > 0) {
      const artistId = trackData.artists[0].id;
      
      // Now fetch artist details to get country
      const artistResponse = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!artistResponse.ok) return null;

      const artistData = await artistResponse.json();
      return artistData.country || null;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error fetching track info:`, error.message);
    return null;
  }
}

/**
 * Main ingestion process
 */
async function main() {
  try {
    console.log('🚀 Starting country ingestion from Spotify...\n');

    // Get tracks
    const tracks = await getTracksWithSpotifyArtistIds();
    
    if (tracks.length === 0) {
      console.log('✅ All tracks already have country data or no Spotify IDs');
      await prisma.$disconnect();
      return;
    }

    // Fetch and update country for each track
    let updated = 0;
    let failed = 0;

    console.log(`\n📥 Fetching country for ${tracks.length} tracks...\n`);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      const country = await fetchArtistCountryByTrackId(track.spotifyId);

      if (country) {
        await prisma.verifiedTrack.update({
          where: { id: track.id },
          data: { country },
        });
        updated++;
        console.log(`✅ ${track.artist} → ${country} (${i + 1}/${tracks.length})`);
      } else {
        failed++;
        console.log(`⏭️  Skipped: ${track.artist} (${i + 1}/${tracks.length})`);
      }

      // Rate limiting: wait before next request
      if (i < tracks.length - 1) {
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      }
    }

    // Show final stats
    const stats = await prisma.verifiedTrack.aggregate({
      _count: true,
      where: { country: { not: null } },
    });

    console.log('\n📈 Final Statistics:');
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total with country: ${stats._count}`);

    await prisma.$disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
