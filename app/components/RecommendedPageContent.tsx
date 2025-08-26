'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { logStartPlay } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from './ActionButton';

interface MediaData {
    id: string;
    type: 'VIDEO' | 'IMAGE' | 'AUDIO';
    url: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    uploader: {
        username: string;
        displayName?: string;
        avatarUrl?: string;
    };
    views: number;
    likes: number;
    _count: {
        likeRecords: number;
        comments: number;
    };
    relatedMedia?: MediaData[];
}



// Mock recommended content for vertical scrolling
const mockRecommendedContent: MediaData[] = [
    {
        id: 'rec1',
        type: 'VIDEO',
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        title: 'Epic Rally Car Adventure',
        description: 'High-octane racing action on city streets',
        thumbnailUrl: 'https://placehold.co/720x1280/1a1a1a/ffffff?text=Epic+Rally+Car+Adventure',
        uploader: {
            username: 'racing_channel',
            displayName: 'Racing Channel',
            avatarUrl: 'https://placehold.co/40x40/ff0000/ffffff?text=R'
        },
        views: 5000,
        likes: 300,
        _count: {
            likeRecords: 300,
            comments: 50
        }
    },
    {
        id: 'rec2',
        type: 'IMAGE',
        url: 'https://placehold.co/720x1280/2d2d2d/ffffff?text=Urban+Street+Photography',
        title: 'Urban Street Photography',
        description: 'Capturing the essence of city life',
        thumbnailUrl: 'https://placehold.co/720x1280/2d2d2d/ffffff?text=Urban+Street+Photography',
        uploader: {
            username: 'street_photographer',
            displayName: 'Street Photographer',
            avatarUrl: 'https://placehold.co/40x40/00ff00/ffffff?text=S'
        },
        views: 3200,
        likes: 180,
        _count: {
            likeRecords: 180,
            comments: 25
        }
    },
    {
        id: 'rec3',
        type: 'VIDEO',
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        title: 'Monster Energy Racing Highlights',
        description: 'Best moments from the racing season',
        thumbnailUrl: 'https://placehold.co/720x1280/1a1a1a/ffffff?text=Monster+Energy+Racing+Highlights',
        uploader: {
            username: 'monster_racing',
            displayName: 'Monster Racing',
            avatarUrl: 'https://placehold.co/40x40/00ff00/ffffff?text=M'
        },
        views: 7800,
        likes: 450,
        _count: {
            likeRecords: 450,
            comments: 75
        },
        relatedMedia: [
            {
                id: 'rec3-1',
                type: 'IMAGE',
                url: 'https://placehold.co/720x1280/ff0000/ffffff?text=Related+Image+1',
                title: 'Related Fire Show Image 1',
                uploader: { username: 'recommended' },
                views: 100, likes: 10, _count: { likeRecords: 10, comments: 2 }
            },
            {
                id: 'rec3-2',
                type: 'IMAGE',
                url: 'https://placehold.co/720x1280/00ff00/ffffff?text=Related+Image+2',
                title: 'Related Fire Show Image 2',
                uploader: { username: 'recommended' },
                views: 120, likes: 15, _count: { likeRecords: 15, comments: 3 }
            }
        ]
    }
];

const RecommendedPageContent = () => {
    
    const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
    const playerContainerRef = useRef<HTMLDivElement | null>(null);
    
    // Refs to store current values for event handlers (to avoid dependency issues)
    const currentMediaIndexRef = useRef(0);
    const currentRelatedIndexRef = useRef(0);
    const mediaDataRef = useRef<MediaData[]>([]);
    
    // Function to manually trigger video play/pause logic
    const triggerVideoPlayPause = () => {
        const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
        const currentContent = allContent[currentRelatedIndexRef.current];

        // Pause all videos first
        Object.values(videoRefs.current).forEach(video => {
            if (video) video.pause();
        });

        // Play the video of the currently visible slide
        if (currentContent?.type === 'VIDEO') {
            const videoElement = videoRefs.current[`${currentMediaIndexRef.current}-${currentRelatedIndexRef.current}`];
            if (videoElement) {
                videoElement.play().catch(() => {});
                logStartPlay(currentContent.id);
            }
        }
    };
    const [mediaData, setMediaData] = useState<MediaData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [currentRelatedIndex, setCurrentRelatedIndex] = useState(0);
    const [verticalSlideDirection, setVerticalSlideDirection] = useState<'up' | 'down'>('down');
    const [resumeProgress, setResumeProgress] = useState<number | null>(null);
    


    // Animation variants for horizontal sliding
    const slideVariants = {
        enter: (direction: 'left' | 'right') => ({
            x: direction === 'right' ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: 'left' | 'right') => ({
            zIndex: 0,
            x: direction === 'right' ? -1000 : 1000,
            opacity: 0
        })
    };

    // Animation variants for vertical sliding
    const verticalSlideVariants = {
        enter: (direction: 'up' | 'down') => ({
            y: direction === 'down' ? 1000 : -1000,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            y: 0,
            opacity: 1
        },
        exit: (direction: 'up' | 'down') => ({
            zIndex: 0,
            y: direction === 'down' ? -1000 : 1000,
            opacity: 0
        })
    };

    // Fetch media data from API (use recommendations for consistency)
    useEffect(() => {

        const fetchMedia = async () => {
            try {
                setLoading(true);
                // Respect deep link to a specific mediaId
                const url = new URL(window.location.href);
                const mediaId = url.searchParams.get('v');
                const resumeTime = url.searchParams.get('t'); // Resume time as percentage
                // Generate a new seed each time for variety, or use existing one if deep-linked
                const existingSeed = url.searchParams.get('seed') || (typeof window !== 'undefined' ? window.sessionStorage.getItem('rec_seed') : null);
                const seedParam = existingSeed || Math.floor(Math.random() * 1000000).toString();
                
                // Store the seed for this session
                if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('rec_seed', seedParam);
                }
                const categoryParam = url.searchParams.get('category');
                
                // Store resume progress for later use
                if (resumeTime) {
                    setResumeProgress(parseInt(resumeTime, 10) / 100); // Convert percentage to decimal
                }
                const params = new URLSearchParams();
                params.set('limit', '500'); // Increased to maximum for more variety
                if (seedParam) params.set('seed', seedParam);
                if (categoryParam) params.set('category', categoryParam);
                
                // Exclude recently seen content to avoid repetition
                const recentlySeen = mediaData.slice(0, 10).map(m => m.id);
                if (recentlySeen.length > 0) {
                    params.set('exclude', recentlySeen.join(','));
                }
                const response = await fetch(`/api/media/recommendations?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch media');
                }
                const data = await response.json();
                
                // Combine fetched media with mock recommended content as separate posts
                const uploadedMedia = (data.media || []).map((m: any) => ({
                    id: m.id,
                    type: m.type,
                    url: m.url,
                    title: m.title,
                    description: m.description,
                    thumbnailUrl: m.thumbnailUrl,
                    uploader: m.uploader,
                    views: m.views,
                    likes: m.likes,
                    _count: m._count,
                }));
                
                // Create dynamic mock content with meaningful titles
                const dynamicMockContent = mockRecommendedContent.map((item, index) => {
                    // Generate meaningful URLs and titles based on content type
                    let randomUrl = item.url;
                    let randomThumbnail = item.thumbnailUrl;
                    let meaningfulTitle = item.title;
                    
                    if (item.type === 'VIDEO') {
                        // Meaningful video titles that match the content
                        const videoTitles = [
                            'Epic Rally Car Adventure',
                            'Monster Energy Racing Highlights',
                            'Street Racing Compilation',
                            'Car Show Spectacular',
                            'Racing Championship Moments'
                        ];
                        meaningfulTitle = videoTitles[Math.floor(Math.random() * videoTitles.length)];
                        
                        // Use appropriate video URLs
                        const videoUrls = [
                            'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
                            'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                            'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
                            'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                            'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
                        ];
                        randomUrl = videoUrls[Math.floor(Math.random() * videoUrls.length)];
                        randomThumbnail = `https://placehold.co/720x1280/1a1a1a/ffffff?text=${encodeURIComponent(meaningfulTitle)}`;
                    } else if (item.type === 'IMAGE') {
                        // Meaningful image titles
                        const imageTitles = [
                            'Urban Street Photography',
                            'City Architecture',
                            'Street Art Collection',
                            'Urban Lifestyle',
                            'City Landmarks'
                        ];
                        meaningfulTitle = imageTitles[Math.floor(Math.random() * imageTitles.length)];
                        
                        // Use appropriate image colors
                        const colors = ['2d2d2d', '3a3a3a', '4a4a4a', '5a5a5a', '6a6a6a'];
                        const randomColor = colors[Math.floor(Math.random() * colors.length)];
                        randomUrl = `https://placehold.co/720x1280/${randomColor}/ffffff?text=${encodeURIComponent(meaningfulTitle)}`;
                        randomThumbnail = randomUrl;
                    }
                    
                    return {
                        ...item,
                        id: `rec${index + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        url: randomUrl,
                        thumbnailUrl: randomThumbnail,
                        title: meaningfulTitle,
                        views: item.views + Math.floor(Math.random() * 1000),
                        likes: item.likes + Math.floor(Math.random() * 100)
                    };
                });
                
                let allMedia = [...uploadedMedia, ...dynamicMockContent];
                
                // Shuffle the content for variety (Fisher-Yates shuffle)
                for (let i = allMedia.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allMedia[i], allMedia[j]] = [allMedia[j], allMedia[i]];
                }

                // If a mediaId is present, ensure it's in the list
                if (mediaId && !allMedia.some(m => m.id === mediaId)) {
                    try {
                        const res = await fetch(`/api/media/${mediaId}`);
                        if (res.ok) {
                            const item = await res.json();
                            const normalized = {
                                id: item.id,
                                type: item.type,
                                url: item.url,
                                title: item.title,
                                description: item.description,
                                thumbnailUrl: item.thumbnailUrl,
                                uploader: item.uploader,
                                views: item.views,
                                likes: item.likes,
                                _count: item._count,
                            } as MediaData;
                            allMedia = [normalized, ...allMedia];
                        }
                    } catch {}
                }

                setMediaData(prevData => {
                    // Only update if data actually changed
                    if (JSON.stringify(prevData) !== JSON.stringify(allMedia)) {
                        return allMedia;
                    }
                    return prevData;
                });

                // If a mediaId is present, jump to it if found
                if (mediaId) {
                    const idx = allMedia.findIndex(m => m.id === mediaId);
                    if (idx >= 0) {
                        setCurrentMediaIndex(idx);
                        setCurrentRelatedIndex(0);
                    }
                }
            } catch (err) {
                console.error('Error fetching media:', err);
                setError('Failed to load media');
            } finally {
                setLoading(false);
            }
        };

        fetchMedia();
    }, []);

    // Keep refs in sync with state for event handlers
    useEffect(() => {

        currentMediaIndexRef.current = currentMediaIndex;
        currentRelatedIndexRef.current = currentRelatedIndex;
        mediaDataRef.current = mediaData;
    }, [currentMediaIndex, currentRelatedIndex, mediaData]);

    // (debug logs removed)

        // Ref-based scroll handlers to avoid dependency issues
    const handleHorizontalScrollRef = (direction: 'left' | 'right') => {
        const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
        if (!currentMedia) return;

        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];

        if (allContent.length <= 1) return;

        const nextIndex = direction === 'right'
            ? (currentRelatedIndexRef.current + 1) % allContent.length
            : (currentRelatedIndexRef.current - 1 + allContent.length) % allContent.length;


        pauseAllVideos();
        setCurrentRelatedIndex(nextIndex);
    };

    const handleVerticalScrollRef = (direction: 'up' | 'down') => {

        let nextIndex = currentMediaIndexRef.current;

        
        if (direction === 'down' && currentMediaIndexRef.current < mediaDataRef.current.length - 1) {
            nextIndex = currentMediaIndexRef.current + 1;
        } else if (direction === 'up' && currentMediaIndexRef.current > 0) {
            nextIndex = currentMediaIndexRef.current - 1;
        }


        if (nextIndex !== currentMediaIndexRef.current) {
            pauseAllVideos();
            setVerticalSlideDirection(direction);
            setCurrentMediaIndex(nextIndex);
            setCurrentRelatedIndex(0); // Reset related index when moving to a new post
        }
    };

    // Handle keyboard navigation
    useEffect(() => {

        const handleKeyDown = (e: KeyboardEvent) => {

            switch (e.key) {
                case 'ArrowUp':

                    e.preventDefault();
                    // Go to previous video
                    if (currentMediaIndexRef.current > 0) {
                        pauseAllVideos();
                        setVerticalSlideDirection('up');
                        setCurrentMediaIndex(currentMediaIndexRef.current - 1);
                        setCurrentRelatedIndex(0);
                        
                        // Update URL to reflect current video
                        const prevIndex = currentMediaIndexRef.current - 1;
                        const currentVideo = mediaDataRef.current[prevIndex];
                        if (currentVideo) {
                            const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                            window.location.href = newUrl;
                        }
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    // Go to next video
                    if (currentMediaIndexRef.current < mediaDataRef.current.length - 1) {
                        pauseAllVideos();
                        setVerticalSlideDirection('down');
                        setCurrentMediaIndex(currentMediaIndexRef.current + 1);
                        setCurrentRelatedIndex(0);
                        
                        // Update URL to reflect current video
                        const nextIndex = currentMediaIndexRef.current + 1;
                        const currentVideo = mediaDataRef.current[nextIndex];
                        if (currentVideo) {
                            const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                            window.location.href = newUrl;
                        }
                    }
                    break;
                case 'ArrowLeft':

                    e.preventDefault();
                    // Seek backward 10 seconds in current video
                    {
                        const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
                        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                        const currentContent = allContent[currentRelatedIndexRef.current];
                        if (currentContent?.type === 'VIDEO') {
                            const videoElement = videoRefs.current[`${currentMediaIndexRef.current}-${currentRelatedIndexRef.current}`];
                            if (videoElement) {
                                // Seek backward by 10% of video duration (like YouTube)
                                const seekAmount = videoElement.duration * 0.1;
                                videoElement.currentTime = Math.max(0, videoElement.currentTime - seekAmount);
                            }
                        }
                    }
                    break;
                case 'ArrowRight':

                    e.preventDefault();
                    // Seek forward 10 seconds in current video
                    {
                        const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
                        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                        const currentContent = allContent[currentRelatedIndexRef.current];
                        if (currentContent?.type === 'VIDEO') {
                            const videoElement = videoRefs.current[`${currentMediaIndexRef.current}-${currentRelatedIndexRef.current}`];
                            if (videoElement) {
                                // Seek forward by 10% of video duration (like YouTube)
                                const seekAmount = videoElement.duration * 0.1;
                                videoElement.currentTime = Math.min(videoElement.duration || 0, videoElement.currentTime + seekAmount);
                            }
                        }
                    }
                    break;
                case ' ':
                case 'Space':
                    e.preventDefault();
                    // Toggle play/pause for current video
                    {
                        const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
                        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                        const currentContent = allContent[currentRelatedIndexRef.current];
                        if (currentContent?.type === 'VIDEO') {
                            const videoElement = videoRefs.current[`${currentMediaIndexRef.current}-${currentRelatedIndexRef.current}`];
                            if (videoElement) {
                                if (videoElement.paused) {
                                    videoElement.play().catch(console.error);
                                } else {
                                    videoElement.pause();
                                }
                            }
                        }
                    }
                    break;
            }
        };

        // Global keyboard controls - work anywhere on the page
        window.addEventListener('keydown', handleKeyDown);
        
        // Click anywhere on the page to enable keyboard controls
        const handlePageClick = () => {
            const container = document.querySelector('.recommended-container');
            if (container) {
                (container as HTMLElement).focus();
            }
        };
        document.addEventListener('click', handlePageClick);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handlePageClick);
        };
    }, []); // No dependencies needed - uses refs

    // Handle mouse wheel scrolling
    useEffect(() => {

        let scrollTimeout: NodeJS.Timeout | null = null;
        let isThrottled = false;

        const SCROLL_THRESHOLD = 80; // Adjust based on your needs

        const handleWheel = (e: any) => {
            e.preventDefault();

            // Prevent over-scrolling
            if (isThrottled) {
                return;
            }

            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                if (Math.abs(e.deltaY) > SCROLL_THRESHOLD) {
                    isThrottled = true;

                    if (e.deltaY > 0) {
                        // Go to next video
                        if (currentMediaIndexRef.current < mediaDataRef.current.length - 1) {
                            pauseAllVideos();
                            setVerticalSlideDirection('down');
                            setCurrentMediaIndex(currentMediaIndexRef.current + 1);
                            setCurrentRelatedIndex(0);
                            
                            // Update URL to reflect current video
                            const nextIndex = currentMediaIndexRef.current + 1;
                            const currentVideo = mediaDataRef.current[nextIndex];
                            if (currentVideo) {
                                const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                                window.location.href = newUrl;
                            }
                        }
                    } else {
                        // Go to previous video
                        if (currentMediaIndexRef.current > 0) {
                            pauseAllVideos();
                            setVerticalSlideDirection('up');
                            setCurrentMediaIndex(currentMediaIndexRef.current - 1);
                            setCurrentRelatedIndex(0);
                            
                            // Update URL to reflect current video
                            const prevIndex = currentMediaIndexRef.current - 1;
                            const currentVideo = mediaDataRef.current[prevIndex];
                            if (currentVideo) {
                                const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                                window.location.href = newUrl;
                            }
                        }
                    }

                    scrollTimeout = setTimeout(() => {
                        isThrottled = false;
                        // Re-focus container after scroll for keyboard controls
                        const container = document.querySelector('.recommended-container');
                        if (container) {
                            (container as HTMLElement).focus();
                        }
                    }, 600); // Should match or exceed your animation duration
                }
            } else if (Math.abs(e.deltaX) > SCROLL_THRESHOLD) {
                isThrottled = true;

                if (e.deltaX > 0) {
                    // Go to next related content
                    const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
                    if (currentMedia) {
                        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                        if (allContent.length > 1) {
                            const nextIndex = (currentRelatedIndexRef.current + 1) % allContent.length;
                            pauseAllVideos();
                            setCurrentRelatedIndex(nextIndex);
                            
                            // Update URL with timestamp for related content
                            const url = new URL(window.location.href);
                            url.searchParams.set('t', Date.now().toString());
                            window.history.replaceState({}, '', url.toString());
                        }
                    }
                } else {
                    // Go to previous related content
                    const currentMedia = mediaDataRef.current[currentMediaIndexRef.current];
                    if (currentMedia) {
                        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                        if (allContent.length > 1) {
                            const nextIndex = (currentRelatedIndexRef.current - 1 + allContent.length) % allContent.length;
                            pauseAllVideos();
                            setCurrentRelatedIndex(nextIndex);
                            
                            // Update URL with timestamp for related content
                            const url = new URL(window.location.href);
                            url.searchParams.set('t', Date.now().toString());
                            window.history.replaceState({}, '', url.toString());
                        }
                    }
                }

                scrollTimeout = setTimeout(() => {
                    isThrottled = false;
                }, 600);
            }
        };

        // Wait for DOM to be ready, then add wheel listener
        const setupWheelListener = () => {
            const container = document.querySelector('.recommended-container');
            if (container) {
                container.addEventListener('wheel', handleWheel, { passive: false });
                return container;
            } else {
                return null;
            }
        };

        // Try immediately, then retry if needed
        let container = setupWheelListener();
        if (!container) {
            // Retry after a short delay
            setTimeout(() => {
                container = setupWheelListener();
            }, 100);
        }

        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, []); // No dependencies needed - uses refs
    
    // Add wheel listener when container renders
    useEffect(() => {
        const container = document.querySelector('.recommended-container');
        if (container) {
            const handleWheel = (e: any) => {
                e.preventDefault();

                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    if (Math.abs(e.deltaY) > 80) {
                        if (e.deltaY > 0) {
                            // Go to next video
                            if (currentMediaIndex < mediaData.length - 1) {
                                pauseAllVideos();
                                setVerticalSlideDirection('down');
                                const nextIndex = currentMediaIndex + 1;
                                setCurrentMediaIndex(nextIndex);
                                setCurrentRelatedIndex(0);
                                
                                // Update URL to reflect current video
                                const currentVideo = mediaData[nextIndex];
                                if (currentVideo) {
                                    const url = new URL(window.location.href);
                                    url.searchParams.set('v', currentVideo.id);
                                    window.history.replaceState({}, '', url.toString());
                                }
                            }
                        } else {
                            // Go to previous video
                            if (currentMediaIndex > 0) {
                                pauseAllVideos();
                                setVerticalSlideDirection('up');
                                const prevIndex = currentMediaIndex - 1;
                                setCurrentMediaIndex(prevIndex);
                                setCurrentRelatedIndex(0);
                                
                                // Update URL to reflect current video
                                const currentVideo = mediaData[prevIndex];
                                if (currentVideo) {
                                    const url = new URL(window.location.href);
                                    url.searchParams.set('v', currentVideo.id);
                                    window.history.replaceState({}, '', url.toString());
                                }
                            }
                        }
                    }
                } else if (Math.abs(e.deltaX) > 80) {
                    if (e.deltaX > 0) {
                        // Go to next related content
                        const currentMedia = mediaData[currentMediaIndex];
                        if (currentMedia) {
                            const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                            if (allContent.length > 1) {
                                const nextIndex = (currentRelatedIndex + 1) % allContent.length;
                                pauseAllVideos();
                                setCurrentRelatedIndex(nextIndex);
                            }
                        }
                    } else {
                        // Go to previous related content
                        const currentMedia = mediaData[currentMediaIndex];
                        if (currentMedia) {
                            const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                            if (allContent.length > 1) {
                                const nextIndex = (currentRelatedIndex - 1 + allContent.length) % allContent.length;
                                pauseAllVideos();
                                setCurrentRelatedIndex(nextIndex);
                            }
                        }
                    }
                }
            };

            container.addEventListener('wheel', handleWheel, { passive: false });
            
            return () => {
                container.removeEventListener('wheel', handleWheel);
            };
        }
    }, [currentMediaIndex, currentRelatedIndex, mediaData]);
    
    // Simplified video observer to ensure play/pause logic is robust
    useEffect(() => {

        const currentMedia = mediaData[currentMediaIndex];
        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
        const currentContent = allContent[currentRelatedIndex];

        // Pause all videos first
        Object.values(videoRefs.current).forEach(video => {
            if (video) video.pause();
        });

        // Play the video of the currently visible slide
        if (currentContent?.type === 'VIDEO') {
            const videoElement = videoRefs.current[`${currentMediaIndex}-${currentRelatedIndex}`];
            if (videoElement) {
                // Apply resume functionality if available
                if (resumeProgress && resumeProgress > 0.05 && resumeProgress < 0.95) {
                    const handleLoadedMetadata = () => {
                        if (videoElement.duration) {
                            videoElement.currentTime = videoElement.duration * resumeProgress;
                            setResumeProgress(null); // Clear resume progress after applying
                        }
                        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    };
                    
                    if (videoElement.readyState >= 1) {
                        // Metadata already loaded
                        handleLoadedMetadata();
                    } else {
                        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
                    }
                }
                
                videoElement.play().catch(() => {});
                logStartPlay(currentContent.id);

                // Focus the container so keyboard controls work immediately (like YouTube Shorts)
                setTimeout(() => {
                    const container = document.querySelector('.recommended-container');
                    if (container) {
                        (container as HTMLElement).focus();
                    }
                }, 100);

                // Add watch progress tracking for this video
                const trackProgress = (videoElement: HTMLVideoElement, mediaId: string) => {
                    if (videoElement.duration) {
                        const progress = videoElement.currentTime / videoElement.duration;
                        if (!isNaN(progress) && progress > 0.01) {
                            fetch('/api/history', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ mediaId, progress }),
                                keepalive: true,
                            }).catch(() => {});
                        }
                    }
                };

                // Add event listeners for this specific video
                const handlePause = () => trackProgress(videoElement, currentContent.id);
                const handleEnded = () => trackProgress(videoElement, currentContent.id);
                
                videoElement.addEventListener('pause', handlePause);
                videoElement.addEventListener('ended', handleEnded);
            }
        }
    }, [currentMediaIndex, currentRelatedIndex, mediaData, resumeProgress]);

    

    // Pause all videos helper function
    const pauseAllVideos = () => {
        Object.values(videoRefs.current).forEach(video => {
            if (video) video.pause();
        });
    };

    // --- Core Logic for Sliding Transition ---

    const handleHorizontalScroll = (direction: 'left' | 'right') => {
        const currentMedia = mediaData[currentMediaIndex];
        if (!currentMedia) return;

        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
        const nextIndex = direction === 'right' 
            ? (currentRelatedIndex + 1) % allContent.length
            : (currentRelatedIndex - 1 + allContent.length) % allContent.length;

        pauseAllVideos();
        setCurrentRelatedIndex(nextIndex);
    };

    const handleVerticalScroll = (direction: 'up' | 'down') => {
        let nextIndex = currentMediaIndex;
        if (direction === 'down' && currentMediaIndex < mediaData.length - 1) {
            nextIndex = currentMediaIndex + 1;
        } else if (direction === 'up' && currentMediaIndex > 0) {
            nextIndex = currentMediaIndex - 1;
        }

        if (nextIndex !== currentMediaIndex) {
            pauseAllVideos();
            setVerticalSlideDirection(direction);
            setCurrentMediaIndex(nextIndex);
            setCurrentRelatedIndex(0); // Reset related index when moving to a new post
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex justify-center items-center h-full w-full">
                <div className="text-white text-lg">Loading media...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex justify-center items-center h-full w-full">
                <div className="text-red-400 text-lg">{error}</div>
            </div>
        );
    }


    
    if (mediaData.length === 0) {
        return (
            <div className="flex-1 flex justify-center items-center h-full w-full">
                <div className="text-white text-lg">No media found. Upload some content!</div>
            </div>
        );
    }
    
    const currentMedia = mediaData[currentMediaIndex];
    const allContentInPost = [currentMedia, ...(currentMedia.relatedMedia || [])];
    const currentRelatedMedia = allContentInPost[currentRelatedIndex];

    return (
        <div className="flex-1 w-full recommended-container relative z-[200]" tabIndex={0}>
            <div className="sticky top-14 z-[300] relative h-[calc(100vh-56px)] w-full flex items-center justify-center overflow-visible">
                <div ref={playerContainerRef} className="h-full w-full max-w-md rounded-3xl overflow-hidden bg-[#0b0b0b] relative z-[500]">
                    {/* Glow tied to the player box (not the full page) */}
                    <div className="pointer-events-none absolute inset-1 rounded-[1.5rem] bg-white/12 blur-[18px] z-0" />
                {/* Main Media Display Container using AnimatePresence for vertical transitions */}
                <AnimatePresence 
                    initial={false} 
                    custom={verticalSlideDirection}
                >
                    <motion.div
                        key={currentMedia.id} // This is the key that tells Framer Motion when to animate a new item
                        custom={verticalSlideDirection}
                        variants={verticalSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            y: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="absolute inset-0 w-full h-full flex justify-center items-center"
                    >
                        {/* Horizontal Scroll Container */}
                        <div
                            className="relative w-full h-full flex transition-transform duration-500 ease-in-out"
                            style={{ 
                                transform: `translateX(-${currentRelatedIndex * 100}%)` 
                            }}
                        >
                            {allContentInPost.map((media, index) => (
                                <div key={media.id} className="w-full h-full flex-shrink-0 relative" data-media-id={media.id}>
                                    {/* Media Content */}
                                    {media.type === 'VIDEO' ? (
                                        <video
                                            ref={(el) => {
                                                videoRefs.current[`${currentMediaIndex}-${index}`] = el;
                                            }}
                                            className="w-full h-full object-cover"
                                            src={media.url}
                                             preload="metadata"
                                             poster={media.thumbnailUrl || 'https://placehold.co/720x1280/111111/ffffff?text=Loading...'}
                                            loop
                                            muted
                                            playsInline
                                              controls
                                            onClick={(e) => {

                                                e.preventDefault();
                                                e.stopPropagation();
                                                // Use refs for current values
                                                const video = videoRefs.current[`${currentMediaIndexRef.current}-${currentRelatedIndexRef.current}`];

                                                if (video) {
                                                    if (video.paused) { 
                                                        video.play().catch(console.error); 
                                                    } else { 
                                                        video.pause(); 
                                                    }
                                                }
                                            }}
                                        />
                                    ) : media.type === 'AUDIO' ? (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                                            <div className="text-center text-white">
                                                <div className="w-32 h-32 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                                                    <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.5 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.5l3.883-3.293zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <h2 className="text-xl font-semibold">{media.title}</h2>
                                                <audio controls className="mt-4 w-full max-w-xs">
                                                    <source src={media.url} type="audio/mpeg" />
                                                    Your browser does not support the audio tag.
                                                </audio>
                                            </div>
                                        </div>
                                    ) : (
                                        <img
                                            src={media.url}
                                            alt={media.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = "https://placehold.co/720x1280/282828/ffffff?text=Image+Error";
                                            }}
                                        />
                                    )}

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                                    
                                    {/* Media Info */}
                                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-20">
                                        <div className="flex-1 space-y-1">
                                            <h3 className="text-lg font-semibold text-white line-clamp-2">{media.title}</h3>
                                            <div className="flex items-center space-x-2">
                                                <img 
                                                    src={media.uploader.avatarUrl || `https://placehold.co/40x40/555555/ffffff?text=${media.uploader.username.charAt(0).toUpperCase()}`} 
                                                    alt="Channel profile" 
                                                    className="w-8 h-8 rounded-full" 
                                                />
                                                <p className="text-gray-200 text-sm">{media.uploader.displayName || media.uploader.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-4">
                                            <ActionButton
                                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 017.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3A5.5 5.5 0 0122 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>}
                                                label={media._count?.likeRecords?.toString() || '0'}
                                            />
                                            <ActionButton
                                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>}
                                                label={media._count?.comments?.toString() || '0'}
                                            />
                                            <ActionButton
                                                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.48 1.25.79 2.04.79 2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4c0 .24.04.47.09.7L7.05 11.23c-.54-.48-1.25-.79-2.04-.79-2.21 0-4 1.79-4 4s1.79 4 4 4c.79 0 1.5-.31 2.04-.79l7.05 4.11c-.05.23-.09.46-.09.7 0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4zM18 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-12 9c1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm12 9c1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>}
                                                label="Share"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Horizontal Scroll Indicators */}
                                    {allContentInPost.length > 1 && (
                                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-1 z-20">
                                            {allContentInPost.map((_, index) => (
                                                <div
                                                    key={index}
                                                    className={`w-2 h-2 rounded-full ${
                                                        index === currentRelatedIndex ? 'bg-white' : 'bg-white/50'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Horizontal Navigation Buttons */}
                                    <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-20">
                                        {allContentInPost.length > 1 && (
                                            <>
                                                <button
                                                    onClick={() => handleHorizontalScrollRef('left')}
                                                    className="pointer-events-auto ml-2 p-4 text-white transition-opacity hover:opacity-100 opacity-70 h-32 flex items-center"
                                                    title="Previous content in this post"
                                                >
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleHorizontalScrollRef('right')}
                                                    className="pointer-events-auto mr-2 p-4 text-white transition-opacity hover:opacity-100 opacity-70 h-32 flex items-center"
                                                    title="Next content in this post"
                                                >
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
                
                
                </div>
            </div>
        </div>
    );
};

export default RecommendedPageContent;
