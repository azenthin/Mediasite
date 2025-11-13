'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import VideoCard from '@/app/components/VideoCard';

interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  subscribersCount: number;
  uploadsCount: number;
  totalViews: number;
}

interface UserMedia {
  id: string;
  title: string;
  description?: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  views: number;
  createdAt: string;
  _count: {
    likeRecords: number;
    comments: number;
  };
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [media, setMedia] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const profileRes = await fetch(`/api/profile/user/${username}`);
        if (!profileRes.ok) {
          throw new Error('User not found');
        }
        const profileData = await profileRes.json();
        setProfile(profileData);
        
        // Fetch user's uploads
        const mediaRes = await fetch(`/api/profile/user/${username}/uploads`);
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          setMedia(mediaData.items || []);
        }
        
        // Check subscription status if logged in
        if (session?.user?.id) {
          const subRes = await fetch(`/api/subscriptions/check?userId=${profileData.id}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            setIsSubscribed(subData.isSubscribed);
          }
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchProfile();
    }
  }, [username, session]);

  const handleSubscribe = async () => {
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    try {
      const res = await fetch('/api/subscriptions', {
        method: isSubscribed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribedToId: profile?.id })
      });

      if (res.ok) {
        setIsSubscribed(!isSubscribed);
        setProfile(prev => prev ? {
          ...prev,
          subscribersCount: prev.subscribersCount + (isSubscribed ? -1 : 1)
        } : null);
      }
    } catch (err) {
      console.error('Subscription error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] pt-20 px-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <div className="text-gray-400">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] pt-20 px-6">
        <div className="max-w-6xl mx-auto text-center py-20">
          <div className="text-red-400 mb-4">{error || 'Profile not found'}</div>
          <button
            onClick={() => router.push('/')}
            className="bg-[#444444] text-white px-6 py-2 rounded-md hover:bg-white hover:text-black transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-[#282828] rounded-lg p-8 mb-8">
          <div className="flex items-start space-x-6">
            <img
              src={profile.avatarUrl || `https://placehold.co/120x120/555555/ffffff?text=${profile.username.charAt(0).toUpperCase()}`}
              alt={profile.displayName || profile.username}
              className="w-32 h-32 rounded-full"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                {profile.displayName || profile.username}
              </h1>
              <p className="text-gray-400 mb-4">@{profile.username}</p>
              
              <div className="flex space-x-6 text-sm mb-6">
                <span className="text-gray-300">
                  <strong className="text-white">{profile.uploadsCount}</strong> uploads
                </span>
                <span className="text-gray-300">
                  <strong className="text-white">{profile.totalViews.toLocaleString()}</strong> views
                </span>
                <span className="text-gray-300">
                  <strong className="text-white">{profile.subscribersCount}</strong> subscribers
                </span>
              </div>

              {session?.user?.username !== username && (
                <button
                  onClick={handleSubscribe}
                  className={`px-6 py-2 rounded-md font-semibold transition-colors ${
                    isSubscribed
                      ? 'bg-[#444444] text-white hover:bg-[#555555]'
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User's Uploads */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Uploads</h2>
          {media.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {media.map((item) => (
                <VideoCard
                  key={item.id}
                  video={{
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    url: item.url,
                    thumbnailUrl: item.thumbnailUrl,
                    views: item.views,
                    _count: item._count,
                    uploader: {
                      username: profile.username,
                      displayName: profile.displayName,
                      avatarUrl: profile.avatarUrl
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg">No uploads yet</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
