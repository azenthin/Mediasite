'use client';

import React from 'react';

interface VideoTimeBarProps {
  currentTime: number;
  duration: number;
  progress: number;
  isSeeking: boolean;
  formatTime: (time: number) => string;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onProgressTouch: (e: React.TouchEvent<HTMLDivElement>) => void;
  isVisible?: boolean;
}

const VideoTimeBar: React.FC<VideoTimeBarProps> = ({
  currentTime,
  duration,
  progress,
  isSeeking,
  formatTime,
  onProgressClick,
  onProgressTouch,
  isVisible = true,
}) => {
  if (!isVisible || duration === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-2">
      {/* Time Bar Container */}
      <div 
        className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer group hover:h-2 transition-all duration-200"
        onClick={onProgressClick}
        onTouchEnd={onProgressTouch}
      >
        {/* Progress Fill */}
        <div 
          className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-75 ease-out"
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            transform: isSeeking ? 'scaleY(1.2)' : 'scaleY(1)',
          }}
        >
          {/* Progress Handle */}
          <div 
            className="absolute right-0 top-1/2 w-3 h-3 bg-white rounded-full transform -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
            style={{ 
              transform: `translateY(-50%) translateX(50%) ${isSeeking ? 'scale(1.2)' : 'scale(1)'}`,
            }}
          />
        </div>
        
        {/* Hover Preview */}
        <div className="absolute top-0 left-0 h-full bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
      
      {/* Time Display - Only show on hover */}
      <div className="flex justify-between items-center mt-1 text-xs text-white/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="select-none">
          {formatTime(currentTime)}
        </span>
        <span className="select-none">
          {formatTime(duration)}
        </span>
      </div>
      
      {/* Seeking Indicator */}
      {isSeeking && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
    </div>
  );
};

export default VideoTimeBar;


