import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    // Redirect to Spotify authorization
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URI!);
    authUrl.searchParams.set('scope', 'playlist-modify-public playlist-modify-private');
    authUrl.searchParams.set('state', state || 'ai-playlist');

    return NextResponse.redirect(authUrl.toString());
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Redirect back to frontend with token
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('spotify_token', tokenData.access_token);
    frontendUrl.searchParams.set('success', 'true');

    return NextResponse.redirect(frontendUrl.toString());

  } catch (error) {
    console.error('❌ Spotify OAuth error:', error);
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('error', 'spotify_auth_failed');
    return NextResponse.redirect(frontendUrl.toString());
  }
}

