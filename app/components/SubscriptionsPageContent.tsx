'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import VideoCard from './VideoCard';

interface Channel {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  subscribersCount: number;
  uploadsCount: number;
}

interface Subscription {
  id: string;
  createdAt: string;
  channel: Channel;
}

interface ChannelWithLatestVideos extends Channel {
  latestVideos: any[];
}

const SubscriptionsPageContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [channelsWithVideos, setChannelsWithVideos] = useState<ChannelWithLatestVideos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch subscriptions and their latest videos
  useEffect(() => {
    const fetchSubscriptions = async () => {
      if (!session?.user?.id) return;

      try {
        setLoading(true);

        // Fetch user's subscriptions
        const subsResponse = await fetch('/api/subscriptions');
        if (!subsResponse.ok) throw new Error('Failed to fetch subscriptions');
        
        const subsData = await subsResponse.json();
        setSubscriptions(subsData.subscriptions || []);

        // Fetch latest videos for each subscribed channel
        const channelsData = await Promise.all(
          (subsData.subscriptions || []).map(async (sub: Subscription) => {
            try {
              const videosResponse = await fetch(`/api/media?uploaderId=${sub.channel.id}&limit=6`);
              if (!videosResponse.ok) return { ...sub.channel, latestVideos: [] };
              
              const videosData = await videosResponse.json();
              return {
                ...sub.channel,
                latestVideos: videosData.media || []
              };
            } catch (e) {
              console.error(`Failed to fetch videos for ${sub.channel.username}:`, e);
              return { ...sub.channel, latestVideos: [] };
            }
          })
        );

        setChannelsWithVideos(channelsData);

      } catch (err) {
        console.error('Failed to fetch subscriptions:', err);
        setError('Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [session?.user?.id]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Loading subscriptions...</div>
      </div>
    );
  }

  if (!session) {
    return null;
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

  if (subscriptions.length === 0) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Subscriptions</h1>
            <p className="text-gray-400">Channels you're subscribed to</p>
          </div>
          
          <div className="text-center py-12">
            <div className="mb-6">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="text-gray-400 text-xl mb-2">No subscriptions yet</div>
            <div className="text-gray-500 text-sm mb-6">
              Subscribe to channels to see their latest videos here
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-[#444444] text-white px-6 py-3 rounded-md hover:bg-white hover:text-black transition-colors"
            >
              Discover Channels
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Subscriptions</h1>
          <p className="text-gray-400">
            {subscriptions.length} {subscriptions.length === 1 ? 'channel' : 'channels'}
          </p>
        </div>

        {/* Channels with their latest videos */}
        <div className="space-y-12">
          {channelsWithVideos.map((channel) => (
            <div key={channel.id} className="space-y-4">
              {/* Channel Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                <div className="flex items-center space-x-4">
                  <img
                    src={channel.avatarUrl || `https://placehold.co/60x60/555555/ffffff?text=${channel.username.charAt(0).toUpperCase()}`}
                    alt={channel.displayName || channel.username}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {channel.displayName || channel.username}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {channel.subscribersCount.toLocaleString()} {channel.subscribersCount === 1 ? 'subscriber' : 'subscribers'}
                      {' • '}
                      {channel.uploadsCount} {channel.uploadsCount === 1 ? 'video' : 'videos'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => router.push(`/profile/${channel.id}`)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Latest Videos */}
              {channel.latestVideos.length > 0 ? (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {channel.latestVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No videos yet from this channel
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsPageContent;