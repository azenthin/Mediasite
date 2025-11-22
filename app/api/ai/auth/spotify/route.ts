import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Log environment variables for debugging (only in production to identify issues)
  console.log('🎵 Spotify OAuth Debug:', {
    hasCode: !!code,
    hasError: !!error,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    clientId: process.env.SPOTIFY_CLIENT_ID?.slice(0, 10) + '...'
  });

  // Handle Spotify error responses
  if (error) {
    console.error('❌ Spotify OAuth Error:', error, searchParams.get('error_description'));
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('error', `spotify_auth_denied: ${error}`);
    return NextResponse.redirect(frontendUrl.toString());
  }

  if (!code) {
    // Redirect to Spotify authorization
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URI!);
    authUrl.searchParams.set('scope', 'playlist-modify-public playlist-modify-private user-read-private user-read-email');
    authUrl.searchParams.set('state', state || 'ai-playlist');

    console.log('🎵 Redirecting to Spotify authorize:', authUrl.toString());
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
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ Spotify token exchange failed:', tokenData);
      throw new Error(`Token exchange failed: ${tokenData.error} - ${tokenData.error_description}`);
    }

    console.log('✅ Got Spotify access token');

    // Get Spotify user info
    const spotifyUserResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const spotifyUser = await spotifyUserResponse.json();

    if (!spotifyUserResponse.ok) {
      console.error('❌ Failed to fetch Spotify user:', spotifyUser);
      throw new Error('Failed to fetch user profile from Spotify');
    }

    if (!spotifyUser.email) {
      console.error('❌ No email from Spotify:', spotifyUser);
      throw new Error('Unable to get email from Spotify');
    }

    console.log('✅ Got Spotify user:', spotifyUser.email);

    // Ensure user exists in database (for sign-up via Spotify)
    let user = await prisma.user.findUnique({
      where: { email: spotifyUser.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: spotifyUser.email,
          username: spotifyUser.id + '_' + Math.random().toString(36).substr(2, 5),
          displayName: spotifyUser.display_name || spotifyUser.email.split('@')[0],
          avatarUrl: spotifyUser.images?.[0]?.url || undefined,
          password: '' // Spotify auth, no password
        }
      });
      console.log('✅ Created new user:', spotifyUser.email);
    } else {
      // Update user with latest Spotify info
      user = await prisma.user.update({
        where: { email: spotifyUser.email },
        data: {
          displayName: spotifyUser.display_name || user.displayName,
          avatarUrl: spotifyUser.images?.[0]?.url || user.avatarUrl
        }
      });
      console.log('✅ Updated existing user:', spotifyUser.email);
    }

    // Redirect back to frontend with token and user info
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('spotify_token', tokenData.access_token);
    frontendUrl.searchParams.set('spotify_email', spotifyUser.email);
    frontendUrl.searchParams.set('success', 'true');

    console.log('✅ Redirecting to frontend with token');
    return NextResponse.redirect(frontendUrl.toString());

  } catch (error) {
    console.error('❌ Spotify OAuth error:', error instanceof Error ? error.message : error);
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('error', error instanceof Error ? error.message : 'spotify_auth_failed');
    return NextResponse.redirect(frontendUrl.toString());
  }
}

