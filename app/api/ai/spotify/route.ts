import { NextRequest, NextResponse } from 'next/server';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import ServerTimer from '@/lib/server-timing';
import { mapWithConcurrency } from '@/lib/concurrency';

export async function POST(request: NextRequest) {
  const timer = new ServerTimer();
  try {
    timer.start('parse_body');
    const { accessToken, playlistName, songs } = await request.json();
    timer.end('parse_body');

    if (!accessToken || !playlistName || !songs || !Array.isArray(songs)) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    timer.start('init_client');
    const spotify = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: ''
    });
    timer.end('init_client');

    // Get current user
    timer.start('get_profile');
    const me = await spotify.currentUser.profile();
    timer.end('get_profile');
    
    // Create playlist
    timer.start('create_playlist');
    const playlist = await spotify.playlists.createPlaylist(me.id, {
      name: playlistName,
      description: `AI-generated playlist: ${playlistName}`,
      public: true
    });
    timer.end('create_playlist');

    // Search for tracks and collect URIs with limited concurrency
    timer.start('search_tracks');
    const limitedSongs = songs.slice(0, 50);
    const searchResults = await mapWithConcurrency(limitedSongs, 5, async (song) => {
      try {
        const res = await spotify.search(`${song.title} ${song.artist}`.trim(), ['track'], 'US', 5);
        const tracks = res.tracks.items;
        if (tracks.length > 0) {
          const exactMatch = tracks.find((track) =>
            track.name.toLowerCase().includes(song.title.toLowerCase()) &&
            track.artists.some((artist) => artist.name.toLowerCase().includes(song.artist.toLowerCase()))
          );
          const trackToAdd = exactMatch || tracks[0];
          return trackToAdd.uri;
        }
      } catch (e) {
        // swallow per-item errors
      }
      return undefined as unknown as string;
    });
    const trackUris = searchResults.filter(Boolean) as string[];
    timer.end('search_tracks');

    // Add tracks to playlist in batches
    if (trackUris.length > 0) {
      timer.start('add_tracks');
      const batchSize = 100;
      for (let i = 0; i < trackUris.length; i += batchSize) {
        const batch = trackUris.slice(i, i + batchSize);
        await spotify.playlists.addItemsToPlaylist(playlist.id, batch);
      }
      timer.end('add_tracks');
    }

    const res = NextResponse.json({
      success: true,
      playlistUrl: playlist.external_urls.spotify,
      playlistId: playlist.id,
      tracksAdded: trackUris.length
    });
    res.headers.set('Server-Timing', timer.header());
    return res;

  } catch (error) {
    console.error('❌ Spotify API error:', error);
    const res = NextResponse.json({ 
      error: 'Failed to create Spotify playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    res.headers.set('Server-Timing', new ServerTimer().header());
    return res;
  }
}

