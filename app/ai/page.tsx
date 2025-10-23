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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto h-[90vh] flex flex-col px-4">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI Playlist Generator
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-white/40 py-8">
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'error'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-white/5 text-white'
                }`}
              >
                {message.type === 'playlist' && message.playlist ? (
                  <div>
                    <p className="mb-3">{message.content}</p>
                    <div className="space-y-2 mb-4">
                      {message.playlist.map((song, index) => (
                        <div key={index} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                          <div>
                            <p className="font-medium">{song.title}</p>
                            <p className="text-sm text-white/60">{song.artist}</p>
                          </div>
                          {song.genre && (
                            <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                              {song.genre}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => createPlaylist('spotify', message.content, message.playlist!)}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {spotifyToken ? 'Create on Spotify' : 'Connect Spotify'}
                      </button>
                      <button
                        onClick={() => createPlaylist('youtube', message.content, message.playlist!)}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {youtubeToken ? 'Create on YouTube' : 'Connect YouTube'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
                <div className="text-xs text-white/40 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating your playlist...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your perfect playlist..."
              className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Send
            </button>
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
