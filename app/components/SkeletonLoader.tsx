'use client';

/**
 * Loading Skeleton Components
 * Provides skeleton loaders for better perceived performance
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-700/50 rounded ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Thumbnail skeleton */}
      <Skeleton className="aspect-video w-full rounded-lg" />
      
      <div className="flex gap-3">
        {/* Avatar skeleton */}
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        
        <div className="flex-1 space-y-2">
          {/* Title skeleton */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          
          {/* Metadata skeleton */}
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function NavbarSkeleton() {
  return (
    <div className="h-14 px-4 flex items-center justify-between bg-[#0f0f0f]">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function CommentsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-24 h-24 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Stats */}
      <div className="flex gap-6">
        <Skeleton className="h-16 w-24" />
        <Skeleton className="h-16 w-24" />
        <Skeleton className="h-16 w-24" />
      </div>
      
      {/* Content */}
      <VideoGridSkeleton count={8} />
    </div>
  );
}

export function MediaPlayerSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      {/* Video player */}
      <Skeleton className="aspect-video w-full rounded-lg" />
      
      {/* Title and metadata */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      
      {/* Channel info */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
