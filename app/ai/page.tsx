'use client';

import React, { useState, useRef, useEffect } from 'react';
import App from '../components/Main';

interface Song {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai' | 'playlist' | 'error';
  content: string;
  playlist?: Song[];
  timestamp: Date;
  feedback?: 'like' | 'dislike' | null;
}

const AIPageContent: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Simple gradient generator based on playlist name
  const coverGradient = (seed: string) => {
    const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
    const hue1 = (hash * 29) % 360;
    const hue2 = (hash * 53 + 90) % 360;
    return `linear-gradient(135deg, hsl(${hue1} 50% 22%), hsl(${hue2} 45% 15%))`;
  };

  // Check for OAuth tokens on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyTokenParam = urlParams.get('spotify_token');
    const youtubeTokenParam = urlParams.get('youtube_token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (spotifyTokenParam) {
      setSpotifyToken(spotifyTokenParam);
      addMessage('ai', '✅ Successfully connected to Spotify! You can now create playlists.');
    }
    if (youtubeTokenParam) {
      setYoutubeToken(youtubeTokenParam);
      addMessage('ai', '✅ Successfully connected to YouTube! You can now create playlists.');
    }
    if (error) {
      addMessage('error', `❌ Authentication failed: ${error}`);
    }

    // Clean up URL
    if (success || error) {
      window.history.replaceState({}, '', '/ai');
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type: Message['type'], content: string, playlist?: Song[]) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      playlist,
      timestamp: new Date(),
      feedback: null
    };
    setMessages(prev => [...prev, message]);
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Toggle feedback: if clicking the same type, remove it; otherwise set new type
        return {
          ...msg,
          feedback: msg.feedback === feedbackType ? null : feedbackType
        };
      }
      return msg;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    addMessage('user', userInput);
    
    // Add to conversation history
    const newHistory = [...conversationHistory, { role: 'user', content: userInput }];

    try {
      const response = await fetch('/api/ai/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: userInput,
          conversationHistory: newHistory
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.type === 'conversation') {
          // AI wants to have a conversation
          addMessage('ai', data.message);
          setConversationHistory([...newHistory, { role: 'assistant', content: data.message }]);
        } else if (data.type === 'playlist' && data.playlist) {
          // AI generated a playlist
          const playlistMessage = data.message || `Here's your "${userInput}" playlist:`;
          addMessage('playlist', playlistMessage, data.playlist);
          setConversationHistory([...newHistory, { 
            role: 'assistant', 
            content: `Generated a playlist with ${data.playlist.length} songs` 
          }]);
        } else {
          addMessage('error', data.error || 'Unexpected response format');
        }
      } else {
        addMessage('error', data.error || 'Failed to generate response');
      }
    } catch (error) {
      addMessage('error', 'Failed to connect to AI service');
    } finally {
      setIsLoading(false);
      // Auto-focus input after message is sent
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const createPlaylist = async (platform: 'spotify' | 'youtube', playlistName: string, songs: Song[]) => {
    const token = platform === 'spotify' ? spotifyToken : youtubeToken;
    
    if (!token) {
      // Redirect to OAuth
      const authUrl = `/api/ai/auth/${platform}`;
      window.location.href = authUrl;
      return;
    }

    try {
      const response = await fetch(`/api/ai/${platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          playlistName,
          songs
        }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage('ai', `✅ Playlist created on ${platform.charAt(0).toUpperCase() + platform.slice(1)}! 
        <a href="${data.playlistUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">
          Open Playlist
        </a>`);
      } else {
        addMessage('error', `Failed to create ${platform} playlist: ${data.error}`);
      }
    } catch (error) {
      addMessage('error', `Failed to create ${platform} playlist`);
    }
  };

  return (
    <div className="relative bg-[#141414] text-white overflow-hidden antialiased [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]">
      {/* Content container */}
  <div className="relative max-w-3xl md:max-w-4xl mx-auto flex flex-col px-5 md:px-6 pb-24">

        {/* Messages */}
  <div className="p-4 space-y-6" role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 mt-6 md:mt-10">
              <h1 className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight">
                What are you in the mood for?
              </h1>
              <p className="text-lg md:text-xl text-white/60 mb-8 max-w-2xl">
                Tell me the vibe, and I'll create the perfect playlist.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                <button
                  onClick={() => setInput('Chill study music')}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 text-left transition-all duration-200"
                >
                  <div className="font-medium text-sm">Chill study music</div>
                  <div className="text-xs text-white/50 mt-0.5">Focus and concentration</div>
                </button>
                <button
                  onClick={() => setInput('Upbeat workout playlist')}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 text-left transition-all duration-200"
                >
                  <div className="font-medium text-sm">Upbeat workout playlist</div>
                  <div className="text-xs text-white/50 mt-0.5">High energy motivation</div>
                </button>
                <button
                  onClick={() => setInput('Sad rainy day vibes')}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 text-left transition-all duration-200"
                >
                  <div className="font-medium text-sm">Sad rainy day vibes</div>
                  <div className="text-xs text-white/50 mt-0.5">Melancholic and reflective</div>
                </button>
                <button
                  onClick={() => setInput('Feel-good summer hits')}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 text-left transition-all duration-200"
                >
                  <div className="font-medium text-sm">Feel-good summer hits</div>
                  <div className="text-xs text-white/50 mt-0.5">Sunshine and good vibes</div>
                </button>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`group ${message.type === 'user' ? 'flex justify-end' : ''}`}
            >
              {message.type === 'user' ? (
                <div className="max-w-[85%] px-4 py-2.5 rounded-3xl bg-white/12 text-white text-[15px] [animation:fade-in_250ms_ease-out_both] transition-colors">
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                </div>
              ) : message.type === 'playlist' && message.playlist ? (
                <div className="w-full">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-white/6 text-white border border-white/6 hover:bg-white/8 [animation:fade-in_250ms_ease-out_both] transition-colors">
                    <div>
                      {/* Playlist hero header */}
                      <div className="mb-2.5">
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-[15px]">{message.content}</p>
                          <p className="text-[13px] text-white/60 truncate">AI-generated selection based on your prompt</p>
                        </div>
                      </div>

                      {/* Track list */}
                      <div className="space-y-0 mb-3.5">
                        {message.playlist.map((song, index) => (
                          <div key={index} className="flex items-center gap-3 py-1 px-1 hover:bg-white/[0.03] transition-colors [animation:slide-up_260ms_ease-out_both]">
                            <div className="w-6 text-center text-white/40 text-[12px] select-none">{index + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate leading-5 text-[14px]">{song.title}</p>
                              <p className="text-[13px] text-white/60 truncate leading-4">{song.artist}</p>
                            </div>
                            {song.genre && (
                              <span className="text-[12px] text-white/60 px-2">
                                {song.genre}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* CTAs */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => createPlaylist('spotify', message.content, message.playlist!)}
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_8px_20px_rgba(16,185,129,.25)] focus:outline-none focus:ring-2 focus:ring-green-400/40"
                          aria-label={spotifyToken ? 'Create playlist on Spotify' : 'Connect to Spotify'}
                        >
                          {spotifyToken ? 'Create on Spotify' : 'Connect Spotify'}
                        </button>
                        <button
                          onClick={() => createPlaylist('youtube', message.content, message.playlist!)}
                          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_8px_20px_rgba(239,68,68,.25)] focus:outline-none focus:ring-2 focus:ring-red-400/40"
                          aria-label={youtubeToken ? 'Create playlist on YouTube' : 'Connect to YouTube'}
                        >
                          {youtubeToken ? 'Create on YouTube' : 'Connect YouTube'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Feedback buttons */}
                  <div className="flex gap-2 mt-2 ml-1">
                    <button
                      onClick={() => handleFeedback(message.id, 'like')}
                      className={`p-1.5 rounded-lg transition-all ${
                        message.feedback === 'like' 
                          ? 'bg-white/20 text-white' 
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                      aria-label="Like this response"
                    >
                      <svg className="w-5 h-5" fill={message.feedback === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ WebkitFontSmoothing: 'antialiased', shapeRendering: 'geometricPrecision' }}>
                        <path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'dislike')}
                      className={`p-1.5 rounded-lg transition-all ${
                        message.feedback === 'dislike' 
                          ? 'bg-white/20 text-white' 
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                      aria-label="Dislike this response"
                    >
                      <svg className="w-5 h-5" fill={message.feedback === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ WebkitFontSmoothing: 'antialiased', shapeRendering: 'geometricPrecision' }}>
                        <path d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : message.type === 'error' ? (
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-red-500/20 text-red-300 border border-red-500/25 backdrop-blur-sm [animation:fade-in_250ms_ease-out_both] transition-colors text-[15px]">
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                </div>
              ) : (
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-white/6 text-white border border-white/6 hover:bg-white/8 [animation:fade-in_250ms_ease-out_both] transition-colors text-[15px]">
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl px-4 py-2.5">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Thinking…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

  {/* Input - fixed to bottom edge of viewport, centered to content */}
  <div className="fixed bottom-6 md:bottom-4 left-0 md:left-20 right-0 z-20 bg-transparent">
          <div className="max-w-3xl md:max-w-4xl mx-auto px-5 md:px-6">
          <div className="py-4">
          {/* AI search bar styled to match navbar search */}
          <form onSubmit={handleSubmit} className="flex items-center">
            <div className="relative flex w-full h-11 md:h-12 rounded-full overflow-hidden border border-white/20 bg-white/[0.08] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus-within:border-white/30 focus-within:bg-white/[0.12] focus-within:shadow-[0_0_12px_rgba(255,255,255,0.04)] transition-all duration-200 transform focus-within:-translate-y-1 active:-translate-y-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your perfect playlist..."
                className="search-input w-full h-full pl-4 md:pl-5 pr-12 md:pr-14 py-0 outline-none placeholder-white/60 caret-white text-base md:text-[1.02rem] text-white bg-transparent border-0"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 md:h-9 md:w-9 rounded-full text-white/80 hover:text-white bg-transparent border-0 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send AI prompt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-5 md:w-5 icon-hq" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AIPage = () => {
  return (
    <App>
      <AIPageContent />
    </App>
  );
};

export default AIPage;
