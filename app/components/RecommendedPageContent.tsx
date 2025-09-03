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
            const recentlySeen = mediaData.slice(0, 10).map((m: MediaData) => m.id);
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
    const [isVideoTouched, setIsVideoTouched] = useState(false);
    const [videoTouchStart, setVideoTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
    
    // Immersive mode state
    const [isImmersiveMode, setIsImmersiveMode] = useState(false);
    const [initialDistance, setInitialDistance] = useState<number | null>(null);
    
    // Minimum swipe distance (in pixels) - reduced for better sensitivity
    const minSwipeDistance = 30;
    const videoTapThreshold = 200; // Max time for tap vs hold (ms)
    
    // Calculate distance between two touch points for zoom detection
    const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };
    
    // Handle touch start
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
        
        // Initialize zoom distance if two fingers
        if (e.targetTouches.length === 2) {
            const distance = getDistance(e.targetTouches[0], e.targetTouches[1]);
            setInitialDistance(distance);
        } else {
            setInitialDistance(null);
        }
    };
    
    // Handle touch move
    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
        
        // Handle zoom gesture
        if (e.targetTouches.length === 2 && initialDistance !== null) {
            const currentDistance = getDistance(e.targetTouches[0], e.targetTouches[1]);
            const zoomThreshold = 50; // Minimum distance change to trigger zoom
            
            if (Math.abs(currentDistance - initialDistance) > zoomThreshold) {
                if (currentDistance > initialDistance) {
                    // Zoom in - enter full screen
                    if (!isImmersiveMode) {
                        setIsImmersiveMode(true);
                    }
                } else {
                    // Zoom out - exit full screen
                    if (isImmersiveMode) {
                        setIsImmersiveMode(false);
                    }
                }
                setInitialDistance(currentDistance); // Update for continuous zoom
            }
        }
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
        
        setInitialDistance(null);
    };
    
    // Mobile video-specific touch handlers
    const handleVideoTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        setIsVideoTouched(true);
        setVideoTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY,
            time: Date.now()
        });
    };
    
    const handleVideoTouchEnd = (e: React.TouchEvent) => {
        e.stopPropagation();
        setIsVideoTouched(false);
        
        if (!videoTouchStart) return;
        
        const touchDuration = Date.now() - videoTouchStart.time;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const distanceX = Math.abs(videoTouchStart.x - touchEndX);
        const distanceY = Math.abs(videoTouchStart.y - touchEndY);
        
        // If it's a quick tap (not a swipe)
        if (touchDuration < videoTapThreshold && distanceX < 10 && distanceY < 10) {
            // Toggle play/pause
            if (currentVideoRef.current) {
                if (currentVideoRef.current.paused) {
                    currentVideoRef.current.play().catch(() => {});
                                } else {
                    currentVideoRef.current.pause();
                }
            }
        }
        
        setVideoTouchStart(null);
    };
    
    // Simplified and more reliable touch handling with immersive mode
    const handleContainerTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };
    
    const handleContainerTouchMove = (e: React.TouchEvent) => {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };
    
        const handleContainerTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart || !touchEnd) return;
        
        const distanceX = touchStart.x - touchEnd.x;
        const distanceY = touchStart.y - touchEnd.y;
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;
        const isUpSwipe = distanceY > minSwipeDistance;
        const isDownSwipe = distanceY < -minSwipeDistance;
        
        // Reset swiping state
        
        // Debug logging for mobile
        console.log('Touch end:', { distanceX, distanceY, isLeftSwipe, isRightSwipe, isUpSwipe, isDownSwipe });
        
        // Only handle swipes if they're more vertical than horizontal (like TikTok/YouTube Shorts)
        if (Math.abs(distanceY) > Math.abs(distanceX)) {
            if (isUpSwipe) {
                // Swipe up - next video
                e.preventDefault();
                console.log('Swipe up detected - going to next video');
                if (mediaData.length > currentMediaIndex + 1) {
                    setCurrentMediaIndex(currentMediaIndex + 1);
                    setCurrentRelatedIndex(0);
                    // Activate immersive mode when actually changing videos
                    setIsImmersiveMode(true);
                }
            } else if (isDownSwipe) {
                // Swipe down - previous video
                e.preventDefault();
                console.log('Swipe down detected - going to previous video');
                if (currentMediaIndex > 0) {
                    setCurrentMediaIndex(currentMediaIndex - 1);
                            setCurrentRelatedIndex(0);
                    // Activate immersive mode when actually changing videos
                    setIsImmersiveMode(true);
                            }
                        }
                    } else {
            // Horizontal swipes - scroll the page or related content
            if (isLeftSwipe) {
                // Swipe left - scroll right
                e.preventDefault();
                console.log('Swipe left detected - scrolling right');
                window.scrollBy({ left: 100, behavior: 'smooth' });
            } else if (isRightSwipe) {
                // Swipe right - scroll left
                e.preventDefault();
                console.log('Swipe right detected - scrolling left');
                window.scrollBy({ left: -100, behavior: 'smooth' });
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



    // No scroll-based exit for immersive mode - only controlled by zoom gestures
    
    // No auto-exit for immersive mode - controlled by zoom gestures
    
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
        <div 
            className={`flex-1 w-full recommended-container relative z-[200] transition-all duration-300 ${
                isImmersiveMode ? 'fixed inset-0 z-[99999] bg-black' : ''
            }`}
            tabIndex={0}
            onTouchStart={handleContainerTouchStart}
            onTouchMove={handleContainerTouchMove}
            onTouchEnd={handleContainerTouchEnd}
                            style={{ 
                touchAction: 'manipulation',
                ...(isImmersiveMode && {
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh'
                })
            }}
        >
            <div className={`sticky z-[300] relative w-full flex items-center justify-center overflow-visible transition-all duration-300 ${
                isImmersiveMode 
                    ? 'top-0 h-screen pt-0 pb-0' 
                    : 'top-14 h-[calc(100vh-100px)] pt-2 md:pt-4'
            }`}>
                <div ref={playerContainerRef} className={`h-full w-full overflow-hidden bg-[#0b0b0b] relative z-[500] transition-all duration-300 ${
                    isImmersiveMode 
                        ? 'max-w-none rounded-none h-[100vh] w-[100vw]' 
                        : 'max-w-[30rem] md:max-w-[30rem] sm:max-w-[28rem] rounded-2xl md:rounded-3xl'
                }`}>
                    {/* Glow tied to the player box (not the full page) - Hidden in immersive mode */}
                    {!isImmersiveMode && (
                        <div className="pointer-events-none absolute inset-1 rounded-[1rem] md:rounded-[1.5rem] bg-white/12 blur-[12px] md:blur-[18px] z-0" />
                    )}
                    
                    {/* Scrollable Video Container */}
                    <div 
                        className="h-full overflow-y-auto scrollbar-hide"
                        style={{ touchAction: 'pan-y' }}
                    >
                        {/* Current Video - Full Height */}
                        <div className="h-full w-full relative">
                            {/* Mobile Swipe Indicator - Hidden in immersive mode */}
                            {!isImmersiveMode && (
                                <div className="md:hidden absolute top-4 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
                                    <div className="bg-black/50 rounded-full px-3 py-1 text-white text-xs">
                                        ↑ Swipe for next video ↓
                                    </div>
                                </div>
                            )}
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
                                                className="w-full h-full object-cover touch-none select-none"
                                                src={currentMedia.url}
                                             preload="metadata"
                                                poster={currentMedia.thumbnailUrl}
                                            loop
                                            muted
                                            playsInline
                                                controls={false}
                                                onTouchStart={handleVideoTouchStart}
                                                onTouchEnd={handleVideoTouchEnd}
                                                onClick={(e: React.MouseEvent) => {
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
                                        
                                        {/* Mobile Play/Pause Overlay */}
                                        {isVideoTouched && currentMedia.type === 'VIDEO' && (
                                            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                                                <div className="bg-black/50 rounded-full p-4 md:p-6">
                                                    {currentVideoRef.current?.paused ? (
                                                        <svg className="w-8 h-8 md:w-12 md:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z"/>
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-8 h-8 md:w-12 md:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    
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
                
                                                {/* No preview - pure TikTok-style instant swiping */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecommendedPageContent;
