import React from 'react';

interface CategoryBarProps {
    categories: string[];
    activeCategory: string;
    onSelectCategory: (category: string) => void;
}

const CategoryBar = ({ categories, activeCategory, onSelectCategory }: CategoryBarProps) => {
    return (
        <div className="w-full bg-[#0f0f0f] py-2 px-4">
            <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                    <button
                        key={category}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none whitespace-nowrap
                            ${activeCategory === category
                                ? 'bg-white text-black'
                                : 'bg-[var(--button-bg-color)] text-white hover:bg-[#383838]'
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