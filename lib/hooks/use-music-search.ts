import { useState, useEffect, useCallback } from 'react';

// Generate a persistent session ID for the user's browsing session
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const storageKey = 'music_session_id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  releaseDate?: Date;
  canonicalityScore: number;
  spotify: {
    id?: string;
    url?: string | null;
  };
  isrc?: string;
  mbid?: string;
}

interface SearchOptions {
  q?: string;
  genre?: string;
  mood?: string;
  artist?: string;
  limit?: number;
  offset?: number;
  shuffle?: boolean;
  excludeRecent?: boolean;
}

interface BrowseOptions {
  genre?: string;
  mood?: string;
  minScore?: number;
  limit?: number;
  excludeViewed?: boolean;
}

interface SearchResult {
  tracks: Track[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  session: {
    id?: string;
    excludedCount: number;
  };
}

interface BrowseResult {
  tracks: Track[];
  pagination: {
    total: number;
    limit: number;
    hasMore: boolean;
  };
  session: {
    id?: string;
    viewedCount: number;
  };
}

export function useMusicSearch() {
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const search = useCallback(async (options: SearchOptions): Promise<SearchResult | null> => {
    if (!sessionId) return null;
    
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.q) params.set('q', options.q);
      if (options.genre) params.set('genre', options.genre);
      if (options.mood) params.set('mood', options.mood);
      if (options.artist) params.set('artist', options.artist);
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.offset) params.set('offset', options.offset.toString());
      if (options.shuffle !== undefined) params.set('shuffle', options.shuffle.toString());
      if (options.excludeRecent !== undefined) params.set('excludeRecent', options.excludeRecent.toString());
      params.set('sessionId', sessionId);

      const response = await fetch(`/api/music/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const browse = useCallback(async (options: BrowseOptions = {}): Promise<BrowseResult | null> => {
    if (!sessionId) return null;
    
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.genre) params.set('genre', options.genre);
      if (options.mood) params.set('mood', options.mood);
      if (options.minScore !== undefined) params.set('minScore', options.minScore.toString());
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.excludeViewed !== undefined) params.set('excludeViewed', options.excludeViewed.toString());
      params.set('sessionId', sessionId);

      const response = await fetch(`/api/music/browse?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Browse failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Browse failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const resetSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('music_session_id');
      setSessionId(getOrCreateSessionId());
    }
  }, []);

  return {
    search,
    browse,
    resetSession,
    sessionId,
    loading,
    error,
  };
}
