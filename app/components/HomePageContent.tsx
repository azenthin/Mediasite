'use client';

import React, { useState, useEffect } from 'react';
import CategoryBar from './CategoryBar';
import VideoCard from './VideoCard';
import { pagePreloader } from '@/lib/preloader';

interface VideoData {
    id?: string;
    thumbnailUrl?: string;
    url?: string; // Media URL (video/image)
    title: string;
    description?: string;
    type?: string; // "VIDEO", "IMAGE", "AUDIO"
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
    // Legacy fields for mock data compatibility
    profilePicUrl?: string;
    channel?: string;
}

// Mock data for video cards
const mockVideoData: VideoData[] = [
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+1",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+1",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C1",
        title: "Building an awesome app with React and Tailwind CSS",
        channel: "Dev Adventures",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+2",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+2",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C2",
        title: "10 tips for writing clean code in JavaScript",
        channel: "Code Mastery",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+3",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+3",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C3",
        title: "Why web components are making a comeback",
        channel: "Front-end Fun",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+4",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+4",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C4",
        title: "A quick look at the new CSS features",
        channel: "CSS Tricks",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+5",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+5",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C5",
        title: "Getting started with Next.js 14",
        channel: "NextGen Devs",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+6",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+6",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C6",
        title: "The power of Tailwind CSS without the boilerplate",
        channel: "Tailwind Tales",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+7",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+7",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C7",
        title: "From Figma to front-end: A designer's perspective",
        channel: "Design to Code",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+8",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+8",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C8",
        title: "Build a responsive navbar in 5 minutes",
        channel: "Rapid Builds",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+9",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+9",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C9",
        title: "An introduction to server components in React",
        channel: "React Rocks",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+10",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+10",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C10",
        title: "The future of CSS is here!",
        channel: "Future Dev",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+11",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+11",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C11",
        title: "The ultimate guide to state management in React",
        channel: "State of Mind",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+12",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+12",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C12",
        title: "Accessibility tips for modern web apps",
        channel: "Inclusive Code",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+13",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+13",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C13",
        title: "Performance optimization for web applications",
        channel: "Web Wizards",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+14",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+14",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C14",
        title: "What's new in the world of web development?",
        channel: "Tech Talk",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+15",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+15",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C15",
        title: "The art of writing clear code comments",
        channel: "Code Craft",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+16",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+16",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C16",
        title: "Debugging a React application like a pro",
        channel: "Debug Demigods",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+17",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+17",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C17",
        title: "Mastering TypeScript in 2024",
        channel: "TypeScript Pro",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+18",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+18",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C18",
        title: "Building microservices with Node.js",
        channel: "Backend Boss",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+19",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+19",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C19",
        title: "The complete guide to Docker containers",
        channel: "DevOps Daily",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+20",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+20",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C20",
        title: "GraphQL vs REST: Which to choose?",
        channel: "API Academy",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+21",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+21",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C21",
        title: "Testing strategies for React applications",
        channel: "Test Masters",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+22",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+22",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C22",
        title: "Deploying apps to the cloud made easy",
        channel: "Cloud Coders",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+23",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+23",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C23",
        title: "The future of web development tools",
        channel: "Tool Time",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+24",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+24",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C24",
        title: "Building accessible web applications",
        channel: "A11y Advocates",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+25",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+25",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C25",
        title: "Optimizing images for web performance",
        channel: "Performance Pros",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+26",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+26",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C26",
        title: "Security best practices for developers",
        channel: "Secure Code",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+27",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+27",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C27",
        title: "The art of code review",
        channel: "Review Rangers",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+28",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+28",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C28",
        title: "Building real-time applications",
        channel: "Real-time Devs",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+29",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+29",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C29",
        title: "Mobile-first web design principles",
        channel: "Mobile Masters",
        type: "VIDEO"
    },
    {
        thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+30",
        url: "https://placehold.co/400x400/282828/ffffff?text=Video+30",
        profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C30",
        title: "The complete CSS Grid tutorial",
        channel: "CSS Wizards",
        type: "VIDEO"
    }
];

const HomePageContent = () => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [videoData, setVideoData] = useState<VideoData[]>([]);
    const [gridCols, setGridCols] = useState<number>(5);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [seed, setSeed] = useState<string | null>(null);
    const [seenIds, setSeenIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPreloadingRecommended, setIsPreloadingRecommended] = useState(false);
    
    const categories = [
        'All', 'Music', 'Gaming', 'News', 'Sports', 'Entertainment', 'Education', 'Science & Technology', 
        'Howto & Style', 'People & Blogs', 'Comedy', 'Film & Animation', 'Autos & Vehicles', 'Pets & Animals',
        'Travel & Events', 'Nonprofits & Activism'
    ];

    // Fetch media data from API
    useEffect(() => {
        const fetchMedia = async (opts?: { append?: boolean }) => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                params.set('limit', '120');
                if (activeCategory && activeCategory !== 'All') params.set('category', activeCategory);
                if (seed) params.set('seed', seed);
                if (seenIds.length) params.set('exclude', seenIds.join(','));
                if (nextCursor && opts?.append) params.set('cursor', nextCursor);
                const response = await fetch(`/api/media/recommendations?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch media');
                }
                const data = await response.json();
                
                // Transform API data to match VideoCard interface
                const transformedData = (data.media || []).map((item: any) => ({
                    id: item.id,
                    thumbnailUrl: item.thumbnailUrl,
                    url: item.url,
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    uploader: item.uploader,
                    views: item.views,
                    likes: item.likes,
                    _count: item._count
                }));
                
                if (opts?.append) {
                    setVideoData(prev => [...prev, ...transformedData]);
                } else {
                    setVideoData(transformedData);
                }
                const newSeed = data?.pagination?.seed || seed || null;
                setNextCursor(data?.pagination?.nextCursor || null);
                setSeed(newSeed);

                // Cache current recommendation batch per session
                try {
                    const cacheKey = `rec_cache_${activeCategory || 'All'}`;
                    window.sessionStorage.setItem(cacheKey, JSON.stringify({
                        media: opts?.append ? [...videoData, ...transformedData] : transformedData,
                        nextCursor: data?.pagination?.nextCursor || null,
                        seed: newSeed,
                        ts: Date.now(),
                    }));
                    if (newSeed) window.sessionStorage.setItem('rec_seed', newSeed);
                } catch {}
            } catch (err) {
                console.error('Error fetching media:', err);
                setError('Failed to load media');
                // Fallback to mock data
                setVideoData(mockVideoData);
            } finally {
                setLoading(false);
            }
        };

        // Initialize session seed
        if (!seed) setSeed(Math.floor(Date.now() / (1000 * 60)).toString());

        // Try per-session cache first to avoid jank when navigating back
        try {
            const cacheKey = `rec_cache_${activeCategory || 'All'}`;
            const raw = window.sessionStorage.getItem(cacheKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.media)) {
                    setVideoData(parsed.media);
                    setNextCursor(parsed.nextCursor || null);
                    setSeed(parsed.seed || seed || null);
                    setLoading(false);
                    return;
                }
            }
        } catch {}

        fetchMedia();
        
        // Preload the recommended page for instant navigation (YouTube Shorts style)
        // This prevents the "stuck on home page" feeling when clicking recommended
        // The preloader fetches media data and stores it in sessionStorage
        // When user navigates to /recommended, the page loads instantly with preloaded data
        setIsPreloadingRecommended(true);
        pagePreloader.preloadRecommendedPage().finally(() => {
            setIsPreloadingRecommended(false);
        });
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory]);

    // Compute current grid columns based on Tailwind breakpoints to ensure full rows
    useEffect(() => {
        const computeCols = () => {
            const width = window.innerWidth;
            if (width >= 1536) return 10; // 2xl
            if (width >= 1280) return 9;  // xl
            if (width >= 1024) return 8;  // lg
            if (width >= 768) return 7;   // md
            if (width >= 640) return 6;   // sm
            return 5;                      // base
        };
        const update = () => setGridCols(computeCols());
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const handleSelectCategory = (category: string) => {
        setActiveCategory(category);
        setNextCursor(null);
    };

    const handleImpression = (mediaId: string, position: number) => {
        // Import and use analytics logging
        import('@/lib/analytics').then(({ logImpression }) => {
            logImpression(mediaId);
        });
    };

    const handleCardClick = (mediaId: string, position: number) => {
        // Import and use analytics logging
        import('@/lib/analytics').then(({ logClick }) => {
            logClick(mediaId);
        });
    };

    // Infinite scroll: load more when near bottom
    useEffect(() => {
        const onScroll = () => {
            const el = document.documentElement;
            if (!nextCursor) return;
            if (el.scrollTop + window.innerHeight >= el.scrollHeight - 1200) {
                // Append next page
                setNextCursor(null); // prevent duplicate fetch
                // Mark current items as seen
                setSeenIds(prev => Array.from(new Set([...prev, ...videoData.map(v => v.id!).filter(Boolean)])));
                // Fetch more
                (async () => {
                    await new Promise(r => setTimeout(r, 0));
                    // reuse fetch with append
                    const params = new URLSearchParams();
                    params.set('limit', '120');
                    if (activeCategory && activeCategory !== 'All') params.set('category', activeCategory);
                    if (seed) params.set('seed', seed!);
                    if (seenIds.length) params.set('exclude', seenIds.join(','));
                    if (nextCursor) params.set('cursor', nextCursor);
                    try {
                        const response = await fetch(`/api/media/recommendations?${params.toString()}`);
                        if (!response.ok) throw new Error('Failed to fetch more');
                        const data = await response.json();
                        const transformedData = (data.media || []).map((item: any) => ({
                            id: item.id,
                            thumbnailUrl: item.thumbnailUrl,
                            url: item.url,
                            title: item.title,
                            description: item.description,
                            type: item.type,
                            uploader: item.uploader,
                            views: item.views,
                            likes: item.likes,
                            _count: item._count
                        }));
                        setVideoData(prev => [...prev, ...transformedData]);
                        setNextCursor(data?.pagination?.nextCursor || null);
                    } catch (e) {
                        // ignore
                    }
                })();
            }
        };
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, [nextCursor, activeCategory, seed, seenIds, videoData]);

    if (loading) {
        return (
            <div className="flex-1">
                <div className="sticky top-0 z-20 bg-[#0f0f0f] shadow-lg">
                    <CategoryBar 
                        categories={categories}
                        activeCategory={activeCategory} 
                        onSelectCategory={handleSelectCategory} 
                    />
                </div>
                <div className="mt-2 pt-4 px-6 pb-8">
                    {/* Skeleton loader grid */}
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 gap-y-6 w-full">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1">
                <div className="sticky top-0 z-20 bg-[#0f0f0f] shadow-lg">
                    <CategoryBar 
                        categories={categories}
                        activeCategory={activeCategory} 
                        onSelectCategory={handleSelectCategory} 
                    />
                </div>
                <div className="mt-2 pt-4 px-6 pb-8">
                    <div className="flex flex-col justify-center items-center h-64 space-y-4">
                        <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-red-400 text-lg font-medium">{error}</div>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1">
            <div className="sticky top-0 z-20 bg-[#0f0f0f] shadow-lg">
            <CategoryBar 
                categories={categories}
                activeCategory={activeCategory} 
                onSelectCategory={handleSelectCategory} 
            />
            </div>

            <div className="mt-2 pt-4 px-6 pb-8">
                {/* Preloading indicator for recommended page - enhanced design */}
                {isPreloadingRecommended && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 backdrop-blur-sm">
                        <div className="flex items-center gap-3 text-white/90 text-sm">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse"></div>
                            </div>
                            <span className="font-medium">Preloading recommended page for instant navigation...</span>
                        </div>
                    </div>
                )}
                
                {/* Enhanced grid with better responsiveness and spacing */}
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 gap-y-6 w-full">
                    {videoData.map((video, index) => {
                        const isRowStart = index % gridCols === 0;
                        const showTopSeparator = index >= gridCols && isRowStart;
                        return (
                            <VideoCard 
                                key={video.id || index} 
                                video={video} 
                                showTopSeparator={showTopSeparator}
                                onImpression={handleImpression}
                                onCardClick={handleCardClick}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default HomePageContent;