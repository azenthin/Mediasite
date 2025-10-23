import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, playlistName, songs } = await request.json();

    if (!accessToken || !playlistName || !songs || !Array.isArray(songs)) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: accessToken
    });

    // Create playlist
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

    const playlistId = playlistResponse.data.id;
    if (!playlistId) {
      throw new Error('Failed to create YouTube playlist');
    }

    // Search for videos and add to playlist
    const videosAdded: string[] = [];
    
    for (const song of songs.slice(0, 50)) { // YouTube API has limits
      try {
        const searchResponse = await youtube.search.list({
          part: ['snippet'],
          q: `${song.title} ${song.artist}`,
          type: ['video'],
          maxResults: 1,
          videoCategoryId: '10' // Music category
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
                  resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                  }
                }
              }
            });
            videosAdded.push(videoId);
          }
        }
      } catch (searchError) {
        console.warn(`Failed to find video: ${song.title} by ${song.artist}`);
      }
    }

    return NextResponse.json({
      success: true,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      playlistId: playlistId,
      videosAdded: videosAdded.length
    });

  } catch (error) {
    console.error('❌ YouTube API error:', error);
    return NextResponse.json({ 
      error: 'Failed to create YouTube playlist',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

