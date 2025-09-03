'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { logStartPlay } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from './ActionButton';
import { pagePreloader } from '@/lib/preloader';

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



// YouTube-style: No static data, everything comes from API

const RecommendedPageContent = () => {
    
    const currentVideoRef = useRef<HTMLVideoElement | null>(null);
    const playerContainerRef = useRef<HTMLDivElement | null>(null);
    
    // Function to manually trigger video play/pause logic
    const triggerVideoPlayPause = () => {
        if (currentVideoRef.current) {
            if (currentVideoRef.current.paused) {
                currentVideoRef.current.play().catch(() => {});
                const currentMedia = mediaData[currentMediaIndex];
                if (currentMedia?.type === 'VIDEO') {
                    logStartPlay(currentMedia.id);
                }
            } else {
                currentVideoRef.current.pause();
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
    
    // Fetch media data from API (use recommendations for consistency)
    const fetchMedia = useCallback(async () => {
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
            
            // YouTube-style: Use only API data, no mock processing
            const apiMediaData = (data.media || []).map((m: any) => ({
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
            
            // Shuffle the content for variety (Fisher-Yates shuffle)
            for (let i = apiMediaData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [apiMediaData[i], apiMediaData[j]] = [apiMediaData[j], apiMediaData[i]];
            }

            // If a mediaId is present, ensure it's in the list
            if (mediaId && !apiMediaData.some((m: any) => m.id === mediaId)) {
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
                        apiMediaData.unshift(normalized);
                    }
                } catch (error) {
                    console.error('Failed to fetch specific media:', error);
                }
            }

            setMediaData(apiMediaData);

            // If a mediaId is present, jump to it if found
            if (mediaId) {
                const idx = apiMediaData.findIndex((m: any) => m.id === mediaId);
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
    }, [mediaData]);

    // Check if page was preloaded from home page
    useEffect(() => {
        const preloadedData = pagePreloader.getPreloadedData('recommended');
        if (preloadedData) {
            // Use preloaded data for instant page load
            setMediaData(preloadedData.mediaData);
            setLoading(false);
            // Clear the preloaded data after use
            pagePreloader.clearPreloadedData('recommended');
        } else {
            // Normal loading if no preloaded data
            fetchMedia();
        }
    }, []);


    
    // Preloading state for smooth transitions
    const [preloadedVideos, setPreloadedVideos] = useState<Set<string>>(new Set());
    const [isPreloading, setIsPreloading] = useState(false);
    
    // Mobile touch/swipe handling
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
    
    // Minimum swipe distance (in pixels)
    const minSwipeDistance = 50;
    
    // Handle touch start
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };
    
    // Handle touch move
    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };
    
    // Handle touch end and detect swipe direction
    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distanceX = touchStart.x - touchEnd.x;
        const distanceY = touchStart.y - touchEnd.y;
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;
        const isUpSwipe = distanceY > minSwipeDistance;
        const isDownSwipe = distanceY < -minSwipeDistance;
        
        // Only handle swipes if they're more horizontal than vertical
        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            if (isLeftSwipe) {
                // Swipe left - next video
                if (mediaData.length > currentMediaIndex + 1) {
                    setCurrentMediaIndex(currentMediaIndex + 1);
                    setCurrentRelatedIndex(0);
                }
            } else if (isRightSwipe) {
                // Swipe right - previous video
                if (currentMediaIndex > 0) {
                    setCurrentMediaIndex(currentMediaIndex - 1);
                    setCurrentRelatedIndex(0);
                }
            }
        } else {
            // Vertical swipes - scroll the page
            if (isUpSwipe) {
                // Swipe up - scroll down to see next video preview
                window.scrollBy({ top: 100, behavior: 'smooth' });
            } else if (isDownSwipe) {
                // Swipe down - scroll up
                window.scrollBy({ top: -100, behavior: 'smooth' });
            }
        }
    };
    


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

    // Preload next few videos for smooth transitions (YouTube Shorts style)
    // This prevents the "stuck on previous page" feeling by preloading:
    // - Thumbnail images
    // - Video metadata (duration, etc.)
    // - Page structure for instant transitions
    const preloadNextVideos = useCallback(async (startIndex: number, count: number = 3) => {
        if (isPreloading || mediaData.length === 0) return;
        
        setIsPreloading(true);
        const newPreloaded = new Set(preloadedVideos);
        
        try {
            for (let i = 0; i < count; i++) {
                const index = startIndex + i;
                if (index >= mediaData.length) break;
                
                const media = mediaData[index];
                if (!media || newPreloaded.has(media.id)) continue;
                
                // Preload thumbnail image
                if (media.thumbnailUrl) {
                    const img = new Image();
                    img.src = media.thumbnailUrl;
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve; // Continue even if image fails
                    });
                }
                
                // Preload video metadata (duration, etc.)
                if (media.type === 'VIDEO' && media.url) {
                    try {
                        const video = document.createElement('video');
                        video.preload = 'metadata';
                        video.src = media.url;
                        await new Promise((resolve) => {
                            video.onloadedmetadata = resolve;
                            video.onerror = resolve;
                            // Timeout after 2 seconds to avoid blocking
                            setTimeout(resolve, 2000);
                        });
                    } catch (e) {
                        // Continue if video preloading fails
                    }
                }
                
                newPreloaded.add(media.id);
            }
            
            setPreloadedVideos(newPreloaded);
        } catch (e) {
            // Continue even if preloading fails
        } finally {
            setIsPreloading(false);
        }
    }, [mediaData]);



    // Trigger preloading when media data changes
    useEffect(() => {
        if (mediaData.length > 0) {
            preloadNextVideos(0, 5); // Preload first 5 videos
        }
    }, [mediaData, preloadNextVideos]);

    // Removed duplicate ref system - using state directly

    // (debug logs removed)

    // Scroll handlers using state directly

    // Handle keyboard navigation moved below after pauseAllVideos function



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
                        if (currentMediaIndex < mediaData.length - 1) {
                            pauseAllVideos();
                            setVerticalSlideDirection('down');
                            setCurrentMediaIndex(currentMediaIndex + 1);
                            setCurrentRelatedIndex(0);
                            
                            // Update URL to reflect current video
                            const nextIndex = currentMediaIndex + 1;
                            const currentVideo = mediaData[nextIndex];
                            if (currentVideo) {
                                const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                                window.location.href = newUrl;
                                
                                // Preload next few videos for smooth navigation
                                preloadNextVideos(nextIndex, 3);
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
                                const newUrl = window.location.origin + '/recommended?v=' + currentVideo.id;
                                window.location.href = newUrl;
                                
                                // Preload next few videos for smooth navigation
                                preloadNextVideos(prevIndex, 3);
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
                    const currentMedia = mediaData[currentMediaIndex];
                    if (currentMedia) {
                        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                        if (allContent.length > 1) {
                            const nextIndex = (currentRelatedIndex + 1) % allContent.length;
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
                    const currentMedia = mediaData[currentMediaIndex];
                    if (currentMedia) {
                        const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
                        if (allContent.length > 1) {
                            const nextIndex = (currentRelatedIndex - 1 + allContent.length) % allContent.length;
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

        // Pause current video if playing
        if (currentVideoRef.current && !currentVideoRef.current.paused) {
            currentVideoRef.current.pause();
        }

        // Play the video of the currently visible slide
        if (currentContent?.type === 'VIDEO') {
            if (currentVideoRef.current) {
                // Apply resume functionality if available
                if (resumeProgress && resumeProgress > 0.05 && resumeProgress < 0.95) {
                    const handleLoadedMetadata = () => {
                        if (currentVideoRef.current?.duration) {
                            currentVideoRef.current.currentTime = currentVideoRef.current.duration * resumeProgress;
                            setResumeProgress(null); // Clear resume progress after applying
                        }
                        currentVideoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    };
                    
                    if (currentVideoRef.current?.readyState >= 1) {
                        // Metadata already loaded
                        handleLoadedMetadata();
                    } else {
                        currentVideoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata);
                    }
                }
                
                currentVideoRef.current?.play().catch(() => {});
                logStartPlay(currentContent.id);

                // Focus the container so keyboard controls work immediately (like YouTube Shorts)
                setTimeout(() => {
                    const container = document.querySelector('.recommended-container');
                    if (container) {
                        (container as HTMLElement).focus();
                    }
                }, 100);

                // Add watch progress tracking for this video
                const trackProgress = (video: HTMLVideoElement, mediaId: string) => {
                    if (video.duration) {
                        const progress = video.currentTime / video.duration;
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
                const handlePause = () => {
                    if (currentVideoRef.current) {
                        trackProgress(currentVideoRef.current, currentContent.id);
                    }
                };
                const handleEnded = () => {
                    if (currentVideoRef.current) {
                        trackProgress(currentVideoRef.current, currentContent.id);
                    }
                };
                
                currentVideoRef.current?.addEventListener('pause', handlePause);
                currentVideoRef.current?.addEventListener('ended', handleEnded);
            }
        }
    }, [currentMediaIndex, currentRelatedIndex, mediaData, resumeProgress]);

    

    // Pause current video helper function
    const pauseAllVideos = () => {
        if (currentVideoRef.current && !currentVideoRef.current.paused) {
            currentVideoRef.current.pause();
        }
    };

    // Handle keyboard navigation with useCallback to avoid stale closures
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                // Go to previous video
                if (currentMediaIndex > 0) {
                    pauseAllVideos();
                    setVerticalSlideDirection('up');
                    const newIndex = currentMediaIndex - 1;
                    setCurrentMediaIndex(newIndex);
                    setCurrentRelatedIndex(0);
                    
                    // Update URL to reflect current video
                    const currentVideo = mediaData[newIndex];
                    if (currentVideo) {
                        history.pushState({}, '', `/recommended?v=${currentVideo.id}`);
                    }
                    
                    // Preload next few videos for smooth navigation
                    preloadNextVideos(newIndex, 3);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Go to next video
                if (currentMediaIndex < mediaData.length - 1) {
                    pauseAllVideos();
                    setVerticalSlideDirection('down');
                    const newIndex = currentMediaIndex + 1;
                    setCurrentMediaIndex(newIndex);
                    setCurrentRelatedIndex(0);
                    
                    // Update URL to reflect current video
                    const currentVideo = mediaData[newIndex];
                    if (currentVideo) {
                        history.pushState({}, '', `/recommended?v=${currentVideo.id}`);
                    }
                    
                    // Preload next few videos for smooth navigation
                    preloadNextVideos(newIndex, 3);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                // Seek backward 10 seconds in current video
                {
                    const currentMedia = mediaData[currentMediaIndex];
                    const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                    const currentContent = allContent[currentRelatedIndex];
                    if (currentContent?.type === 'VIDEO') {
                        if (currentVideoRef.current) {
                            // Seek backward by 10% of video duration (like YouTube)
                            const seekAmount = currentVideoRef.current.duration * 0.1;
                            currentVideoRef.current.currentTime = Math.max(0, currentVideoRef.current.currentTime - seekAmount);
                        }
                    }
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                // Seek forward 10 seconds in current video
                {
                    const currentMedia = mediaData[currentMediaIndex];
                    const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                    const currentContent = allContent[currentRelatedIndex];
                    if (currentContent?.type === 'VIDEO') {
                        if (currentVideoRef.current) {
                            // Seek forward by 10% of video duration (like YouTube)
                            const seekAmount = currentVideoRef.current.duration * 0.1;
                            currentVideoRef.current.currentTime = Math.min(currentVideoRef.current.duration || 0, currentVideoRef.current.currentTime + seekAmount);
                        }
                    }
                }
                break;
            case ' ':
            case 'Space':
                e.preventDefault();
                // Toggle play/pause for current video
                {
                    const currentMedia = mediaData[currentMediaIndex];
                    const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
                    const currentContent = allContent[currentRelatedIndex];
                    if (currentContent?.type === 'VIDEO') {
                        if (currentVideoRef.current) {
                            if (currentVideoRef.current.paused) {
                                currentVideoRef.current.play().catch(console.error);
                            } else {
                                currentVideoRef.current.pause();
                            }
                        }
                    }
                }
                break;
        }
    }, [currentMediaIndex, currentRelatedIndex, mediaData, pauseAllVideos, preloadNextVideos]);

    // Set up keyboard controls after handleKeyDown is defined
    useEffect(() => {
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
        
        // Auto-focus container on mount for development
        setTimeout(() => {
            const container = document.querySelector('.recommended-container');
            if (container) {
                (container as HTMLElement).focus();
            }
        }, 100);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handlePageClick);
        };
    }, [handleKeyDown]); // Add handleKeyDown as dependency

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
            <div className="sticky top-14 z-[300] relative h-[calc(100vh-100px)] w-full flex items-center justify-center overflow-visible pt-2 md:pt-4">
                <div ref={playerContainerRef} className="h-full w-full max-w-[30rem] md:max-w-[30rem] sm:max-w-[28rem] rounded-2xl md:rounded-3xl overflow-hidden bg-[#0b0b0b] relative z-[500]">
                    {/* Glow tied to the player box (not the full page) */}
                    <div className="pointer-events-none absolute inset-1 rounded-[1rem] md:rounded-[1.5rem] bg-white/12 blur-[12px] md:blur-[18px] z-0" />
                    
                    {/* Scrollable Video Container */}
                    <div 
                        className="h-full overflow-y-auto scrollbar-hide"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Current Video */}
                        <div className="h-full w-full relative">
                            {/* Video Content */}
                            {(() => {
                                const currentMedia = mediaData[currentMediaIndex];
                                if (!currentMedia) return null;
                                
                                return (
                                    <>
                                        {/* Video/Image Content */}
                                        {currentMedia.type === 'VIDEO' ? (
                                            <video
                                                ref={currentVideoRef}
                                                className="w-full h-full object-cover"
                                                src={currentMedia.url}
                                                preload="metadata"
                                                poster={currentMedia.thumbnailUrl}
                                                loop
                                                muted
                                                playsInline
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    
                                                    if (currentVideoRef.current) {
                                                        if (currentVideoRef.current.paused) {
                                                            currentVideoRef.current.play().catch(console.error);
                                                        } else {
                                                            currentVideoRef.current.pause(); 
                                                        }
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <img
                                                src={currentMedia.url}
                                                alt={currentMedia.title}
                                                className="w-full h-full object-cover"
                                            />
                                        )}

                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                                        
                                        {/* Media Info */}
                                        <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 flex justify-between items-end z-20">
                                            <div className="flex-1 space-y-1 pr-2">
                                                <h3 className="text-sm md:text-lg font-semibold text-white line-clamp-2">{currentMedia.title}</h3>
                                                <div className="flex items-center space-x-2">
                                                    <img 
                                                        src={currentMedia.uploader.avatarUrl || `https://placehold.co/40x40/555555/ffffff?text=${currentMedia.uploader.username.charAt(0).toUpperCase()}`} 
                                                        alt="Channel profile" 
                                                        className="w-6 h-6 md:w-8 md:h-8 rounded-full" 
                                                    />
                                                    <p className="text-gray-200 text-xs md:text-sm">{currentMedia.uploader.displayName || currentMedia.uploader.username}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col space-y-2 md:space-y-4">
                                                <ActionButton
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 017.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3A5.5 5.5 0 0122 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>}
                                                    label={currentMedia.likes?.toString() || '0'}
                                                />
                                                <ActionButton
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>}
                                                    label={currentMedia._count?.comments?.toString() || '0'}
                                                />
                                                <ActionButton
                                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.48 1.25.79 2.04.79 2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4c0 .24.04.47.09.7L7.05 11.23c-.54-.48-1.25-.79-2.04-.79-2.21 0-4 1.79-4 4s1.79 4 4 4c.79 0 1.5-.31 2.04-.79l7.05 4.11c-.05.23-.09.46-.09.7 0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4zM18 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-12 9c1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm12 9c1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>}
                                                    label="Share"
                                                />
                                                {currentMedia.type === 'VIDEO' && (
                                                    <button
                                                        className="flex flex-col items-center justify-center p-1 md:p-2 text-white/90 hover:text-white transition-colors duration-200"
                                                        title={currentVideoRef.current?.paused ? "Play" : "Pause"}
                                                        onClick={() => {
                                                            if (currentVideoRef.current) {
                                                                if (currentVideoRef.current.paused) {
                                                                    currentVideoRef.current.play().catch(console.error);
                                                                } else {
                                                                    currentVideoRef.current.pause();
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {currentVideoRef.current?.paused ? 
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> : 
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                                        }
                                                        <span className="text-xs mt-1 hidden md:block">{currentVideoRef.current?.paused ? "Play" : "Pause"}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        
                        {/* Next Video Preview Peek */}
                        {mediaData.length > currentMediaIndex + 1 && (
                            <div className="w-full h-24 md:h-32 relative mt-2 md:mt-4">
                                <div className="w-full h-full rounded-lg md:rounded-xl overflow-hidden bg-black">
                                    <video
                                        src={mediaData[currentMediaIndex + 1]?.url}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        poster={mediaData[currentMediaIndex + 1]?.thumbnailUrl}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    <div className="absolute bottom-1 md:bottom-2 left-1 md:left-2 right-1 md:right-2">
                                        <div className="flex items-center justify-between text-white text-xs">
                                            <span className="font-medium truncate text-xs md:text-sm">
                                                {mediaData[currentMediaIndex + 1]?.title || 'Next Video'}
                                            </span>
                                            <button 
                                                className="px-1 md:px-2 py-0.5 md:py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-full font-medium transition-colors"
                                                onClick={() => {
                                                    setCurrentMediaIndex(currentMediaIndex + 1);
                                                    setCurrentRelatedIndex(0);
                                                }}
                                            >
                                                <span className="hidden md:inline">Watch</span>
                                                <span className="md:hidden">▶</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecommendedPageContent;
