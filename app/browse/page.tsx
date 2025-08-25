"use client";

import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';

// Mock data for demonstration (will be replaced with real data)
const mockVideoData = [
  {
    thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+1",
    url: "https://placehold.co/400x400/282828/ffffff?text=Video+1",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C1",
    title: "Building an awesome app with React and Tailwind CSS",
    channel: "Dev Adventures",
    category: "tutorial",
    type: "VIDEO"
  },
  {
    // No thumbnail - will use the image itself
    url: "https://placehold.co/400x400/1a1a1a/ffffff?text=Image+Content",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C2",
    title: "10 tips for writing clean code in JavaScript",
    channel: "Code Mastery",
    category: "tutorial",
    type: "IMAGE"
  },
  {
    thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+3",
    url: "https://placehold.co/400x400/282828/ffffff?text=Video+3",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C3",
    title: "Why web components are making a comeback",
    channel: "Front-end Fun",
    category: "education",
    type: "VIDEO"
  },
  {
    // Audio file - will show audio icon
    url: "/uploads/audio-file.mp3",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C4",
    title: "A quick look at the new CSS features",
    channel: "CSS Tricks",
    category: "education",
    type: "AUDIO"
  },
  {
    thumbnailUrl: "https://placehold.co/400x400/282828/ffffff?text=Video+5",
    url: "https://placehold.co/400x400/282828/ffffff?text=Video+5",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C5",
    title: "Getting started with Next.js 14",
    channel: "NextGen Devs",
    category: "tutorial",
    type: "VIDEO"
  },
  {
    // Another image without thumbnail
    url: "https://placehold.co/400x400/333333/ffffff?text=Another+Image",
    profilePicUrl: "https://placehold.co/40x40/555555/ffffff?text=C6",
    title: "The power of Tailwind CSS without the boilerplate",
    channel: "Tailwind Tales",
    category: "tutorial",
    type: "IMAGE"
  }
];

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'music', label: 'Music' },
  { value: 'news', label: 'News' },
  { value: 'sports', label: 'Sports' }
];

export default function BrowsePage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('q', searchTerm);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.media || []);
      } else {
        setVideos([]);
      }
    };
    // debounce
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [searchTerm, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Browse Media</h1>
          <p className="text-gray-400">Discover and explore media content from creators around the world.</p>
        </div>

        {/* Filters */}
        <div className="bg-[#282828] rounded-lg shadow-lg p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search media..."
                className="w-full px-3 py-2 bg-[#1f1f1f] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1f1f] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label htmlFor="sort" className="block text-sm font-medium text-gray-300 mb-2">
                Sort By
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1f1f] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="most-views">Most Views</option>
                <option value="most-likes">Most Likes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {videos.length} {videos.length === 1 ? 'result' : 'results'} found
            </h2>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video, index) => (
              <VideoCard key={video.id || index} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No media found</h3>
            <p className="text-gray-400">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters.'
                : 'No media content available yet.'
              }
            </p>
          </div>
        )}

        {/* Load More Button */}
        {videos.length > 0 && (
          <div className="text-center mt-8">
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 