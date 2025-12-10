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

const heroPrompts = [
  { title: 'Chill study', description: 'Focus & flow', prompt: 'Chill study playlist with ambient electronica and soft beats' },
  { title: 'Uplifting pop', description: 'Weekend energy', prompt: 'Uplifting pop hits with positive lyrics for weekend drives' },
  { title: 'Late-night jazz', description: 'After hours', prompt: 'Late-night jazz with muted trumpets and smoky piano trios' },
  { title: 'Throwback hip-hop', description: "90s classics", prompt: 'Throwback hip-hop from 1994-2002 with storytelling verses' },
];

const randomPrompts = [
  'Energetic 2020s EDM and trap workout playlist with fast tempo',
  'Romantic 1950s jazz with muted trumpet and slow tempo',
  'Upbeat 1970s-80s classic rock anthems for road trips',
  'Calming ambient spa music with very slow tempo',
  'Exciting 2023-2024 pop and dance party hits',
  'Cozy acoustic 2010s indie folk for morning coffee',
  'Focused chill lo-fi hip hop beats for coding sessions',
  'Happy summer beach vibes with tropical house and reggaeton',
  'Sad and slow 1990s shoegaze and dream pop',
  'Epic and dramatic cinematic orchestral music',
  'Dark industrial underground Berlin techno',
  'Nostalgic 1980s synthwave and retrowave classics',
  'Heartfelt storytelling 2000s country and southern rock',
  'Vibrant and upbeat 2022-2024 K-pop hits with high energy',
  'Peaceful and very slow meditation with tibetan singing bowls',
  'Angry and aggressive 2000s punk rock with fast tempo',
  'Smooth and groovy 1960s-70s soul and motown',
  'Intense gaming music with dubstep and drum & bass',
  'Hot and passionate Latin dance party with salsa and bachata',
  'Lively acoustic bluegrass and folk music',
  'Dreamy lo-fi 2018-2023 bedroom pop',
  'Raw 1990s grunge and alternative rock',
  'Smooth 1960s Brazilian bossa nova',
  'Epic instrumental post-rock playlist with slow builds',
  'Feel-good 1970s disco with funky and groovy basslines',
  'Energetic 2010s electro house for late night parties',
  'Chill 2000s R&B and neo-soul for relaxing evenings',
  'Heavy 2010s metal and hard rock with powerful riffs',
  'Classic 1990s hip hop with boom bap beats',
  'Uplifting 2020s future bass and melodic dubstep',
  'Mellow 1970s folk rock with acoustic guitars',
  'Dark 2010s trap and drill with heavy bass',
  'Bright and happy 2010s indie pop for good vibes',
  'Intense 2000s emo and screamo with emotional vocals',
  'Groovy 1980s funk and boogie with slap bass',
  'Atmospheric 2010s ambient and downtempo electronica',
  'Fast 1990s jungle and breakbeat with choppy drums',
  'Smooth 2000s contemporary jazz with piano',
  'Powerful 2010s progressive house for festivals',
  'Warm 1960s folk with storytelling lyrics',
  'Aggressive 2020s hardstyle and hardcore techno',
  'Relaxing 2010s chillhop and jazzhop instrumentals',
  'Upbeat 1950s rock and roll with twangy guitars',
  'Deep 2010s deep house with smooth basslines',
  'Energetic 2000s garage rock and post-punk revival',
  'Soulful 1970s blues rock with electric guitar solos',
  'Modern 2020s hyperpop with experimental production',
  'Classic 1960s psychedelic rock with trippy effects',
  'Minimal 2010s minimal techno with repetitive patterns',
  'Catchy 2020s pop punk with power chords',
];

const heroStats = [
  { label: 'Playlists generated', value: '48k+', detail: 'since launch' },
  { label: 'Tracks verified', value: '1.2M', detail: 'clean metadata' },
  { label: 'Avg. response', value: '1.8s', detail: 'global median' },
  { label: 'Connected apps', value: 'Spotify + YouTube', detail: 'export ready' },
];

const featureHighlights = [
  { title: 'Verified sources', body: 'Every track is matched against Spotify IDs for guaranteed accuracy.', tag: 'Accuracy', icon: '🛡️' },
  { title: 'One-click playback', body: 'Choose Spotify or YouTube instantly, with your preferred platform remembered.', tag: 'Playback', icon: '⚡️' },
  { title: 'Smart history', body: 'Conversations stay in context so you can refine the vibe instead of starting over.', tag: 'Memory', icon: '💡' },
];

const verifiedSources = ['Spotify', 'YouTube', 'Genius', 'AcousticBrainz'];

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

  // Spotify playback: use URI scheme to open in Spotify app/web player
  const playTrackOnSpotify = async (trackId: string) => {
    // Extract Spotify track ID from URI if needed
    const extractedId = trackId.includes('spotify:track:') 
      ? trackId.replace('spotify:track:', '') 
      : trackId;

    // Open in Spotify - works without authentication
    // User's browser will either open Spotify app or web player
    window.location.href = `spotify:track:${extractedId}`;
  };

  const handleComposerChange = (value: string) => {
    setInput(value);
  };

  const handleTypingPrompt = (promptText: string) => {
    // Clear input first
    setInput('');
    
    // Scroll to search bar
    const searchInput = document.getElementById('mood-ai-input');
    searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Type out the prompt character by character
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= promptText.length) {
        setInput(promptText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 15); // 15ms delay between each character
    
    // Focus after typing is done
    setTimeout(() => searchInput?.focus(), promptText.length * 15 + 100);
  };

  const handleRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * randomPrompts.length);
    const selectedPrompt = randomPrompts[randomIndex];
    handleTypingPrompt(selectedPrompt);
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
    <div className="relative min-h-screen text-white overflow-hidden antialiased [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale] bg-transparent">
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

      {/* Hero intro */}
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 pt-12 pb-16 lg:pt-16 text-white flex flex-col gap-8 lg:gap-10 min-h-[70vh]">
        <div className="flex flex-col gap-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.55em] text-white/60">AI Curated</div>
          <div className="flex items-start gap-27">
            <div className="space-y-4" style={{ maxWidth: 'calc(100% - 160px)' }}>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                Discover the soundtrack for
                <span className="block">every moment.</span>
              </h1>
              <p className="text-lg text-white/70 max-w-3xl">
                Describe your vibe in a single sentence and MediaSite pairs it with verified sources, export-ready playlists, and instant playback controls.
              </p>
            </div>
            
            <div className="hidden lg:block flex-shrink-0 mt-2">
              <button
                type="button"
                onClick={() => {
                  const searchInput = document.getElementById('mood-ai-input');
                  searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => searchInput?.focus(), 500);
                }}
                className="relative w-36 h-36 rounded-full bg-[length:400%_400%] animate-[gradientShift_6s_ease-in-out_infinite] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-500 ease-out cursor-pointer group antialiased"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #8b5cf6, #06b6d4, #a78bfa, #ec4899, #8b5cf6)',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  WebkitFontSmoothing: 'antialiased'
                }}
                aria-label="Go to AI search"
              >
                <span className="text-6xl font-bold text-white transition-all duration-500 antialiased drop-shadow-[0_6px_4px_rgba(0,0,0,0.7)]" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}>AI</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {heroPrompts.map((prompt) => (
              <button
                key={prompt.title}
                type="button"
                onClick={() => {
                  handleTypingPrompt(prompt.prompt);
                }}
                className="flex h-full flex-col justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10"
              >
                <span>{prompt.title}</span>
                <span className="text-[11px] font-normal text-white/60">{prompt.description}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-lg font-semibold text-white">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">{stat.label}</div>
                <p className="text-[11px] text-white/60">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.4em] text-white/60">
            <span>Verified with</span>
            {verifiedSources.map((source) => (
              <span key={source} className="rounded-full border border-white/10 px-3 py-1 text-white/80">
                {source}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {featureHighlights.map((highlight) => (
              <div key={highlight.title} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-5">
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <span className="text-2xl leading-none">{highlight.icon}</span>
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/60">{highlight.tag}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{highlight.title}</h3>
                <p className="text-sm text-white/60">{highlight.body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Content container */}
      <div
        className="relative max-w-3xl md:max-w-4xl mx-auto flex flex-col px-5 md:px-6 pb-24 pt-12"
      >

        {/* Messages */}
  <div className={`${messages.length === 0 ? 'p-0' : 'p-4'} space-y-6`} role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[calc(100vh-220px)] px-3">
              <div className="w-full max-w-4xl px-6 py-10 sm:px-12 sm:py-16">
                <div className="text-center space-y-6">
                  <div>
                    <h1 className="text-4xl md:text-[3.2rem] font-semibold text-white tracking-tight">
                      What are you in the mood for?
                    </h1>
                    <p className="text-lg md:text-xl text-white/65 mt-3">
                      Tell me the vibe, and I'll create the perfect playlist.
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
                    <label className="sr-only" htmlFor="mood-ai-input">Describe your perfect playlist</label>
                    <div
                      className="relative flex items-center rounded-full p-[6px] shadow-[0_15px_50px_rgba(2,10,52,0.55)] bg-[length:200%_200%] animate-[rainbowFlow_8s_linear_infinite]"
                      style={{
                        backgroundImage: 'linear-gradient(120deg, #3da3cc, #4a3acc, #8b5cf6, #3da3cc)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleRandomPrompt}
                        className="ml-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f6a7ff] via-[#7a6cff] to-[#4bd9ff] text-white text-lg font-semibold shadow-[0_8px_18px_rgba(79,70,255,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 hover:scale-105 active:scale-95 transition-transform"
                        aria-label="Random playlist suggestion"
                      >
                        ?
                      </button>
                      <input
                        id="mood-ai-input"
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe your perfect playlist..."
                        className="flex-1 h-11 bg-transparent text-base md:text-lg text-white placeholder-white/70 px-4 !outline-none !ring-0 !border-0"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        disabled={isLoading}
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="mr-0.5 inline-flex items-center justify-center rounded-full bg-white text-slate-900 px-6 py-2 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-60"
                      >
                        Generate
                      </button>
                    </div>
                  </form>
                </div>
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
