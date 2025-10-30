'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoPlayPauseOverlayProps {
  isPlaying: boolean;
  isVisible: boolean;
}

const VideoPlayPauseOverlay: React.FC<VideoPlayPauseOverlayProps> = ({
  isPlaying,
  isVisible,
}) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 800); // Show for 0.8 seconds - slightly slower
      return () => {
        clearTimeout(timer);
      };
    } else {
      setShowAnimation(false);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {showAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          {/* YouTube Shorts style pulsing background circle */}
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ 
              scale: [0, 1.2, 1.5],
              opacity: [0.8, 0.4, 0]
            }}
            transition={{ 
              duration: 0.8,
              ease: "easeOut",
              times: [0, 0.5, 1]
            }}
            className="absolute bg-black/60 rounded-full w-16 h-16 md:w-20 md:h-20"
          />
          
          {/* Icon with quick fade in/out */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: 1,
              opacity: [0, 1, 1, 0]
            }}
            transition={{ 
              duration: 0.8,
              ease: "easeOut",
              times: [0, 0.1, 0.7, 1]
            }}
            className="relative text-white drop-shadow-lg"
          >
            {isPlaying ? (
              <svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayPauseOverlay;
