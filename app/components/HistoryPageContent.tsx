'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoCard from './VideoCard';
import { logImpression, logClick, getOrCreateSessionId } from '@/lib/analytics';

interface HistoryVideoData {
    id: string;
    thumbnailUrl?: string;
    url?: string;
    title: string;
    description?: string;
    type?: string;
    uploader?: {
        username: string;
        displayName?: string;
        avatarUrl?: string;
    };
    views?: number;
    likes?: number;
    _count?: {
        likeRecords: number;
        comments: number;
    };
    watchProgress: number; // 0-1, how much was watched
    watchedAt: string; // ISO date string
}

interface GroupedHistory {
    [date: string]: HistoryVideoData[];
}

const HistoryPageContent = () => {
    const [historyData, setHistoryData] = useState<HistoryVideoData[]>([]);
    const [groupedHistory, setGroupedHistory] = useState<GroupedHistory>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [sessionSeed, setSessionSeed] = useState<string>('');
    const loader = useRef(null);

    useEffect(() => {
        setSessionSeed(getOrCreateSessionId());
    }, []);

    // Group history items by date
    const groupHistoryByDate = useCallback((items: HistoryVideoData[]): GroupedHistory => {
        const grouped: GroupedHistory = {};
        
        items.forEach(item => {
            const date = new Date(item.watchedAt);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dateKey: string;
            if (date.toDateString() === today.toDateString()) {
                dateKey = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateKey = 'Yesterday';
            } else {
                dateKey = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(item);
        });
        
        return grouped;
    }, []);

    // Fetch history data from API
    const fetchHistory = useCallback(async (currentPage: number) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/history?page=${currentPage}&limit=24`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
            }
            
            // Check if response has content before parsing JSON
            const text = await response.text();
            if (!text) {
                throw new Error('Empty response from history API');
            }
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('Failed to parse JSON response:', text);
                throw new Error('Invalid JSON response from history API');
            }
            
            setHistoryData(prevData => {
                const newData = currentPage === 1 ? (data.items || []) : [...prevData, ...(data.items || [])];
                return newData;
            });
            
            setHasMore(data.hasMore || false);
        } catch (err) {
            console.error('Error fetching history:', err);
            setError(err instanceof Error ? err.message : 'Failed to load watch history');
        } finally {
            setLoading(false);
        }
    }, []); // Empty dependency array since the function doesn't depend on any props or state

    // Initial fetch only once
    useEffect(() => {
        fetchHistory(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Remove fetchHistory dependency to prevent infinite loops

    // Update grouped history when historyData changes
    useEffect(() => {
        setGroupedHistory(groupHistoryByDate(historyData));
    }, [historyData]); // Remove groupHistoryByDate dependency

    // Intersection Observer for infinite scrolling
    useEffect(() => {
        const currentLoader = loader.current;
        if (!currentLoader) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage(prevPage => prevPage + 1);
            }
        }, { threshold: 1.0 });

        observer.observe(currentLoader);

        return () => {
            observer.unobserve(currentLoader);
        };
    }, [hasMore, loading]);

    // Fetch more data when page changes
    useEffect(() => {
        if (page > 1) {
            fetchHistory(page);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]); // Remove fetchHistory dependency to prevent infinite loops

    if (loading && historyData.length === 0) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-gray-400">
                    Loading your watch history...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    if (historyData.length === 0) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">📺</div>
                    <h2 className="text-xl font-semibold mb-2">No watch history yet</h2>
                    <p>Start watching some videos to see them here!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
            
            {Object.entries(groupedHistory).map(([dateKey, videos]) => (
                <div key={dateKey} className="mb-8">
                    {/* Date Header */}
                    <div className="flex items-center mb-4">
                        <h2 className="text-xl font-semibold text-white mr-4">{dateKey}</h2>
                        <div className="flex-1 h-px bg-gray-600"></div>
                        <span className="ml-4 text-sm text-gray-400">
                            {videos.length} video{videos.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    {/* Video Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 gap-y-4 mb-6">
                        {videos.map((video, index) => (
                            <div key={video.id} className="relative">
                                <VideoCard 
                                    video={video} 
                                    onImpression={(id, position) => {
                                        logImpression(id, position);
                                    }}
                                    onCardClick={(id, position) => {
                                        logClick(id, position);
                                    }}
                                />
                                
                                {/* Progress Bar Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b-xl overflow-hidden">
                                    <div 
                                        className="h-full bg-red-600 transition-all duration-300"
                                        style={{ width: `${Math.round(video.watchProgress * 100)}%` }}
                                    ></div>
                                </div>
                                
                                {/* Watch Progress Indicator */}
                                {video.watchProgress > 0 && video.watchProgress < 0.95 && (
                                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                        {Math.round(video.watchProgress * 100)}%
                                    </div>
                                )}
                                
                                {/* Completed Indicator */}
                                {video.watchProgress >= 0.95 && (
                                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                        </svg>
                                        Watched
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            {/* Loading More Indicator */}
            {hasMore && (
                <div ref={loader} className="text-center py-4 text-white">
                    {loading ? 'Loading more...' : 'Scroll to load more'}
                </div>
            )}
            
            {/* End of History */}
            {!hasMore && historyData.length > 0 && (
                <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">🎬</div>
                    <p>You've reached the end of your watch history!</p>
                </div>
            )}
        </div>
    );
};

export default HistoryPageContent;