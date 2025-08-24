import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { logImpression, logClick } from '@/lib/analytics';

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
    watchProgress?: number; // 0-1, how much was watched (for history)
    // Legacy fields for mock data compatibility
    profilePicUrl?: string;
    channel?: string;
    score?: number; // Added for analytics
}

// Generate avatar URL using our CORS-enabled placeholder service
const generateAvatarSvg = (username: string) => {
    const initial = username.charAt(0).toUpperCase();
    const hash = username.split('').reduce((a, b) => {
        a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
        return a;
    }, 0);
    const colors = ['0e7490', 'b91c1c', '6d28d9', '16a34a', 'd97706', 'dc2626', '7c3aed', '059669'];
    const color = colors[Math.abs(hash) % colors.length];
    
    return `/api/placeholder?text=${initial}&size=40x40&color=${color}&bg=ffffff`;
};

interface VideoCardProps {
    video: VideoData;
    showTopSeparator?: boolean;
    onImpression?: (mediaId: string, position: number) => void;
    onCardClick?: (mediaId: string, position: number) => void;
}

const VideoCard = ({ video, showTopSeparator = false, onImpression, onCardClick }: VideoCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { data: session } = useSession();

    // Format large numbers (1K, 1.2M, 1.5B)
    const formatViewCount = (count: number): string => {
        if (count >= 1000000000) {
            return (count / 1000000000).toFixed(1).replace('.0', '') + 'B';
        }
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
        }
        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace('.0', '') + 'K';
        }
        return count.toString();
    };

    // Simple impression tracking only (no like fetching for now)
    useEffect(() => {
        if (!video?.id || !onImpression) return;
        const el = cardRef.current;
        if (!el) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    const position = Array.from(entry.target.parentNode?.children || []).indexOf(entry.target) + 1;
                    onImpression(video.id!, position);
                    observer.disconnect();
                }
            });
        }, { threshold: [0.6] });
        observer.observe(el);
        return () => observer.disconnect();
    }, [video?.id, onImpression]);

    // Simple like handling (temporarily disabled to avoid API flood)
    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        
        if (!session) {
            router.push('/auth/signin');
            return;
        }

        if (!video.id) return;

        // TODO: Re-implement with proper batching
        // Like clicked for: video.id
    };

    // 3-Layer Thumbnail System - Production-ready like YouTube
    const getThumbnailSource = () => {
        // Layer 1: Specific video uploaded thumbnail (highest priority)
        if (video.thumbnailUrl && video.thumbnailUrl !== video.url) {
            return video.thumbnailUrl;
        }
        
        // Layer 2: If it's an image, use the image itself
        if (video.type === 'IMAGE' && video.url) {
            return video.url;
        }
        
        // Layer 3: For videos, try to use video frame as thumbnail
        if (video.type === 'VIDEO') {
            if (generatedThumbnail) {
                return generatedThumbnail;
            }
            // If no generated thumbnail, use demo image
            return generateDemoImage();
        }
        
        // Layer 3: For audio, use audio icon
        if (video.type === 'AUDIO') {
            return generateDemoImage();
        }
        
        // Layer 3: Fallback to demo image based on content type
        if (video.type) {
            return generateDemoImage();
        }
        
        // Final fallback
        return generateDemoImage();
    };

    // Generate demo image for non-commercial use (Layer 2)
    const generateDemoImage = () => {
        const title = video.title || 'Demo';
        const hash = title.split('').reduce((a, b) => {
            a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
            return a;
        }, 0);
        const colors = ['0e7490', 'b91c1c', '6d28d9', '16a34a', 'd97706', 'dc2626', '7c3aed', '059669'];
        const color = colors[Math.abs(hash) % colors.length];
        
        return `/api/placeholder?text=${encodeURIComponent(title)}&size=600x800&color=${color}&bg=ffffff`;
    };

    // Generate video placeholder using our CORS-enabled service
    const generateVideoPlaceholder = (type: string) => {
        const hash = type.split('').reduce((a, b) => {
            a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
            return a;
        }, 0);
        const colors = ['0e7490', 'b91c1c', '6d28d9', '16a34a', 'd97706', 'dc2626', '7c3aed', '059669'];
        const color = colors[Math.abs(hash) % colors.length];
        
        return `/api/placeholder?text=${encodeURIComponent(type)}&size=400x400&color=${color}&bg=ffffff`;
    };

    // Generate thumbnail from video (skip for cross-origin sources to avoid tainted canvas)
    const generateVideoThumbnail = () => {
        if (!videoRef.current || video.type !== 'VIDEO') return null;
        const el = videoRef.current;
        try {
            const src = el.currentSrc || el.src;
            const origin = new URL(src, window.location.href).origin;
            if (origin !== window.location.origin) {
                return null; // avoid CORS-tainted canvas errors
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const videoAspect = el.videoWidth / el.videoHeight;
            const canvasAspect = 3 / 4; // Our target 3:4 aspect ratio

            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = el.videoWidth;
            let sourceHeight = el.videoHeight;

            if (videoAspect > canvasAspect) {
                sourceWidth = el.videoHeight * canvasAspect;
                sourceX = (el.videoWidth - sourceWidth) / 2;
            } else {
                sourceHeight = el.videoWidth / canvasAspect;
                sourceY = (el.videoHeight - sourceHeight) / 2;
            }

            canvas.width = 600;
            canvas.height = 800;

            ctx.drawImage(
                el,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                canvas.width,
                canvas.height
            );

            return canvas.toDataURL('image/jpeg', 0.9);
        } catch (_err) {
            return null;
        }
    };

    const handleClick = () => {
        if (video.id) {
            const position = Array.from(cardRef.current?.parentNode?.children || []).indexOf(cardRef.current!) + 1;
            onCardClick?.(video.id, position);
            
            // Build URL with resume functionality
            const params = new URLSearchParams({ mediaId: video.id });
            if (video.watchProgress && video.watchProgress > 0.05 && video.watchProgress < 0.95) {
                params.append('t', Math.round(video.watchProgress * 100).toString()); // Resume percentage
            }
            router.push(`/recommended?${params.toString()}`);
        } else {
            router.push('/recommended');
        }
    };



    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current && video.type === 'VIDEO') {
            // Skip hover preview if card is offscreen or tab is hidden to save resources
            if (document.hidden) return;
            const rect = cardRef.current?.getBoundingClientRect();
            if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return;
            const handleLoadedData = () => {
                videoRef.current?.play().catch(error => {
                    console.error('Autoplay failed:', error);
                    setIsHovered(false);
                });
                
                // Generate thumbnail after video starts playing and a frame is available
                setTimeout(() => {
                    if (videoRef.current && !generatedThumbnail) {
                        const thumbnail = generateVideoThumbnail();
                        if (thumbnail) {
                            setGeneratedThumbnail(thumbnail);
                        }
                    }
                }, 500); // Wait a bit for video to load a frame
            };

            videoRef.current.addEventListener('loadeddata', handleLoadedData, { once: true });
            
            if (videoRef.current.readyState >= 3) {
                handleLoadedData();
            }
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (videoRef.current && video.type === 'VIDEO') {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            videoRef.current.removeEventListener('loadeddata', () => {});
        }
    };

    return (
        <div 
            ref={cardRef}
            className={`group relative flex flex-col overflow-hidden rounded-md shadow-sm transition-transform duration-200 transform hover:scale-102 cursor-pointer ${showTopSeparator ? 'border-t border-white/10' : ''}`}
            style={{ aspectRatio: '3/4' }}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <img
                src={getThumbnailSource()}
                alt={video.title}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered && video.type === 'VIDEO' ? 'opacity-0' : 'opacity-100'}`}
                onError={(e) => {
                    // Image load error: e.currentTarget.src
                    e.currentTarget.onerror = null;
                    
                    // Layer 3: Final fallback - "Image not found" placeholder
                    const fallbackUrl = `/api/placeholder?text=Image%20not%20found&size=600x800&color=ffffff&bg=6b7280`;
                    e.currentTarget.src = fallbackUrl;
                }}
            />
            
            {video.type === 'VIDEO' && video.url && (
                <video
                    ref={videoRef}
                    src={video.url}
                    crossOrigin="anonymous"
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={video.thumbnailUrl || undefined}
                />
            )}
            
            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>

            {/* View count - top left */}
            {(video.views || 0) > 0 && (
                <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                    <p className="text-white text-xs flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {formatViewCount(video.views || 0)}
                    </p>
                </div>
            )}

            {/* Like button - top right - show only on card hover */}
            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                    onClick={handleLike}
                    className="p-2 rounded-full backdrop-blur-sm transition-all duration-200 bg-black/20 text-gray-300 hover:bg-black/40 hover:text-white"
                >
                    <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                </button>
            </div>

            <div className="absolute bottom-0 left-0 w-full p-3 flex items-start space-x-3 z-10">
                <img
                    src={video.uploader?.avatarUrl || video.profilePicUrl || generateAvatarSvg(video.uploader?.username || video.channel || 'U')}
                    alt="Channel profile"
                    className="w-8 h-8 rounded-full"
                />
                <div className="flex-1">
                    <h3 className="font-semibold text-white text-sm line-clamp-2">
                        {video.title}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">
                        {video.uploader?.displayName || video.uploader?.username || video.channel || 'Unknown'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VideoCard;