import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedVerifiedTracks() {
  try {
    console.log('🎵 Seeding VerifiedTracks for local development...');

    // Sample test data with correct schema - using unique ISRCs
    const testTracks = [
      {
        internalUuid: 'test-pop-dev-1',
        isrc: 'USDEVTEST001',
        title: 'Levitating',
        artist: 'Dua Lipa',
        album: 'Future Nostalgia',
        releaseDate: new Date('2020-11-27'),
        duration: 203, // in seconds
        explicit: false,
        trackPopularity: 92,
        artistPopularity: 88,
        primaryGenre: 'pop',
        genres: JSON.stringify(['pop', 'dance', 'electronic']),
        mood: 'upbeat',
        danceability: 0.7,
        energy: 0.8,
        key: 1,
        loudness: -5.5,
        mode: 1,
        speechiness: 0.04,
        acousticness: 0.15,
        instrumentalness: 0.0,
        liveness: 0.08,
        valence: 0.85,
        tempo: 103.0,
        timeSignature: 4,
        verifiedAt: new Date(),
      },
      {
        internalUuid: 'test-pop-dev-2',
        isrc: 'USDEVTEST002',
        title: 'Good 4 U',
        artist: 'Olivia Rodrigo',
        album: 'SOUR',
        releaseDate: new Date('2021-05-14'),
        duration: 178,
        explicit: false,
        trackPopularity: 95,
        artistPopularity: 92,
        primaryGenre: 'pop',
        genres: JSON.stringify(['pop', 'alternative']),
        mood: 'angry',
        danceability: 0.5,
        energy: 0.7,
        key: 11,
        loudness: -4.0,
        mode: 0,
        speechiness: 0.07,
        acousticness: 0.09,
        instrumentalness: 0.0,
        liveness: 0.11,
        valence: 0.35,
        tempo: 97.0,
        timeSignature: 4,
        verifiedAt: new Date(),
      },
      {
        internalUuid: 'test-pop-dev-3',
        isrc: 'USDEVTEST003',
        title: 'As It Was',
        artist: 'Harry Styles',
        album: 'Harry\'s House',
        releaseDate: new Date('2022-04-01'),
        duration: 169,
        explicit: false,
        trackPopularity: 94,
        artistPopularity: 90,
        primaryGenre: 'pop',
        genres: JSON.stringify(['pop', 'synth-pop']),
        mood: 'energetic',
        danceability: 0.75,
        energy: 0.85,
        key: 0,
        loudness: -3.0,
        mode: 1,
        speechiness: 0.038,
        acousticness: 0.1,
        instrumentalness: 0.0,
        liveness: 0.09,
        valence: 0.79,
        tempo: 174.0,
        timeSignature: 4,
        verifiedAt: new Date(),
      },
      {
        internalUuid: 'test-rock-dev-1',
        isrc: 'USDEVTEST004',
        title: 'Flowers',
        artist: 'Miley Cyrus',
        album: 'Endless Summer Vacation',
        releaseDate: new Date('2023-01-13'),
        duration: 203,
        explicit: false,
        trackPopularity: 93,
        artistPopularity: 89,
        primaryGenre: 'pop',
        genres: JSON.stringify(['pop', 'rock']),
        mood: 'empowering',
        danceability: 0.68,
        energy: 0.82,
        key: 1,
        loudness: -4.5,
        mode: 1,
        speechiness: 0.045,
        acousticness: 0.18,
        instrumentalness: 0.0,
        liveness: 0.12,
        valence: 0.78,
        tempo: 98.0,
        timeSignature: 4,
        verifiedAt: new Date(),
      },
    ];

    // Insert test tracks
    for (const track of testTracks) {
      await prisma.verifiedTrack.upsert({
        where: { isrc: track.isrc },
        update: {},  // Don't update if exists
        create: track
      });
      console.log(`✅ Added: ${track.title} by ${track.artist}`);
    }

    // Add corresponding identifiers (Spotify URLs)
    const addedTracks = await prisma.verifiedTrack.findMany({
      where: {
        internalUuid: { in: ['test-pop-dev-1', 'test-pop-dev-2', 'test-pop-dev-3', 'test-rock-dev-1'] }
      }
    });

    for (const track of addedTracks) {
      await prisma.trackIdentifier.create({
        data: {
          type: 'spotify',
          value: `spotify-${track.internalUuid}`, // Unique identifier
          trackId: track.id,
        }
      });
      console.log(`✅ Added Spotify identifier for: ${track.title}`);
    }

    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedVerifiedTracks();
