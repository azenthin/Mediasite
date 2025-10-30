'use client';

// Animation variants for horizontal sliding
export const slideVariants = {
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
export const verticalSlideVariants = {
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

export const useAnimations = () => {
  return {
    slideVariants,
    verticalSlideVariants,
  };
};






