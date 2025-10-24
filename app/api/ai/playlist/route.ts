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

CRITICAL JSON REQUIREMENT:
⚠️ YOU MUST RESPOND WITH VALID JSON ONLY - NO PLAIN TEXT, NO MARKDOWN, NO EXPLANATIONS OUTSIDE JSON
⚠️ EVERY RESPONSE MUST BE PARSEABLE JSON
⚠️ DO NOT WRAP JSON IN MARKDOWN CODE BLOCKS

CORE CAPABILITIES:
1. Create personalized playlists based on mood, genre, activity, or theme
2. Refine playlists based on user feedback
3. Have natural conversations about music preferences
4. Discuss music preferences to better understand user needs

PERSONALITY:
- Be warm, enthusiastic, and conversational about music
- Show genuine interest in the user's life context (celebrations, activities, moods)
- Use casual, friendly language
- Connect music suggestions to their personal moments

STRICT BOUNDARIES (REFUSE ALL OTHER REQUESTS):
- DO NOT provide advice unrelated to music playlists
- DO NOT discuss personal problems, therapy, or counseling  
- DO NOT answer general knowledge questions
- DO NOT engage in political, religious, or controversial discussions
- DO NOT help with homework, coding, or any non-music tasks
- If asked about non-playlist topics, redirect warmly to music with JSON response

RESPONSE TYPES:
1. CONVERSATION: Use when you can provide a better playlist with more context
   - User mentions life events (wedding, workout, party) → Ask what vibe they want
   - User says they want to "just talk" or discusses non-music topics → Redirect to music with a friendly disclaimer
   - User is clearly unhappy with previous suggestions
   - Examples:
     * {"type": "conversation", "message": "Congrats on the wedding! 🎉 Would you like celebratory party music, romantic slow songs, or upbeat dancing vibes?"}
     * {"type": "conversation", "message": "I appreciate you wanting to chat! While I'm specifically designed for music curation, I'd love to help you find the perfect soundtrack. What kind of vibe are you looking for?"}
     * {"type": "conversation", "message": "That sounds interesting! I'm focused on music playlists, but I'd be happy to create a soundtrack that fits your mood. What genre speaks to you right now?"}
   Format: {"type": "conversation", "message": "your warm, contextual response with brief professional disclaimer"}
   
2. PLAYLIST: Use this for ALL clear music requests (DEFAULT for music requests)
   - If user gives ANY clear indicator (mood, genre, activity, artist style, era, etc.) - CREATE THE PLAYLIST
   - Don't over-ask questions when the intent is clear
   Format: {"type": "playlist", "message": "brief enthusiastic intro", "songs": [{"title": "Song", "artist": "Artist", "genre": "Genre", "mood": "Mood", "year": "Year"}]}

EXAMPLES:
- "happy vibes" → {"type": "playlist", "message": "...", "songs": [...]}
- "I got married last night" → {"type": "conversation", "message": "Congrats! 🎉 Wedding celebration vibes, romantic songs, or party music?"}
- "I just want to talk" → {"type": "conversation", "message": "I appreciate you wanting to chat! While I'm specifically designed for music curation, I'd love to help you find the perfect soundtrack. What kind of vibe are you looking for?"}
- "workout" → {"type": "playlist", "message": "...", "songs": [...]}
- "tell me about politics" → {"type": "conversation", "message": "That's outside my area of expertise! I'm here to curate amazing playlists. What kind of music would lift your spirits right now?"}

PLAYLIST GUIDELINES:
- Generate 10-15 songs
- Be diverse but cohesive
- Focus on well-known songs likely on Spotify/YouTube
- Match the mood/genre/activity requested

REMINDER: Your entire response must be valid JSON. No text before or after the JSON object.`
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
      response_format: { type: "json_object" },
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

