import React, { useRef, useState, useEffect } from 'react';

interface CategoryBarProps {
    categories: string[];
    activeCategory: string;
    onSelectCategory: (category: string) => void;
}

const CategoryBar = ({ categories, activeCategory, onSelectCategory }: CategoryBarProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(false);

    // Check if scrollable and update fade indicators
    const updateFadeIndicators = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeftFade(scrollLeft > 10);
        setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    };

    useEffect(() => {
        updateFadeIndicators();
        window.addEventListener('resize', updateFadeIndicators);
        return () => window.removeEventListener('resize', updateFadeIndicators);
    }, [categories]);

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const scrollAmount = 200;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    return (
        <div className={`relative w-full bg-[#0f0f0f] py-3 border-b border-white/5 transition-all duration-200 ${showLeftFade ? 'pl-10' : 'pl-4'} ${showRightFade ? 'pr-9' : 'pr-4'}`}>
            {/* Left fade indicator */}
            {showLeftFade && (
                <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
            )}
            
            {/* Right fade indicator */}
            {showRightFade && (
                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#0f0f0f] to-transparent z-10 pointer-events-none" />
            )}

            {/* Scroll buttons */}
            {showLeftFade && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-[#272727] hover:bg-[#383838] flex items-center justify-center transition-all duration-200 shadow-lg"
                    aria-label="Scroll left"
                >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            
            {showRightFade && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-[#272727] hover:bg-[#383838] flex items-center justify-center transition-all duration-200 shadow-lg"
                    aria-label="Scroll right"
                >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            <div 
                ref={scrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth"
                onScroll={updateFadeIndicators}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {categories.map((category) => (
                    <button
                        key={category}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 focus:outline-none whitespace-nowrap
                            ${activeCategory === category
                                ? 'bg-white text-black'
                                : 'bg-[#272727] text-white hover:bg-[#383838]'
                            }`}
                        onClick={() => onSelectCategory(category)}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default CategoryBar;