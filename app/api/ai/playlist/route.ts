import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  const apiKey = "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";
  
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
- If asked about non-playlist topics, politely redirect: "I'm specialized in creating music playlists. How can I help you discover the perfect playlist today?"

RESPONSE TYPES:
1. CONVERSATION: For clarifying questions, discussing preferences, or responding to feedback
   - Return: {"type": "conversation", "message": "your response"}
   
2. PLAYLIST: When ready to generate or update a playlist
   - Return: {"type": "playlist", "message": "brief intro", "songs": [...]}

PLAYLIST FORMAT:
[
  {
    "title": "Song Title",
    "artist": "Artist Name", 
    "genre": "Genre",
    "mood": "Mood/Energy",
    "year": "Year"
  }
]

INTERACTION GUIDELINES:
- Ask clarifying questions if the request is vague
- Remember previous context in the conversation
- Suggest refinements if the user seems unsatisfied
- Be enthusiastic about music
- Keep responses concise
- Always stay on topic (music playlists only)`
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

