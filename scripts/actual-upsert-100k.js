const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { fetchArtistsBatch, fetchAudioFeaturesBatch, computeMood } = require('./spotify-enrichment');

const prisma = new PrismaClient();
const stagingFile = path.join(__dirname, 'ingest/staging-results-100k.json');

async function upsert100k() {
  try {
    if (!fs.existsSync(stagingFile)) {
      console.error('❌ Staging file not found:', stagingFile);
      return;
    }

    console.log('📂 Loading staging results...');
    const staging = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
    
    const tracks = staging.results.filter(r => {
      return r.spotify?.found && r.spotify?.spotify_id && r.isrc;
    });
    
    console.log(`✅ Loaded ${tracks.length} tracks\n`);
    console.log('🎵 Enriching with artist genres and popularity...\n');

    // Extract unique IDs for batch fetching
    const artistIds = [...new Set(tracks.map(t => t.spotify?.raw?.artists?.[0]?.id).filter(Boolean))];
    const spotifyIds = [...new Set(tracks.map(t => t.spotify?.spotify_id).filter(Boolean))];
    
    console.log(`📊 Fetching data for ${artistIds.length} artists and ${spotifyIds.length} tracks...\n`);
    
    // Batch fetch artists
    const artistDataMap = new Map();
    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      const artists = await fetchArtistsBatch(batch);
      artists.forEach(a => artistDataMap.set(a.id, a));
      console.log(`  ✓ Artists: ${Math.min(i + 50, artistIds.length)}/${artistIds.length}`);
    }
    
    // Batch fetch audio features (will likely get 403, but try anyway)
    const audioFeaturesMap = new Map();
    for (let i = 0; i < spotifyIds.length; i += 100) {
      const batch = spotifyIds.slice(i, i + 100);
      const features = await fetchAudioFeaturesBatch(batch);
      features.forEach(f => audioFeaturesMap.set(f.id, f));
      if (i % 1000 === 0) {
        console.log(`  ✓ Audio Features: ${Math.min(i + 100, spotifyIds.length)}/${spotifyIds.length}`);
      }
    }
    
    console.log('\n🔄 Upserting to database...\n');

    let upserted = 0;
    let skipped = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      const spotifyId = track.spotify.spotify_id;
      const isrc = track.isrc;
      const title = track.spotify.raw.name || 'Unknown';
      const artist = track.spotify.raw.artists?.[0]?.name || 'Unknown';
      const album = track.spotify.raw.album?.name || '';
      const releaseDate = track.spotify.raw.album?.release_date;
      const durationMs = track.spotify.raw.duration_ms;
      const mbid = track.musicbrainz?.mbid || null;

      // Get enrichment data
      const artistId = track.spotify?.raw?.artists?.[0]?.id;
      const artistData = artistId ? artistDataMap.get(artistId) : null;
      const audioFeatures = spotifyId ? audioFeaturesMap.get(spotifyId) : null;
      
      const genres = artistData?.genres || [];
      const primaryGenre = genres[0] || null;
      const mood = computeMood(audioFeatures);
      const trackPopularity = track.spotify?.raw?.popularity;

      try {
        const identifierData = [
          { type: 'isrc', value: isrc },
          { type: 'spotify', value: spotifyId }
        ];
        if (mbid) {
          identifierData.push({ type: 'mbid', value: mbid });
        }

        const verifiedTrack = await prisma.verifiedTrack.upsert({
          where: { isrc },
          update: {
            title,
            artist,
            album,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            durationMs,
            spotifyId,
            mbid: mbid || null,
            genres: genres.length > 0 ? JSON.stringify(genres) : null,
            primaryGenre,
            trackPopularity,
            artistPopularity: artistData?.popularity,
            artistFollowers: artistData?.followers,
            danceability: audioFeatures?.danceability,
            energy: audioFeatures?.energy,
            valence: audioFeatures?.valence,
            tempo: audioFeatures?.tempo,
            acousticness: audioFeatures?.acousticness,
            instrumentalness: audioFeatures?.instrumentalness,
            key: audioFeatures?.key,
            mode: audioFeatures?.mode,
            loudness: audioFeatures?.loudness,
            mood,
            updatedAt: new Date(),
          },
          create: {
            title,
            artist,
            album,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            durationMs,
            isrc,
            spotifyId,
            mbid: mbid || null,
            genres: genres.length > 0 ? JSON.stringify(genres) : null,
            primaryGenre,
            trackPopularity,
            artistPopularity: artistData?.popularity,
            artistFollowers: artistData?.followers,
            danceability: audioFeatures?.danceability,
            energy: audioFeatures?.energy,
            valence: audioFeatures?.valence,
            tempo: audioFeatures?.tempo,
            acousticness: audioFeatures?.acousticness,
            instrumentalness: audioFeatures?.instrumentalness,
            key: audioFeatures?.key,
            mode: audioFeatures?.mode,
            loudness: audioFeatures?.loudness,
            mood,
          }
        });

        // Create identifiers
        for (const id of identifierData) {
          await prisma.trackIdentifier.upsert({
            where: {
              type_value: {
                type: id.type,
                value: id.value
              }
            },
            update: {},
            create: {
              type: id.type,
              value: id.value,
              trackId: verifiedTrack.id
            }
          });
        }

        upserted++;
        
        if (upserted % 100 === 0) {
          console.log(`✓ Upserted ${upserted}/${tracks.length}...`);
        }
      } catch (error) {
        skipped++;
        if (error.message.includes('Unique constraint')) {
          // Skip duplicates silently
        } else {
          console.error(`❌ Error upserting ${artist} - ${title}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Upsert complete!`);
    console.log(`   Upserted: ${upserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${tracks.length}\n`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

upsert100k();
