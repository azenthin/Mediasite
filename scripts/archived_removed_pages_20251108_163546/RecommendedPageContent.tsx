'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from './ActionButton';
import MobileMenu from './MobileMenu';
import { useMediaData } from '@/lib/hooks/useMediaData';
import { useVideoControls } from '@/lib/hooks/useVideoControls';
import { useVideoProgress } from '@/lib/hooks/useVideoProgress';
import { useTouchGestures } from '@/lib/hooks/useTouchGestures';
import { useKeyboardControls } from '@/lib/hooks/useKeyboardControls';
import { useImmersiveMode } from '@/lib/hooks/useImmersiveMode';
import { usePreloading } from '@/lib/hooks/usePreloading';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { useAnimations } from '@/lib/hooks/useAnimations';
import VideoTimeBar from './VideoTimeBar';
import VideoPlayPauseOverlay from './VideoPlayPauseOverlay';
import CommentSection from './CommentSection';
import { usePathname } from 'next/navigation';

interface MediaData {
    id: string;
    type: 'VIDEO' | 'IMAGE' | 'AUDIO';
    url: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    uploader: {
        id?: string; // User ID for subscription functionality
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
    userLiked?: boolean; // Whether the current user has liked this media
    relatedMedia?: MediaData[];
}



// YouTube-style: No static data, everything comes from API

const RecommendedPageContent = () => {
    const router = useRouter();
    const pathname = usePathname();
    const playerContainerRef = useRef<HTMLDivElement | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Use custom hooks for different functionalities
    const { mediaData, loading, error, resumeProgress, clearResumeProgress } = useMediaData();
    const { isImmersiveMode } = useImmersiveMode();
    const { preloadNextVideos } = usePreloading({ mediaData });
    
    // Create a placeholder pauseAllVideos function that will be updated
    let pauseAllVideosRef = useRef<() => void>(() => {});
    
    const {
        currentMediaIndex,
        currentRelatedIndex,
        verticalSlideDirection,
        setCurrentMediaIndex,
        setCurrentRelatedIndex,
        handleHorizontalScroll,
        handleVerticalScroll,
        navigateToMediaIndex,
    } = useNavigation({
        mediaData,
        pauseAllVideos: () => pauseAllVideosRef.current(),
        preloadNextVideos,
    });
    
    const { currentVideoRef, triggerVideoPlayPause, pauseAllVideos, isPlaying } = useVideoControls({
        currentMediaIndex,
        currentRelatedIndex,
        mediaData,
        resumeProgress,
        onResumeProgressCleared: clearResumeProgress,
    });
    
    // Update the ref with the actual pauseAllVideos function
    pauseAllVideosRef.current = pauseAllVideos;

    // Video progress tracking for smooth time bar
    const {
        currentTime,
        duration,
        progress,
        isSeeking,
        formatTime,
        handleProgressClick,
        handleProgressTouch,
    } = useVideoProgress({
        videoRef: currentVideoRef,
        isPlaying,
    });

    // Get animation variants
    const { slideVariants, verticalSlideVariants } = useAnimations();
    
    // Play/pause animation state - simplified to single state
    const [animationState, setAnimationState] = useState<{
        show: boolean;
        isPlaying: boolean;
    }>({ show: false, isPlaying: false });
    
    // Hover state for media info
    const [isHovering, setIsHovering] = useState(false);
    
    // Like state management
    const [likeStates, setLikeStates] = useState<{ [mediaId: string]: { liked: boolean; count: number; pending: boolean } }>({});
    const pendingRequests = useRef<Set<string>>(new Set());
    
    // Comment section state
    const [isCommentSectionOpen, setIsCommentSectionOpen] = useState(false);
    
    // Initialize like states when media data changes
    React.useEffect(() => {
        const newLikeStates: { [mediaId: string]: { liked: boolean; count: number; pending: boolean } } = {};
        mediaData.forEach(media => {
            newLikeStates[media.id] = {
                liked: media.userLiked || false,
                count: media.likes || 0,
                pending: false
                    };
                });
        setLikeStates(newLikeStates);
    }, [mediaData]);
    
    // Handle like/unlike functionality with YouTube-style instant updates
    const handleLike = async (mediaId: string) => {
        const currentState = likeStates[mediaId];
        const currentLiked = currentState?.liked || false;
        const currentCount = currentState?.count || 0;
        
        const newLiked = !currentLiked;
        const newCount = currentLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
        
        // YouTube-style: Update UI immediately, no pending state
        setLikeStates(prev => ({
            ...prev,
            [mediaId]: {
                liked: newLiked,
                count: newCount,
                pending: false
            }
        }));
        
        // Debounced API call - only make one API call per 300ms
        if (pendingRequests.current.has(mediaId)) {
            return; // Already queued
        }
        
        pendingRequests.current.add(mediaId);
        
        // Debounce API calls
        setTimeout(async () => {
            try {
                const response = await fetch(`/api/media/${mediaId}/like`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // Only update if the server response differs from current state
                    setLikeStates(prev => {
                        const current = prev[mediaId];
                        if (current && (current.liked !== data.liked || current.count !== data.likeCount)) {
                            return {
                                ...prev,
                                [mediaId]: {
                                    liked: data.liked,
                                    count: data.likeCount,
                                    pending: false
                                }
                            };
                        }
                        return prev;
                    });
                    } else {
                    // Revert on error
                    setLikeStates(prev => ({
                        ...prev,
                        [mediaId]: {
                            liked: currentLiked,
                            count: currentCount,
                            pending: false
                        }
                    }));
                }
            } catch (error) {
                // Revert on error
                setLikeStates(prev => ({
                    ...prev,
                    [mediaId]: {
                        liked: currentLiked,
                        count: currentCount,
                        pending: false
                    }
                }));
                console.error('Error toggling like:', error);
            } finally {
                pendingRequests.current.delete(mediaId);
            }
        }, 300); // 300ms debounce
    };
    
    // Handle comment button click
    const handleCommentClick = () => {
        setIsCommentSectionOpen(true);
    };
    
    // Reset animation state when video changes
    React.useEffect(() => {
        setAnimationState({ show: false, isPlaying: false });
    }, [currentMediaIndex]);
    
    // Auto-hide animation after it shows
    React.useEffect(() => {
        if (animationState.show) {
            const timer = setTimeout(() => {
                setAnimationState(prev => ({ ...prev, show: false }));
            }, 800); // Hide after 0.8 seconds - slightly slower
            return () => clearTimeout(timer);
        }
    }, [animationState.show]);
    
    // Use touch gestures hook
    const {
        touchStart,
        touchEnd,
        isVideoTouched,
        videoTouchStart,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleVideoTouchStart,
        handleVideoTouchEnd,
    } = useTouchGestures({
        isImmersiveMode,
        currentMediaIndex,
        mediaDataLength: mediaData.length,
        onVerticalSwipe: handleVerticalScroll,
        onHorizontalSwipe: handleHorizontalScroll,
        onVideoTap: triggerVideoPlayPause,
        onVideoDoubleTap: (direction) => {
            if (!currentVideoRef.current || !currentVideoRef.current.duration) return;
            const vid = currentVideoRef.current;
            const seekBy = vid.duration * 0.1; // 10%
            if (direction === 'left') {
                vid.currentTime = Math.max(0, vid.currentTime - seekBy);
            } else {
                vid.currentTime = Math.min(vid.duration, vid.currentTime + seekBy);
            }
        },
    });
    

    // Use keyboard controls hook
    useKeyboardControls({
        currentMediaIndex,
        currentRelatedIndex,
        mediaData,
        pauseAllVideos,
        preloadNextVideos,
        onVerticalNavigation: handleVerticalScroll,
        onHorizontalNavigation: handleHorizontalScroll,
        onVideoSeek: (direction) => {
                        const currentMedia = mediaData[currentMediaIndex];
                        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
            const currentContent = allContent[currentRelatedIndex];
            if (currentContent?.type === 'VIDEO' && currentVideoRef.current) {
                const seekAmount = currentVideoRef.current.duration * 0.1;
                if (direction === 'left') {
                    currentVideoRef.current.currentTime = Math.max(0, currentVideoRef.current.currentTime - seekAmount);
                    } else {
                    currentVideoRef.current.currentTime = Math.min(currentVideoRef.current.duration || 0, currentVideoRef.current.currentTime + seekAmount);
                }
            }
        },
        onVideoPlayPause: () => {
        const currentMedia = mediaData[currentMediaIndex];
        const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
        const currentContent = allContent[currentRelatedIndex];
            if (currentContent?.type === 'VIDEO' && currentVideoRef.current) {
                if (currentVideoRef.current.paused) {
                    currentVideoRef.current.play().catch(console.error);
                    } else {
                    currentVideoRef.current.pause();
                }
            }
        },
    });

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

    // Debug logging for content flow (removed to prevent spam) - CACHE BUST

    return (
        <div 
            className={`flex-1 w-full recommended-container relative z-[200] transition-all duration-300 ${
                isImmersiveMode ? 'fixed inset-0 z-[99999] bg-black' : ''
            }`}
            tabIndex={0}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
                            style={{ 
                touchAction: 'pan-y', // Allow vertical panning for swipe gestures
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                overscrollBehavior: 'contain', // Prevent pull-to-refresh
                ...(isImmersiveMode && {
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    // Hide browser UI on mobile
                    position: 'fixed',
                    overflow: 'hidden'
                })
            }}
        >
            <div className={`sticky z-[300] relative w-full flex items-center justify-center overflow-visible transition-all duration-300 ${
                isImmersiveMode 
                    ? 'top-0 h-[100dvh] pt-0 pb-[env(safe-area-inset-bottom)]' 
                    : 'top-14 h-[calc(100vh-100px)] pt-2 md:pt-4'
            }`}>
        <div ref={playerContainerRef} className={`h-full w-full overflow-hidden bg-[#0b0b0b] relative z-[500] transition-all duration-300 ${
                    isImmersiveMode 
            ? 'max-w-none rounded-none h-[100dvh] w-[100vw] md:max-w-[30rem] md:max-w-[30rem] md:sm:max-w-[28rem] md:rounded-lg md:rounded-xl' 
                        : 'max-w-[30rem] md:max-w-[30rem] sm:max-w-[28rem] rounded-lg md:rounded-xl'
                }`}>
                    {/* Glow tied to the player box (not the full page) - Hidden in immersive mode */}
                    {!isImmersiveMode && (
                        <div className="pointer-events-none absolute inset-1 rounded-lg md:rounded-xl bg-white/12 blur-[12px] md:blur-[18px] z-0" />
                    )}
                    
                    {/* Scrollable Video Container */}
                    <div 
                        className="h-full overflow-y-auto scrollbar-hide"
                        style={{ touchAction: 'pan-y' }}
                        onMouseEnter={() => {
                            console.log('Mouse enter - showing media info');
                            setIsHovering(true);
                        }}
                        onMouseLeave={() => {
                            console.log('Mouse leave - hiding media info');
                            setIsHovering(false);
                        }}
                    >
                        {/* Current Video - Full Height */}
                        <div className="h-full w-full relative">
                            {/* Mobile Burger Menu Button - Only in immersive mode */}
                            {isImmersiveMode && (
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="md:hidden absolute top-4 left-4 z-50 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                                    aria-label="Open menu"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            )}
                            
                            {/* Video Content */}
                            {(() => {
                                // Use the currentMedia from the main scope, not redeclare it
                                if (!currentMedia) return null;
                                
                                return (
                                    <>
                                        {/* Video/Image Content */}
                                        {currentMedia.type === 'VIDEO' ? (
                                        <video
                                                ref={currentVideoRef}
                                                className="w-full h-full object-cover select-none cursor-pointer relative z-30"
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
                                                e.stopPropagation();
                                        
                                        if (currentVideoRef.current) {
                                            const wasPaused = currentVideoRef.current.paused;
                                            
                                            if (wasPaused) {
                                                currentVideoRef.current.play().catch(console.error);
                                                    } else { 
                                                currentVideoRef.current.pause(); 
                                            }
                                            
                                            // Show animation with correct play/pause state
                                            setAnimationState({ 
                                                show: true, 
                                                isPlaying: !wasPaused // Show play icon if it was paused (now playing)
                                            });
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
                                    
                                    {/* Bottom Shadow Overlay for Media Info - Show on hover */}
                                    <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 via-black/15 to-transparent z-50 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}></div>
                                    
                                    {/* YouTube-style Play/Pause Animation - Only show for user clicks on VIDEO content */}
                                    {currentMedia.type === 'VIDEO' && (
                                        <VideoPlayPauseOverlay
                                            isPlaying={animationState.isPlaying}
                                            isVisible={animationState.show}
                                        />
                                    )}
                                    
                                </>
                            );
                        })()}
                                    </div>
                                    
                        {/* Media Info - Show for all media types, positioned above progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 flex justify-between items-end z-60 px-3 md:px-4 pb-0 md:pb-8">
                            {/* Video Time Bar - Positioned alongside media info */}
                            {currentMedia.type === 'VIDEO' && (
                                <div className="absolute bottom-0 left-0 right-0 z-60 px-2 md:px-0">
                                    <VideoTimeBar
                                        currentTime={currentTime}
                                        duration={duration}
                                        progress={progress}
                                        isSeeking={isSeeking}
                                        formatTime={formatTime}
                                        onProgressClick={handleProgressClick}
                                        onProgressTouch={handleProgressTouch}
                                        isVisible={true}
                                    />
                                </div>
                            )}
                            {/* Title and Creator Info - Show on hover desktop, always on mobile */}
                            <div className={`flex-1 space-y-1 pr-2 md:transition-opacity md:duration-300 ${isHovering ? 'md:opacity-100' : 'md:opacity-0'}`} style={{ transform: 'translateY(-24px)' }}>
                                <h3 className="text-sm md:text-lg font-semibold text-white line-clamp-2" style={{ textShadow: '0 0 4px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)' }}>{currentMedia.title}</h3>
                                <div className="flex items-center space-x-2">
                                    <img 
                                        src={currentMedia.uploader.avatarUrl || `https://placehold.co/40x40/555555/ffffff?text=${currentMedia.uploader.username.charAt(0).toUpperCase()}`} 
                                        alt="Channel profile" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/profile/${currentMedia.uploader.username}`);
                                        }}
                                        className="w-6 h-6 md:w-8 md:h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-white/60 transition-all" 
                                        style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(0,0,0,0.4))' }}
                                    />
                                    <p 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/profile/${currentMedia.uploader.username}`);
                                        }}
                                        className="text-gray-200 text-xs md:text-sm cursor-pointer hover:underline" 
                                        style={{ textShadow: '0 0 4px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)' }}
                                    >
                                        {currentMedia.uploader.displayName || currentMedia.uploader.username}
                                    </p>
                                </div>
                            </div>
                            {/* Action Buttons - Always visible, optimized for mobile */}
                            <div className="flex flex-col space-y-4 md:space-y-3" style={{ transform: 'translateY(-80px)' }}>
                                <ActionButton
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 md:h-6 md:w-6" viewBox="0 0 24 24" fill={likeStates[currentMedia.id]?.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
                                    label={likeStates[currentMedia.id]?.count?.toString() || currentMedia.likes?.toString() || '0'}
                                    onClick={() => handleLike(currentMedia.id)}
                                    isActive={likeStates[currentMedia.id]?.liked || false}
                                    activeColor="text-red-500"
                                />
                                <ActionButton
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 md:h-6 md:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                                    label={currentMedia._count?.comments?.toString() || '0'}
                                    onClick={handleCommentClick}
                                />
                                <ActionButton
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 md:h-6 md:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>}
                                    label="Share"
                                />
                            </div>
                        </div>
                
                                                {/* No preview - pure TikTok-style instant swiping */}
                    </div>
                </div>
            </div>
            
            {/* Comment Section */}
            <CommentSection
                isOpen={isCommentSectionOpen}
                onClose={() => setIsCommentSectionOpen(false)}
                mediaId={currentMedia.id}
                mediaTitle={currentMedia.title}
                commentCount={currentMedia._count?.comments || 0}
            />
            
            {/* Mobile Menu */}
            <MobileMenu 
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                currentPath={pathname}
            />
        </div>
    );
};

export default RecommendedPageContent;
