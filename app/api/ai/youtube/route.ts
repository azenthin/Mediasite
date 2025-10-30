import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
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
    const youtube = google.youtube({
      version: 'v3',
      auth: accessToken
    });
    timer.end('init_client');

    // Create playlist
    timer.start('create_playlist');
    const playlistResponse = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: playlistName,
          description: `AI-generated playlist: ${playlistName}`,
          defaultLanguage: 'en'
        },
        status: {
          privacyStatus: 'public'
        }
      }
    });
    timer.end('create_playlist');

    const playlistId = playlistResponse.data.id;
    if (!playlistId) {
      throw new Error('Failed to create YouTube playlist');
    }

    // Search for videos and add to playlist
    const videosAdded: string[] = [];
    timer.start('search_and_add');
    const limitedSongs = songs.slice(0, 50);
    await mapWithConcurrency(limitedSongs, 5, async (song) => {
      try {
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: `${song.title} ${song.artist}`,
          type: ['video'],
          maxResults: 1,
          videoCategoryId: '10'
        });
        const videos = searchResponse.data.items;
        if (videos && videos.length > 0) {
          const videoId = videos[0].id?.videoId;
          if (videoId) {
            await youtube.playlistItems.insert({
              part: ['snippet'],
              requestBody: {
                snippet: {
                  playlistId: playlistId,
                  resourceId: { kind: 'youtube#video', videoId }
                }
              }
            });
            videosAdded.push(videoId);
          }
        }
      } catch (e) {
        // swallow per-item errors
      }
    });
    timer.end('search_and_add');

    const res = NextResponse.json({
      success: true,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      playlistId: playlistId,
      videosAdded: videosAdded.length
    });
    res.headers.set('Server-Timing', timer.header());
    return res;

  } catch (error) {
    console.error('❌ YouTube API error:', error);
    const res = NextResponse.json({ 
      error: 'Failed to create YouTube playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    res.headers.set('Server-Timing', new ServerTimer().header());
    return res;
  }
}

