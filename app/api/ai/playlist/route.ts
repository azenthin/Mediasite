import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });
  try {
    const { prompt } = await request.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI music curator that creates personalized playlists based on user prompts. 
          Return ONLY a valid JSON array of songs with this exact structure:
          [
            {
              "title": "Song Title",
              "artist": "Artist Name",
              "genre": "Genre",
              "mood": "Mood/Energy Level",
              "year": "Year (if known)"
            }
          ]
          
          Generate 10-15 songs that match the user's request. Be creative and diverse in your selections.
          Focus on popular, well-known songs that are likely to be found on Spotify and YouTube.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let playlist;
    try {
      // Clean the response in case there are any extra characters
      const cleanedResponse = response.trim();
      playlist = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid response format from AI');
    }

    return NextResponse.json({ 
      success: true,
      playlist,
      prompt 
    });

  } catch (error: any) {
    console.error('❌ AI Playlist API error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

