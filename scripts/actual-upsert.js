const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { fetchArtistsBatch, fetchAudioFeaturesBatch, computeMood } = require('./spotify-enrichment');

const prisma = new PrismaClient();
const stagingFile = path.join(__dirname, 'ingest/staging-results.json');

async function actualUpsert() {
  try {
    // Load staging database
    if (!fs.existsSync(stagingFile)) {
      console.error('❌ Staging file not found:', stagingFile);
      return;
    }

    console.log('📂 Loading staging results (this may take a moment - large file)...');
    const staging = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
    
    // Extract results array and filter for accepted tracks
    const allResults = staging.results || [];
    const tracks = allResults.filter(r => {
      // Accept if has spotify_id and isrc
      return r.spotify?.found && r.spotify?.spotify_id && r.isrc;
    });
    
    console.log(`✅ Loaded ${tracks.length} tracks from staging\n`);
    console.log('🎵 Enriching tracks with artist genres and audio features...\n');

    // Extract unique artist IDs and spotify track IDs for batch fetching
    const artistIds = [...new Set(tracks.map(t => t.spotify?.raw?.artists?.[0]?.id).filter(Boolean))];
    const spotifyIds = [...new Set(tracks.map(t => t.spotify?.spotify_id).filter(Boolean))];

    console.log(`� Fetching data for ${artistIds.length} artists and ${spotifyIds.length} tracks...`);

    // Batch fetch artist data (50 at a time)
    const artistDataMap = new Map();
    for (let i = 0; i < artistIds.length; i += 50) {
      const batch = artistIds.slice(i, i + 50);
      const artists = await fetchArtistsBatch(batch);
      artists.forEach(a => artistDataMap.set(a.id, a));
      console.log(`  ✓ Artists: ${Math.min(i + 50, artistIds.length)}/${artistIds.length}`);
    }

    // Batch fetch audio features (100 at a time)
    const audioFeaturesMap = new Map();
    for (let i = 0; i < spotifyIds.length; i += 100) {
      const batch = spotifyIds.slice(i, i + 100);
      const features = await fetchAudioFeaturesBatch(batch);
      features.forEach(f => audioFeaturesMap.set(f.id, f));
      console.log(`  ✓ Audio Features: ${Math.min(i + 100, spotifyIds.length)}/${spotifyIds.length}`);
    }

    console.log('\n�🔄 Upserting to VerifiedTrack table with enrichment data...\n');

    let upserted = 0;
    let skipped = 0;

    for (const track of tracks) {
      // Extract data from nested structure
      const isrc = track.isrc;
      const spotifyId = track.spotify?.spotify_id;
      const mbid = track.mbid || track.musicbrainz?.mbid;
      const title = track.title || track.spotify?.title;
      const artist = track.artist || track.spotify?.artists?.[0]?.name;
      const album = track.spotify?.raw?.album?.name;
      const releaseDate = track.spotify?.raw?.album?.release_date;
      const durationMs = track.spotify?.duration_ms;

      if (!isrc || !spotifyId || !title || !artist) {
        if (skipped < 3) {
          console.log(`Skipping: isrc=${isrc}, spotify=${spotifyId}, title=${title}, artist=${artist}`);
        }
        skipped++;
        continue;
      }

      try {
        // Get enrichment data
        const artistId = track.spotify?.raw?.artists?.[0]?.id;
        const artistData = artistId ? artistDataMap.get(artistId) : null;
        const audioFeatures = spotifyId ? audioFeaturesMap.get(spotifyId) : null;
        
        // Compute derived fields
        const genres = artistData?.genres || [];
        const primaryGenre = genres[0] || null;
        const mood = computeMood(audioFeatures);
        const trackPopularity = track.spotify?.raw?.popularity;

        // Build identifiers for the separate TrackIdentifier table
        const identifierData = [
          { type: 'isrc', value: isrc },
          { type: 'spotify', value: spotifyId }
        ];
        if (mbid) {
          identifierData.push({ type: 'mbid', value: mbid });
        }

        // Upsert VerifiedTrack with enrichment data
        const result = await prisma.verifiedTrack.upsert({
          where: { isrc },
          update: {
            title,
            artist,
            album,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            durationMs,
            spotifyId,
            mbid: mbid || null,
            // Enrichment fields
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
            // Enrichment fields
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

        // Create TrackIdentifier entries
        for (const identifier of identifierData) {
          await prisma.trackIdentifier.upsert({
            where: {
              type_value: {
                type: identifier.type,
                value: identifier.value
              }
            },
            update: {
              trackId: result.id
            },
            create: {
              type: identifier.type,
              value: identifier.value,
              trackId: result.id
            }
          });
        }

        upserted++;
        if (upserted % 100 === 0) {
          console.log(`✓ Upserted ${upserted}/${tracks.length} tracks...`);
        }
      } catch (err) {
        console.error(`❌ Error upserting ${track.artist} - ${track.title}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n✅ Upsert complete!`);
    console.log(`   Upserted: ${upserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${tracks.length}\n`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

actualUpsert();
