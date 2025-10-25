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
}

const AIPageContent: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
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
    <div className="relative bg-[#0a0a0a] text-white overflow-hidden">
      {/* Ambient background gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            `radial-gradient(600px 600px at 85% -5%, rgba(255,255,255,0.06), transparent 60%),
             radial-gradient(700px 700px at -10% 110%, rgba(255,255,255,0.045), transparent 55%)`,
        }}
      />
      {/* Use the remaining viewport height below the sticky navbar (56px) and avoid body scroll */}
  <div className="relative max-w-3xl md:max-w-4xl mx-auto h-[calc(100vh-56px)] flex flex-col px-5 md:px-6">

        {/* Messages */}
  <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && (
            <div className="text-center text-white/40 py-6">
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`group flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-2.5 shadow-[0_6px_20px_rgba(0,0,0,.25)] [animation:fade-in_250ms_ease-out_both] transition-colors ${
                  message.type === 'user'
                    ? 'bg-white/12 text-white border border-white/8 hover:bg-white/16'
                    : message.type === 'error'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/25 backdrop-blur-sm'
                    : 'bg-white/6 text-white border border-white/6 hover:bg-white/8'
                }`}
              >
                {message.type === 'playlist' && message.playlist ? (
                  <div>
                    {/* Playlist hero header */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div
                        aria-hidden
                        className="w-14 h-14 rounded-md border border-white/8 shadow-inner"
                        style={{ background: coverGradient(message.content || 'Playlist') }}
                        title="Generated cover"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{message.content}</p>
                        <p className="text-xs text-white/60 truncate">AI-generated selection based on your prompt</p>
                      </div>
                    </div>

                    {/* Track list */}
                    <div className="space-y-1.5 mb-3.5">
                      {message.playlist.map((song, index) => (
                        <div key={index} className="flex items-center gap-3 py-1.5 px-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/6 [animation:slide-up_260ms_ease-out_both]">
                          <div className="w-6 text-center text-white/50 text-xs select-none">{index + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{song.title}</p>
                            <p className="text-sm text-white/60 truncate">{song.artist}</p>
                          </div>
                          {song.genre && (
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
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
                ) : (
                  <div className="text-[0.98rem] leading-[1.35]" dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
                {/* Timestamp removed per UX feedback to avoid hover-only empty spacing */}
              </div>
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

  {/* Input - sticky to follow on scroll (fully transparent background) */}
  <div className="sticky bottom-0 z-20 p-4 border-t border-white/10 bg-transparent">
          {/* AI search bar styled to match navbar search */}
          <form onSubmit={handleSubmit} className="flex items-center">
            <div className="relative flex w-full h-11 md:h-12 rounded-full overflow-hidden border border-white/15 bg-white/5 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <input
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
