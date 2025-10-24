import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    // Redirect to Google/YouTube authorization
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ],
      state: state || 'ai-playlist'
    });

    return NextResponse.redirect(authUrl);
  }

  try {
    // Exchange code for access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('Failed to get access token');
    }

    // Redirect back to frontend with token
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('youtube_token', tokens.access_token);
    frontendUrl.searchParams.set('success', 'true');

    return NextResponse.redirect(frontendUrl.toString());

  } catch (error) {
    console.error('❌ YouTube OAuth error:', error);
    const frontendUrl = new URL(process.env.NEXT_PUBLIC_APP_URL + '/ai');
    frontendUrl.searchParams.set('error', 'youtube_auth_failed');
    return NextResponse.redirect(frontendUrl.toString());
  }
}
