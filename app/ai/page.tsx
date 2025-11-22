'use client';

import React, { useState, useRef, useEffect } from 'react';
import App from '../components/Main';
import MobileMenu from '../components/MobileMenu';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface Song {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: string | number;
  spotifyUrl?: string;
  youtubeUrl?: string;
  verified?: boolean;
  source?: 'genre-match' | 'fuzzy-match' | 'search-fallback' | 'ai-generated';
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
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const pathname = usePathname();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.reload();
  };

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
    const spotifyEmail = urlParams.get('spotify_email');
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

    // Use a timeout wrapper to avoid hanging & offer a fast-model retry on timeout
    async function postWithTimeout(body: any, timeoutMs = 10000, preferredModel?: string) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (preferredModel) headers['x-preferred-model'] = preferredModel;
        const res = await fetch('/api/ai/playlist', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        return await res.json();
      } finally {
        clearTimeout(id);
      }
    }

    try {
      const tStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (typeof performance !== 'undefined') performance.mark('ai_request_start');
      let data;
      try {
        // Increased timeout to 20s to allow for Spotify/YouTube verification
        data = await postWithTimeout({ prompt: userInput, conversationHistory: newHistory }, 20000);
      } catch (err) {
        // timeout or abort — retry once forcing faster model
        try {
          // eslint-disable-next-line no-console
          console.info('AI request timed out — retrying with faster model');
          data = await postWithTimeout({ prompt: userInput, conversationHistory: newHistory }, 25000, 'gpt-4o-mini');
        } catch (err2) {
          throw err2;
        }
      }
      const response = { json: async () => data, ok: true };
      if (typeof performance !== 'undefined') performance.mark('ai_response_received');
      const dataParsed = await response.json();
      if (typeof performance !== 'undefined') {
        performance.mark('ai_response_parsed');
        performance.measure('ai_request_network', 'ai_request_start', 'ai_response_received');
        performance.measure('ai_response_parse', 'ai_response_received', 'ai_response_parsed');
        const net = performance.getEntriesByName('ai_request_network').pop();
        const parse = performance.getEntriesByName('ai_response_parse').pop();
        const total = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tStart;
        // eslint-disable-next-line no-console
        console.log(`AI request: total=${total.toFixed(1)}ms, network=${net?.duration.toFixed(1)}ms, parse=${parse?.duration.toFixed(1)}ms`);
        performance.clearMarks('ai_request_start');
        performance.clearMarks('ai_response_received');
        performance.clearMarks('ai_response_parsed');
        performance.clearMeasures('ai_request_network');
        performance.clearMeasures('ai_response_parse');
      }
      const dataFinal = dataParsed;
      if (dataFinal.success) {
        if (dataFinal.type === 'conversation') {
          addMessage('ai', dataFinal.message);
          setConversationHistory([...newHistory, { role: 'assistant', content: dataFinal.message }]);
        } else if (dataFinal.type === 'playlist' && dataFinal.playlist) {
          const playlistMessage = dataFinal.message || `Here's your "${userInput}" playlist:`;
          addMessage('playlist', playlistMessage, dataFinal.playlist);
          setConversationHistory([...newHistory, {
            role: 'assistant',
            content: `Generated a playlist with ${dataFinal.playlist.length} songs`,
          }]);
        } else {
          addMessage('error', dataFinal.error || 'Unexpected response format');
        }
      } else {
        addMessage('error', dataFinal.error || 'Failed to generate response');
      }
    } catch (error) {
      console.error('AI service error:', error);
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
      if (typeof performance !== 'undefined') performance.mark(`${platform}_create_start`);
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
      if (typeof performance !== 'undefined') performance.mark(`${platform}_create_response`);
      const data = await response.json();
      if (typeof performance !== 'undefined') {
        performance.mark(`${platform}_create_parsed`);
        performance.measure(`${platform}_create_network`, `${platform}_create_start`, `${platform}_create_response`);
        performance.measure(`${platform}_create_parse`, `${platform}_create_response`, `${platform}_create_parsed`);
        const net = performance.getEntriesByName(`${platform}_create_network`).pop();
        const parse = performance.getEntriesByName(`${platform}_create_parse`).pop();
        // eslint-disable-next-line no-console
        console.log(`${platform} create: network=${net?.duration.toFixed(1)}ms, parse=${parse?.duration.toFixed(1)}ms`);
        performance.clearMarks(`${platform}_create_start`);
        performance.clearMarks(`${platform}_create_response`);
        performance.clearMarks(`${platform}_create_parsed`);
        performance.clearMeasures(`${platform}_create_network`);
        performance.clearMeasures(`${platform}_create_parse`);
      }

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

  // Hybrid Spotify playback: try Web API first, fall back to URI scheme
  const playTrackOnSpotify = async (trackId: string) => {
    // Extract Spotify track ID from URI if needed
    const extractedId = trackId.includes('spotify:track:') 
      ? trackId.replace('spotify:track:', '') 
      : trackId;

    // If no token, prompt user to authenticate
    if (!spotifyToken) {
      addMessage('ai', '🔐 You need to connect your Spotify account first to play songs directly. Click "Connect Spotify" to authenticate.');
      return;
    }

    // Try Web API first
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [`spotify:track:${extractedId}`],
        }),
      });

      // 204 No Content is success for Spotify API
      if (response.status === 204 || response.ok) {
        console.log('Track started via Web API');
        return;
      } else if (response.status === 401) {
        // Token expired or invalid
        addMessage('ai', '⚠️ Your Spotify connection expired. Please reconnect by clicking "Connect Spotify".');
        setSpotifyToken(null);
      }
    } catch (error) {
      console.warn('Web API playback failed, falling back to URI scheme:', error);
    }

    // Fallback: use URI scheme
    window.location.href = `spotify:track:${extractedId}`;
  };

  const handleSongClick = (song: Song) => {
    const hasSpotify = !!song.spotifyUrl;
    const hasYoutube = !!song.youtubeUrl;

    // If both platforms available, show modal
    if (hasSpotify && hasYoutube) {
      setSelectedSong(song);
      setShowPlatformModal(true);
    } else if (hasSpotify && song.spotifyUrl) {
      // Only Spotify available, open directly via hybrid approach
      playTrackOnSpotify(song.spotifyUrl);
    } else if (hasYoutube && song.youtubeUrl) {
      // Only YouTube available, open directly
      window.open(song.youtubeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const openPlatform = (platform: 'spotify' | 'youtube') => {
    if (!selectedSong) return;
    
    if (platform === 'spotify' && selectedSong.spotifyUrl) {
      // Use hybrid approach for Spotify
      playTrackOnSpotify(selectedSong.spotifyUrl);
    } else if (platform === 'youtube' && selectedSong.youtubeUrl) {
      // YouTube uses regular window.open
      window.open(selectedSong.youtubeUrl, '_blank', 'noopener,noreferrer');
    }
    
    setShowPlatformModal(false);
    setSelectedSong(null);
  };

  return (
    <div className="relative bg-[#141414] text-white overflow-hidden antialiased [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]">
      {/* Hide default navbar on mobile */}
      <style jsx global>{`
        @media (max-width: 768px) {
          #navbar-container {
            display: none !important;
          }
        }
      `}</style>

      {/* Custom Mobile Header - Only visible on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Title */}
          <h1 className="text-base font-semibold text-white">AI Playlist Generator</h1>

          {/* Profile Picture */}
          {session ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-label="Profile menu"
                className="flex-shrink-0"
              >
                {session.user?.avatarUrl ? (
                  <img 
                    src={session.user.avatarUrl} 
                    alt={session.user?.displayName || session.user?.username || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm border border-white/20">
                    {(session.user?.displayName || session.user?.username || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-medium text-white truncate">
                      {session.user?.displayName || session.user?.username}
                    </p>
                    <p className="text-xs text-white/60 truncate">{session.user?.email}</p>
                  </div>
                  <button
                    onClick={() => window.location.href = '/profile'}
                    className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPath={pathname}
      />

      {/* Content container */}
  <div className="relative max-w-3xl md:max-w-4xl mx-auto flex flex-col px-5 md:px-6 pb-24 pt-16 md:pt-0">

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
                          <p className="text-[13px] text-white/60 truncate">
                            {message.playlist[0]?.source === 'genre-match' && '🎯 Genre-based recommendations'}
                            {message.playlist[0]?.source === 'search-fallback' && '🔍 Search results'}
                            {message.playlist[0]?.source === 'ai-generated' && '🤖 AI-generated selection'}
                            {!message.playlist[0]?.source && 'AI-generated selection based on your prompt'}
                          </p>
                        </div>
                      </div>

                      {/* Track list */}
                      <div className="space-y-0 mb-3.5">
                        {message.playlist.map((song, index) => (
                          <div key={index} className="flex items-center gap-3 py-1 px-1 hover:bg-white/[0.03] transition-colors [animation:slide-up_260ms_ease-out_both]">
                            <div className="w-6 text-center text-white/40 text-[12px] select-none">{index + 1}</div>
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => handleSongClick(song)}
                                className="font-medium truncate leading-5 text-[14px] hover:text-green-400 transition-colors block text-left w-full"
                              >
                                {song.title}
                              </button>
                              <p className="text-[13px] text-white/60 truncate leading-4">{song.artist}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {song.spotifyUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playTrackOnSpotify(song.spotifyUrl!);
                                    }}
                                    className="text-green-500 hover:text-green-400 transition-colors"
                                    aria-label="Open on Spotify"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                  </button>
                                )}
                                {song.youtubeUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(song.youtubeUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="text-red-500 hover:text-red-400 transition-colors"
                                    aria-label="Open on YouTube"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* CTAs */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!session) {
                              // Not logged in - redirect to Spotify OAuth (which will sign them up)
                              window.location.href = '/api/ai/auth/spotify';
                            } else if (!spotifyToken) {
                              // Logged in but no token - just get the token
                              window.location.href = '/api/ai/auth/spotify';
                            } else {
                              // Logged in with token - create playlist
                              createPlaylist('spotify', message.content, message.playlist!);
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_8px_20px_rgba(16,185,129,.25)] focus:outline-none focus:ring-2 focus:ring-green-400/40"
                          aria-label={spotifyToken ? 'Create playlist on Spotify' : session ? 'Add Spotify account' : 'Sign in with Spotify'}
                        >
                          {spotifyToken ? 'Create on Spotify' : session ? 'Add Spotify' : 'Sign in with Spotify'}
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

        {/* Platform Selection Modal */}
        {showPlatformModal && selectedSong && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowPlatformModal(false);
              setSelectedSong(null);
            }}
          >
            <div 
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2 text-white">Choose platform</h3>
              <p className="text-sm text-white/60 mb-6">
                {selectedSong.title} • {selectedSong.artist}
              </p>
              
              <div className="space-y-3">
                {selectedSong.spotifyUrl && (
                  <button
                    onClick={() => openPlatform('spotify')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-green-600 hover:bg-green-700 transition-all duration-200 group"
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white">Open in Spotify</div>
                      <div className="text-xs text-white/80">Stream audio</div>
                    </div>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                
                {selectedSong.youtubeUrl && (
                  <button
                    onClick={() => openPlatform('youtube')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-600 hover:bg-red-700 transition-all duration-200 group"
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white">Open in YouTube</div>
                      <div className="text-xs text-white/80">Watch video</div>
                    </div>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              
              <button
                onClick={() => {
                  setShowPlatformModal(false);
                  setSelectedSong(null);
                }}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all duration-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
