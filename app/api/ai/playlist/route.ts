import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }
  
  console.log('✅ OpenAI API key loaded, length:', apiKey.length);
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });
  try {
    const { prompt, conversationHistory } = await request.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content: `You are a specialized AI music curator designed EXCLUSIVELY for creating and refining music playlists.

CORE CAPABILITIES:
1. Create personalized playlists based on mood, genre, activity, or theme
2. Refine playlists based on user feedback
3. Answer questions about playlist suggestions
4. Discuss music preferences to better understand user needs

STRICT BOUNDARIES (REFUSE ALL OTHER REQUESTS):
- DO NOT provide advice unrelated to music playlists
- DO NOT discuss personal problems, therapy, or counseling
- DO NOT answer general knowledge questions
- DO NOT engage in political, religious, or controversial discussions
- DO NOT help with homework, coding, or any non-music tasks
- If asked about non-playlist topics, politely redirect with JSON: {"type": "conversation", "message": "I'm specialized in creating music playlists. How can I help you discover the perfect playlist today?"}

CRITICAL: You MUST respond with valid JSON only. No plain text.

RESPONSE TYPES:
1. CONVERSATION: ONLY use this when:
   - The request is extremely vague (e.g., just "music" with no context)
   - User explicitly expresses dissatisfaction (e.g., "I don't like these", "not what I wanted")
   - User asks a direct question about the playlist
   Format: {"type": "conversation", "message": "your response"}
   
2. PLAYLIST: Use this for ALL normal playlist requests (this is the DEFAULT)
   - If user gives ANY clear indicator (mood, genre, activity, artist style, era, etc.) - CREATE THE PLAYLIST immediately
   - Don't ask clarifying questions unless truly ambiguous
   Format: {"type": "playlist", "message": "brief intro", "songs": [{"title": "Song", "artist": "Artist", "genre": "Genre", "mood": "Mood", "year": "Year"}]}

EXAMPLES:
- "happy vibes" → PLAYLIST (clear mood, make upbeat songs)
- "workout" → PLAYLIST (clear activity, make energetic songs)
- "90s rock" → PLAYLIST (clear genre/era, make 90s rock songs)
- "chill study music" → PLAYLIST (clear mood/activity)
- "music" → CONVERSATION (too vague)
- "I don't like these songs" → CONVERSATION (dissatisfaction)

PLAYLIST GUIDELINES:
- Generate 10-15 songs
- Be diverse but cohesive
- Focus on well-known songs likely on Spotify/YouTube
- Match the mood/genre/activity requested

ALWAYS respond in valid JSON format`
      }
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    // Add current user message
    messages.push({
      role: "user",
      content: prompt
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let result;
    try {
      const cleanedResponse = response.trim();
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid response format from AI');
    }

    // Handle different response types
    if (result.type === 'conversation') {
      return NextResponse.json({ 
        success: true,
        type: 'conversation',
        message: result.message
      });
    } else if (result.type === 'playlist') {
      return NextResponse.json({ 
        success: true,
        type: 'playlist',
        message: result.message,
        playlist: result.songs,
        prompt 
      });
    } else {
      // Legacy format support (direct array)
      if (Array.isArray(result)) {
        return NextResponse.json({ 
          success: true,
          type: 'playlist',
          playlist: result,
          prompt 
        });
      }
      throw new Error('Invalid response structure from AI');
    }

  } catch (error: any) {
    console.error('❌ AI Playlist API error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

