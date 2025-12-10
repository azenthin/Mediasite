'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type Song = {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: string | number;
};

type AIPlaylist = {
  id: string;
  name: string;
  prompt: string;
  songs: Song[];
  createdAt: string;
};

const PlaylistsPageContent = () => {
  const { data: session, status } = useSession();
  const [playlists, setPlaylists] = useState<AIPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPlaylists();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-playlists');
      if (!res.ok) {
        throw new Error('Failed to fetch playlists');
      }
      const data = await res.json();
      setPlaylists(data.playlists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const togglePlaylist = (id: string) => {
    setExpandedPlaylist(expandedPlaylist === id ? null : id);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading your playlists...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">My AI Playlists</h2>
          <p className="text-lg mb-4">Please sign in to view your saved playlists</p>
          <a
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4 text-red-500">Error</h2>
          <p className="text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">My AI Playlists</h2>
          <p className="text-lg mb-4">No playlists yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Generate your first playlist using the AI music curator
          </p>
          <a
            href="/ai"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Create Playlist
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-white">My AI Playlists</h1>
      
      <div className="space-y-4">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition cursor-pointer"
            onClick={() => togglePlaylist(playlist.id)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-white mb-1">{playlist.name}</h2>
                <p className="text-sm text-gray-400 mb-2">
                  Prompt: <span className="italic">&ldquo;{playlist.prompt}&rdquo;</span>
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(playlist.createdAt).toLocaleDateString()} • {playlist.songs.length} songs
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-white transition ml-4"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlaylist(playlist.id);
                }}
              >
                <svg
                  className={`w-6 h-6 transition-transform ${
                    expandedPlaylist === playlist.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPlaylist === playlist.id && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h3 className="text-lg font-medium text-white mb-3">Songs:</h3>
                <div className="space-y-2">
                  {playlist.songs.map((song, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-gray-900 rounded hover:bg-gray-850 transition"
                    >
                      <span className="text-gray-500 font-mono text-sm min-w-[2rem]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="flex-1">
                        <p className="text-white font-medium">{song.title}</p>
                        <p className="text-sm text-gray-400">{song.artist}</p>
                        {(song.genre || song.mood || song.year) && (
                          <div className="flex gap-2 mt-1">
                            {song.genre && (
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                {song.genre}
                              </span>
                            )}
                            {song.mood && (
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                {song.mood}
                              </span>
                            )}
                            {song.year && (
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                {song.year}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaylistsPageContent;