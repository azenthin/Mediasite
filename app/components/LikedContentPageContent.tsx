'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import VideoCard from './VideoCard';

interface LikedMedia {
  id: string;
  title: string;
  description?: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  views: number;
  createdAt: string;
  uploader?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  _count: {
    likeRecords: number;
    comments: number;
  };
}

const LikedContentPageContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [likedMedia, setLikedMedia] = useState<LikedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch liked videos
  useEffect(() => {
    const fetchLikedVideos = async () => {
      if (!session?.user?.id) return;

      try {
        setLoading(true);
        
        const response = await fetch('/api/profile/liked');
        
        if (response.ok) {
          const data = await response.json();
          setLikedMedia(data.items || []);
        } else {
          throw new Error('Failed to fetch liked videos');
        }

      } catch (err) {
        console.error('Failed to fetch liked videos:', err);
        setError('Failed to load liked videos');
      } finally {
        setLoading(false);
      }
    };

    fetchLikedVideos();
  }, [session?.user?.id]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Loading liked videos...</div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect via useEffect
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#444444] text-white px-6 py-2 rounded-md hover:bg-white hover:text-black transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <h1 className="text-3xl font-bold text-white">Likes</h1>
          </div>
          <p className="text-gray-400">Videos you've liked</p>
        </div>

        {/* Content */}
        {likedMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {likedMedia.map((media) => (
              <VideoCard
                key={media.id}
                video={{
                  id: media.id,
                  title: media.title,
                  description: media.description,
                  type: media.type,
                  url: media.url,
                  thumbnailUrl: media.thumbnailUrl,
                  views: media.views,
                  uploader: media.uploader,
                  _count: media._count
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mb-6">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="text-gray-400 text-xl mb-2">No liked videos yet</div>
            <div className="text-gray-500 text-sm mb-6">
              Start liking videos to see them here
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-[#444444] text-white px-6 py-3 rounded-md hover:bg-white hover:text-black transition-colors"
            >
              Browse Videos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LikedContentPageContent;