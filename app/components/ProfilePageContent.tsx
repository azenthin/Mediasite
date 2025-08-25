'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import VideoCard from './VideoCard';

interface UserStats {
  uploadsCount: number;
  totalViews: number;
  totalLikes: number;
  subscribersCount: number;
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

interface ProfileTab {
  id: string;
  name: string;
  icon: JSX.Element;
}

const ProfilePageContent = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('uploads');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userMedia, setUserMedia] = useState<UserMedia[]>([]);
  const [likedMedia, setLikedMedia] = useState<UserMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!session?.user?.id) return;

      try {
        setLoading(true);
        
        // Fetch user stats and uploads
        const [statsResponse, uploadsResponse] = await Promise.all([
          fetch('/api/profile/stats'),
          fetch('/api/profile/uploads')
        ]);

        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          setUserStats(stats);
        }

        if (uploadsResponse.ok) {
          const uploads = await uploadsResponse.json();
          setUserMedia(uploads.items || []);
        }

      } catch (err) {
        console.error('Failed to fetch profile data:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [session?.user?.id]);

  const tabs: ProfileTab[] = [
    {
      id: 'uploads',
      name: 'Uploads',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      )
    },
    {
      id: 'statistics',
      name: 'Statistics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  if (status === 'loading' || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-lg">Loading profile...</div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect via useEffect
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'uploads':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Your Uploads</h2>
              <button
                onClick={() => router.push('/upload')}
                className="bg-[#444444] text-white px-4 py-2 rounded-md hover:bg-white hover:text-black transition-colors"
              >
                Upload New
              </button>
            </div>
            
            {userMedia.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {userMedia.map((media) => (
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
                      _count: media._count,
                      uploader: {
                        username: session.user?.username || 'You',
                        displayName: session.user?.displayName || session.user?.username || 'You',
                        avatarUrl: session.user?.avatarUrl || undefined
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-4">No uploads yet</div>
                <button
                  onClick={() => router.push('/upload')}
                  className="bg-[#444444] text-white px-6 py-3 rounded-md hover:bg-white hover:text-black transition-colors"
                >
                  Upload Your First Video
                </button>
              </div>
            )}
          </div>
        );

      case 'statistics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Statistics</h2>
            
            {userStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-[#282828] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-2">{userStats.uploadsCount}</div>
                  <div className="text-gray-400">Uploads</div>
                </div>
                
                <div className="bg-[#282828] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-2">{userStats.totalViews.toLocaleString()}</div>
                  <div className="text-gray-400">Total Views</div>
                </div>
                
                <div className="bg-[#282828] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-2">{userStats.totalLikes}</div>
                  <div className="text-gray-400">Total Likes</div>
                </div>
                
                <div className="bg-[#282828] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-2">{userStats.subscribersCount}</div>
                  <div className="text-gray-400">Subscribers</div>
                </div>
              </div>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Account Settings</h2>
            
            <div className="bg-[#282828] rounded-lg p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  defaultValue={session.user?.displayName || session.user?.username || ''}
                  className="w-full px-3 py-2 bg-[#444444] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={session.user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 bg-[#333333] border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              
              <div className="pt-4">
                <button className="bg-[#444444] text-white px-6 py-2 rounded-md hover:bg-white hover:text-black transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Profile Header */}
        <div className="bg-[#282828] rounded-lg p-8 mb-8">
          <div className="flex items-center space-x-6">
            <img
              src={session.user?.avatarUrl || `https://placehold.co/100x100/555555/ffffff?text=${(session.user?.displayName || session.user?.username || 'U').charAt(0).toUpperCase()}`}
              alt="Profile"
              className="w-24 h-24 rounded-full"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                {session.user?.displayName || session.user?.username || 'User'}
              </h1>
              <p className="text-gray-400 mb-4">{session.user?.email}</p>
              
              {userStats && (
                <div className="flex space-x-6 text-sm">
                  <span className="text-gray-300">
                    <strong className="text-white">{userStats.uploadsCount}</strong> uploads
                  </span>
                  <span className="text-gray-300">
                    <strong className="text-white">{userStats.totalViews.toLocaleString()}</strong> total views
                  </span>
                  <span className="text-gray-300">
                    <strong className="text-white">{userStats.subscribersCount}</strong> subscribers
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-700 mb-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-lg">{error}</div>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePageContent;
