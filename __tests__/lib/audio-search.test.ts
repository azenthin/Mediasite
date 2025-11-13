import { parsePromptToSignature, findCandidates } from '../../lib/audio-search';

// Provide a mocked database module. Use in-test require() to access the mock
// because jest.mock calls are hoisted and cannot reference outer variables.
jest.mock('../../lib/database', () => {
  return {
    prisma: {
      $queryRawUnsafe: jest.fn(),
      songCache: {
        findFirst: jest.fn(),
      },
    },
  };
});

describe('audio-search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parsePromptToSignature returns phonk signature for phonk prompt', async () => {
    const sig = await parsePromptToSignature('Give me a phonk playlist');
    expect(sig).toBeDefined();
    expect(sig.genres).toContain('phonk');
    expect(sig.tempo.min).toBeGreaterThanOrEqual(130);
  });

  test('findCandidates falls back to scalar query and returns candidates', async () => {
    // Arrange: no seed embedding, so findCandidates will use scalar fallback
    const fakeRows = [
      { id: '1', filename: 'song1.mp3', bpm: 110, energy: 0.6, danceability: 0.5, spotifyId: null, youtubeUrl: null },
      { id: '2', filename: 'song2.mp3', bpm: 95, energy: 0.4, danceability: 0.3, spotifyId: null, youtubeUrl: null },
    ];
  const { prisma } = require('../../lib/database');
  prisma.$queryRawUnsafe.mockResolvedValue(fakeRows);

    const signature = {
      tempo: { min: 80, max: 120 },
      energy: 0.5,
      danceability: 0.4,
      genres: [],
      diversity: { maxPerArtist: 2, maxSameGenrePercent: 0.6 },
    } as any;

      // Act
      const results = await findCandidates(signature, 10);

        // Assert
        expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBeDefined();
  });
});

