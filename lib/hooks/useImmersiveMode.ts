'use client';

import { useState, useEffect } from 'react';

export const useImmersiveMode = () => {
  // Immersive mode state - true on mobile for YouTube Shorts experience, false on desktop
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);

  // Detect screen size and set immersive mode appropriately
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsImmersiveMode(isMobile);
    };
    
    // Set initial state
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Hide browser UI and navbar on mobile when in immersive mode (YouTube Shorts style)
  useEffect(() => {
    if (isImmersiveMode && window.innerWidth < 768) { // Mobile only
      // Hide browser UI
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Hide navbar on mobile
      const navbarContainer = document.getElementById('navbar-container');
      if (navbarContainer) {
        navbarContainer.style.display = 'none';
      }
      
      // Try to hide browser chrome (works on some browsers)
      if ('standalone' in window.navigator) {
        // iOS Safari
        document.documentElement.style.webkitAppearance = 'none';
      }
      
      return () => {
        // Restore browser UI when exiting immersive mode
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.documentElement.style.webkitAppearance = '';
        
        // Restore navbar
        if (navbarContainer) {
          navbarContainer.style.display = '';
        }
      };
    }
  }, [isImmersiveMode]);

  return {
    isImmersiveMode,
  };
};






