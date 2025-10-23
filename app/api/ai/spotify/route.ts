import { NextRequest, NextResponse } from 'next/server';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, playlistName, songs } = await request.json();

    if (!accessToken || !playlistName || !songs || !Array.isArray(songs)) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    const spotify = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID!, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: ''
    });

    // Get current user
    const me = await spotify.currentUser.profile();
    
    // Create playlist
    const playlist = await spotify.playlists.createPlaylist(me.id, {
      name: playlistName,
      description: `AI-generated playlist: ${playlistName}`,
      public: true
    });

    // Search for tracks and collect URIs
    const trackUris: string[] = [];
    
    for (const song of songs.slice(0, 50)) { // Spotify limit is 100 tracks per request
      try {
        const searchResults = await spotify.search(song.title, ['track'], 'US', 1);
        const tracks = searchResults.tracks.items;
        
        if (tracks.length > 0) {
          // Try to find exact match first, then first result
          const exactMatch = tracks.find(track => 
            track.name.toLowerCase().includes(song.title.toLowerCase()) &&
            track.artists.some(artist => 
              artist.name.toLowerCase().includes(song.artist.toLowerCase())
            )
          );
          
          const trackToAdd = exactMatch || tracks[0];
          trackUris.push(trackToAdd.uri);
        }
      } catch (searchError) {
        console.warn(`Failed to find track: ${song.title} by ${song.artist}`);
      }
    }

    // Add tracks to playlist in batches
    if (trackUris.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < trackUris.length; i += batchSize) {
        const batch = trackUris.slice(i, i + batchSize);
        await spotify.playlists.addItemsToPlaylist(playlist.id, batch);
      }
    }

    return NextResponse.json({
      success: true,
      playlistUrl: playlist.external_urls.spotify,
      playlistId: playlist.id,
      tracksAdded: trackUris.length
    });

  } catch (error) {
    console.error('❌ Spotify API error:', error);
    return NextResponse.json({ 
      error: 'Failed to create Spotify playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

