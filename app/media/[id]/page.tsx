'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { prisma } from '@/lib/database';

interface MediaData {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  category?: string;
  views: number;
  likes: number;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export default function MediaPlayerPage() {
  const params = useParams();
  const [media, setMedia] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const response = await fetch(`/api/media/${params.id}`);
        if (!response.ok) {
          throw new Error('Media not found');
        }
        const data = await response.json();
        setMedia(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchMedia();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading media...</p>
        </div>
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Media Not Found</h1>
          <p className="text-gray-400 mb-4">{error || 'The requested media could not be found.'}</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const renderMediaPlayer = () => {
    switch (media.type) {
      case 'VIDEO':
        return (
          <video
            controls
            className="w-full max-w-4xl mx-auto rounded-lg shadow-lg"
            poster={media.thumbnailUrl}
          >
            <source src={media.url} type="video/mp4" />
            <source src={media.url} type="video/webm" />
            <source src={media.url} type="video/ogg" />
            Your browser does not support the video tag.
          </video>
        );

      case 'AUDIO':
        return (
          <div className="w-full max-w-2xl mx-auto bg-[#282828] rounded-lg p-8 shadow-lg">
            <div className="text-center mb-6">
              <div className="w-32 h-32 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.5 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.5l3.883-3.293zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">{media.title}</h2>
            </div>
            <audio controls className="w-full">
              <source src={media.url} type="audio/mpeg" />
              <source src={media.url} type="audio/wav" />
              <source src={media.url} type="audio/ogg" />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case 'IMAGE':
        return (
          <div className="w-full max-w-4xl mx-auto">
            <img
              src={media.url}
              alt={media.title}
              className="w-full rounded-lg shadow-lg"
            />
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-400">Unsupported media type</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Media Player */}
        <div className="mb-8">
          {renderMediaPlayer()}
        </div>

        {/* Media Info */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#282828] rounded-lg p-6 shadow-lg">
            <div className="flex items-start space-x-4 mb-4">
              <img
                src={media.uploader.avatarUrl || "https://placehold.co/40x40/555555/ffffff?text=U"}
                alt={media.uploader.displayName || media.uploader.username}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">{media.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>{media.uploader.displayName || media.uploader.username}</span>
                  <span>•</span>
                  <span>{new Date(media.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{media.views} views</span>
                  <span>•</span>
                  <span>{media.likes} likes</span>
                </div>
              </div>
            </div>

            {media.description && (
              <div className="mb-4">
                <p className="text-gray-300 whitespace-pre-wrap">{media.description}</p>
              </div>
            )}

            {media.category && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Category:</span>
                <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm">
                  {media.category}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}