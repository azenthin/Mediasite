import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import ServerTimer from '@/lib/server-timing';
import logger from '@/lib/logger';
import { createRateLimit } from '@/lib/rate-limit';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';
import { verifySongs, getSpotifyRecommendations } from '@/lib/music-search';

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatCompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
type ChatCompletionChoice = ChatCompletionResponse['choices'][number];
type ChatCompletionContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

function extractChoiceContent(choice: ChatCompletionChoice): string | null {
  const message = choice?.message;
  if (!message) return null;

  const { content, tool_calls: toolCalls } = message;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const combined = (content as ChatCompletionContentPart[])
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object') {
          if ('text' in part && typeof (part as { text?: string }).text === 'string') {
            return (part as { text?: string }).text ?? '';
          }
        }
        return '';
      })
      .join('');
    if (combined.trim().length > 0) {
      return combined;
    }
  }

  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    for (const call of toolCalls) {
      if (call?.function?.arguments && call.function.arguments.trim().length > 0) {
        return call.function.arguments;
      }
    }
  }

  return null;
}

// Simple per-route rate limiting to protect the AI endpoint
const limiter = createRateLimit({
  windowMs: 60_000,
  maxRequests: 12,
  message: 'Too many playlist requests. Please try again in a minute.'
});

type CachedPayload = {
  result: Record<string, unknown>;
  expiresAt: number;
  source: 'spotify' | 'ai';
};

const PROMPT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const promptCache = new Map<string, CachedPayload>();

function normalizeHistory(history?: ConversationMessage[]) {
  if (!Array.isArray(history) || history.length === 0) return [];
  return history.slice(-3).map((item) => `${item.role}:${item.content}`.toLowerCase());
}

function buildCacheKey(prompt: string, conversationHistory?: ConversationMessage[]) {
  const base = prompt.trim().toLowerCase();
  const historyKey = normalizeHistory(conversationHistory).join('|');
  return historyKey ? `${base}::${historyKey}` : base;
}

function getCachedResponse(cacheKey: string) {
  const cached = promptCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    promptCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedResponse(cacheKey: string, payload: CachedPayload) {
  promptCache.set(cacheKey, payload);
}

export async function POST(request: NextRequest) {
  // Apply rate limit before any heavy work
  const limited = limiter(request);
  if (limited) return limited;

  const timer = new ServerTimer();
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    logger.error('OPENAI_API_KEY not found in environment', undefined, {
      component: 'api.ai.playlist',
    });
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }
  
  // API key present; avoid logging secrets or derived values in production
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });
  let usedModel: string | null = null;
  try {
    timer.start('parse_body');
  const { prompt, conversationHistory } = await request.json();
    timer.end('parse_body');

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const sanitizedHistory = Array.isArray(conversationHistory)
      ? conversationHistory
          .filter((entry): entry is ConversationMessage => {
            return (
              !!entry &&
              (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system') &&
              typeof entry.content === 'string' &&
              entry.content.trim().length > 0
            );
          })
          .slice(-3)
      : [];

    const cacheKey = buildCacheKey(prompt, sanitizedHistory);
    const cachedResponse = cacheKey ? getCachedResponse(cacheKey) : null;
    if (cachedResponse) {
      logger.info('Serving playlist response from cache', {
        component: 'api.ai.playlist',
        cacheSource: cachedResponse.source,
      });
      const res = NextResponse.json(cachedResponse.result);
      res.headers.set('X-Cache', 'HIT');
      res.headers.set('X-Cache-Source', cachedResponse.source);
      res.headers.set('Server-Timing', timer.header());
      return res;
    }

    // Always try Spotify first since this is the AI playlist endpoint
    // If Spotify fails or returns no results, we'll fall back to AI generation
    let spotifyTracks: any[] = [];
    timer.start('spotify_recommendations');
    try {
      console.log(`🎵 Attempting to get Spotify recommendations for: "${prompt}"`);
      spotifyTracks = await getSpotifyRecommendations(prompt, 15);
      
      if (spotifyTracks.length > 0) {
        logger.info('Got Spotify recommendations', {
          component: 'api.ai.playlist',
          trackCount: spotifyTracks.length,
        });
      } else {
        logger.info('No Spotify results, will use AI generation', {
          component: 'api.ai.playlist',
        });
      }
    } catch (spotifyError) {
      logger.warn('Failed to get Spotify recommendations, falling back to AI', {
        component: 'api.ai.playlist',
        error: spotifyError instanceof Error ? spotifyError.message : String(spotifyError),
      });
    }
    timer.end('spotify_recommendations');

    // If we got real songs from Spotify, use them directly
    if (spotifyTracks.length > 0) {
      // Get authenticated user (optional - only save if logged in)
      const session = await safeAuth();
      const userId = session?.user?.id;

      // Save playlist to database if user is authenticated
      if (userId) {
        try {
          const playlistName = `${prompt.slice(0, 50)}`;
          await prisma.aIPlaylist.create({
            data: {
              userId,
              name: playlistName,
              prompt,
              songs: JSON.stringify(spotifyTracks),
            },
          });
          logger.info('Saved Spotify playlist to database', {
            component: 'api.ai.playlist',
            userId,
            trackCount: spotifyTracks.length,
          });
        } catch (dbError) {
          logger.warn('Failed to save Spotify playlist to database', {
            component: 'api.ai.playlist',
            userId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }
      }

      const payload = {
        success: true,
        type: 'playlist',
        message: `Explore the vibe of ${prompt}!`,
        playlist: spotifyTracks,
      };
      if (cacheKey) {
        setCachedResponse(cacheKey, {
          result: payload,
          expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
          source: 'spotify',
        });
      }
      const res = NextResponse.json(payload);
      res.headers.set('Server-Timing', timer.header());
      res.headers.set('X-Source', 'spotify-recommendations');
      logger.performance('ai.playlist.total', timer.elapsed(), {
        action: 'playlist',
        source: 'spotify',
        trackCount: spotifyTracks.length,
      });
      return res;
    }

    // Build messages array with the full playlist curation instructions
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content: `You are Mediasite's AI music curator. Return a single JSON object—no markdown, no narration outside JSON.

Response types:
- Conversation: use when intent is unclear, chatty, or non-music. Reply {"type":"conversation","message":"two short sentences of warm guidance back to music"}.
- Playlist: default for clear music prompts of any vibe, mood, genre, era, activity, or "surprise" requests. Reply {"type":"playlist","message":"<=120 characters","songs":[{"title":"","artist":"","genre?":"","mood?":"","year?":""}]}. 

Style and safety: be warm, professional, and enthusiastic about music only; reject politics, therapy, homework, or coding by returning a conversation response that gently redirects to music.

Playlist rules: choose a random integer between 12 and 15 and output exactly that many songs; mix ~60% familiar favorites with ~40% discoveries; span multiple eras, cultures, and subgenres; avoid obvious global top-100 repeats; select tracks available on Spotify and YouTube; never ask follow-up questions when intent is already clear. **VARIETY IS ESSENTIAL**: each request should produce meaningfully different results—vary artist choices, explore different sub-genres, mix eras creatively, and rotate through lesser-known gems even for repeat requests. Treat each request as a unique opportunity to showcase different facets of the genre/mood.

Output discipline: keep every string concise—song field values should be short phrases (<=6 words) with no explanatory sentences, omit optional fields when unknown instead of inventing prose, and never add extra commentary. The final JSON must be compact and syntactically valid.`
  }
    ];

    // Add a small slice of conversation history for context
    if (sanitizedHistory.length > 0) {
      messages.push(...sanitizedHistory.slice(-2));
    }

    // Add current user message
    messages.push({
      role: "user",
      content: prompt
    });

  // Decide model ordering: ALWAYS prefer gpt-4o-mini first, then gpt-5 as a fallback.
  // We will still log if a client suggested a preferred model via header but we
  // will not allow that to change the ordering — this enforces gpt-4o-mini as primary.
  const headerPreferred = request.headers.get('x-preferred-model');
  const normalizeModel = (model: string) => {
    const lowered = (model || '').toLowerCase();
    if (lowered === 'gpt-5-mini') {
      return 'gpt-5';
    }
    if (lowered.startsWith('gpt-5')) {
      return 'gpt-5';
    }
    // default and fallthrough
    return 'gpt-4o-mini';
  };

  if (headerPreferred) {
    logger.info('Client requested preferred model via header; honoring request in logs but enforcing gpt-4o-mini as primary', {
      component: 'api.ai.playlist',
      headerPreferred,
    });
  }

  // Hard-coded cascade: try gpt-4o-mini first, then gpt-5 if the first fails.
  const modelQueue = [normalizeModel('gpt-4o-mini'), normalizeModel('gpt-5')];
    let completion: ChatCompletionResponse | null = null;
    let responseContent: string | null = null;
    let lastError: Error | null = null;

    timer.start('openai_call');
    try {
    for (const model of modelQueue) {
      usedModel = model;
        try {
          const isGpt5Family = model.toLowerCase().startsWith('gpt-5');
          const baseOptions: ChatCompletionParams = {
            model,
            messages,
            temperature: 1.0,
            response_format: { type: 'json_object' },
            ...(isGpt5Family
              ? { reasoning_effort: 'low' as const }
              : {}),
          };

          completion = await openai.chat.completions.create({
            ...baseOptions,
            ...(isGpt5Family
              ? {
                  max_completion_tokens: 10000,
                }
              : {
                  max_tokens: 2000,
                  top_p: 0.9,
                }),
          });

          // Log finish reason and usage for telemetry/debugging
          try {
            const attemptFinish = completion.choices?.[0]?.finish_reason ?? null;
            // completion.usage can be undefined depending on response
            const attemptUsage = (completion as any)?.usage ?? null;
            logger.info('AI model attempt result', {
              component: 'api.ai.playlist',
              model,
              finishReason: attemptFinish,
              usage: attemptUsage,
            });
          } catch (logErr) {
            // non-fatal logging failure
            logger.warn('Failed to log AI attempt usage/finishReason', {
              component: 'api.ai.playlist',
              model,
              error: (logErr as Error).message,
            });
          }

          responseContent = extractChoiceContent(completion.choices[0]);

          if (!responseContent || responseContent.trim().length === 0) {
            const finishReason = completion.choices[0]?.finish_reason;
            logger.warn('AI model returned empty content', {
              component: 'api.ai.playlist',
              model,
              finishReason,
            });

            if (finishReason === 'length' || finishReason === 'content_filter') {
              lastError = new Error(`Model ${model} returned no content (${finishReason}).`);
              continue;
            }

            lastError = new Error(`Model ${model} returned no content.`);
            continue;
          }

          // Successfully obtained content; break out of loop
          break;
        } catch (attemptError: unknown) {
          const formattedError = attemptError instanceof Error
            ? attemptError
            : new Error(String(attemptError));
          lastError = formattedError;
          logger.warn('AI model attempt failed', {
            component: 'api.ai.playlist',
            model,
            error: formattedError.message,
          });
          completion = null;
          responseContent = null;
        }
      }
    } finally {
      timer.end('openai_call');
    }

    if (!completion || !responseContent) {
      throw lastError ?? new Error('OpenAI completion was not generated');
    }

    const response = responseContent;

    // Parse the JSON response
    timer.start('parse_ai_json');
    let result;
    const cleanedResponse = response.trim();
    try {
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response', parseError instanceof Error ? parseError : undefined, {
        component: 'api.ai.playlist',
        responsePreview: cleanedResponse.slice(0, 200),
      });
      throw new Error('Invalid response format from AI');
    }
    timer.end('parse_ai_json');

    // Handle different response types
    const fallbackOccurred = usedModel && usedModel !== 'gpt-4o-mini';

    // Get authenticated user (optional - only save if logged in)
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (result.type === 'conversation') {
      const payload = {
        success: true,
        type: 'conversation',
        message: result.message,
      };
      if (cacheKey) {
        setCachedResponse(cacheKey, {
          result: payload,
          expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
          source: 'ai',
        });
      }
      const res = NextResponse.json(payload);
      res.headers.set('Server-Timing', timer.header());
      res.headers.set('X-AI-Model', String(usedModel));
      if (fallbackOccurred) res.headers.set('X-AI-Fallback', 'true');
      logger.performance('ai.playlist.total', timer.elapsed(), {
        action: 'conversation',
        model: usedModel,
      });
      return res;
    } else if (result.type === 'playlist') {
      // Verify and enrich songs with Spotify/YouTube links
      timer.start('verify_songs');
      let verifiedSongs = result.songs;
      try {
        if (Array.isArray(result.songs) && result.songs.length > 0) {
          verifiedSongs = await verifySongs(result.songs);
          logger.info('Verified songs with Spotify/YouTube', {
            component: 'api.ai.playlist',
            totalSongs: result.songs.length,
            verifiedCount: verifiedSongs.filter((s: any) => s.verified).length,
          });
        }
      } catch (verifyError) {
        logger.warn('Song verification failed, using AI suggestions', {
          component: 'api.ai.playlist',
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
        });
        // Fall back to AI suggestions if verification fails
      }
      timer.end('verify_songs');
      
      // Save playlist to database if user is authenticated
      if (userId && Array.isArray(verifiedSongs) && verifiedSongs.length > 0) {
        try {
          const playlistName = result.message || `Playlist: ${prompt.slice(0, 50)}`;
          await prisma.aIPlaylist.create({
            data: {
              userId,
              name: playlistName,
              prompt,
              songs: JSON.stringify(verifiedSongs),
            },
          });
          logger.info('Saved AI playlist to database', {
            component: 'api.ai.playlist',
            userId,
            trackCount: verifiedSongs.length,
          });
        } catch (dbError) {
          // Non-fatal: log but don't fail the request
          logger.warn('Failed to save AI playlist to database', {
            component: 'api.ai.playlist',
            userId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }
      }

      const payload = {
        success: true,
        type: 'playlist',
        message: result.message,
        playlist: verifiedSongs,
        prompt,
      };
      if (cacheKey) {
        setCachedResponse(cacheKey, {
          result: payload,
          expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
          source: 'ai',
        });
      }
      const res = NextResponse.json(payload);
      res.headers.set('Server-Timing', timer.header());
      res.headers.set('X-AI-Model', String(usedModel));
      if (fallbackOccurred) res.headers.set('X-AI-Fallback', 'true');
      logger.performance('ai.playlist.total', timer.elapsed(), {
        action: 'playlist',
        model: usedModel,
        trackCount: Array.isArray(result.songs) ? result.songs.length : undefined,
      });
      return res;
    } else {
      // Legacy format support (direct array)
      if (Array.isArray(result)) {
        // Save playlist to database if user is authenticated
        if (userId && result.length > 0) {
          try {
            await prisma.aIPlaylist.create({
              data: {
                userId,
                name: `Playlist: ${prompt.slice(0, 50)}`,
                prompt,
                songs: JSON.stringify(result),
              },
            });
            logger.info('Saved AI playlist to database (legacy format)', {
              component: 'api.ai.playlist',
              userId,
              trackCount: result.length,
            });
          } catch (dbError) {
            logger.warn('Failed to save AI playlist to database', {
              component: 'api.ai.playlist',
              userId,
              error: dbError instanceof Error ? dbError.message : String(dbError),
            });
          }
        }

        const payload = {
          success: true,
          type: 'playlist',
          playlist: result,
          prompt,
        };
        if (cacheKey) {
          setCachedResponse(cacheKey, {
            result: payload,
            expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
            source: 'ai',
          });
        }
        const res = NextResponse.json(payload);
        res.headers.set('Server-Timing', timer.header());
        res.headers.set('X-AI-Model', String(usedModel));
        if (fallbackOccurred) res.headers.set('X-AI-Fallback', 'true');
        logger.performance('ai.playlist.total', timer.elapsed(), {
          action: 'playlist-legacy',
          model: usedModel,
          trackCount: result.length,
        });
        return res;
      }
      throw new Error('Invalid response structure from AI');
    }

  } catch (error: any) {
    logger.error('AI Playlist API error', error instanceof Error ? error : undefined, {
      component: 'api.ai.playlist',
      model: typeof usedModel === 'string' ? usedModel : 'unknown',
    });
    const res = NextResponse.json({ 
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
    res.headers.set('Server-Timing', timer.header());
    return res;
  }
}

