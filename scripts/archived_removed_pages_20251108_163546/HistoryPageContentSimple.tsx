'use client';

import React, { useState, useEffect } from 'react';

interface HistoryVideoData {
    id: string;
    title: string;
    watchProgress: number;
    watchedAt: string;
}

const HistoryPageContentSimple = () => {
    const [historyData, setHistoryData] = useState<HistoryVideoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    // Simple fetch on mount - no dependencies
    useEffect(() => {
        let mounted = true;
        
        const fetchHistory = async () => {
            try {
                console.log('📋 Fetching history (simple)...');
                const response = await fetch('/api/history?page=1&limit=24');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const text = await response.text();
                if (!text) {
                    throw new Error('Empty response');
                }
                
                const data = JSON.parse(text);
                
                if (mounted) {
                    setHistoryData(data.items || []);
                    setLoading(false);
                    console.log('✅ History loaded successfully');
                }
            } catch (err) {
                console.error('❌ History fetch error:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load');
                    setLoading(false);
                }
            }
        };

        fetchHistory();
        
        return () => {
            mounted = false;
        };
    }, []); // No dependencies

    // Selection functions
    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const toggleDateSelection = (dateVideos: HistoryVideoData[]) => {
        const dateIds = dateVideos.map(v => v.id);
        const allSelected = dateIds.every(id => selectedItems.has(id));
        
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (allSelected) {
                // Deselect all from this date
                dateIds.forEach(id => newSet.delete(id));
            } else {
                // Select all from this date
                dateIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedItems(new Set(historyData.map(item => item.id)));
    };

    const deselectAll = () => {
        setSelectedItems(new Set());
    };

    // Delete functions
    const deleteSelected = async () => {
        if (selectedItems.size === 0) return;
        
        setDeleting(true);
        try {
            const response = await fetch('/api/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaIds: Array.from(selectedItems) }),
            });

            if (response.ok) {
                // Remove deleted items from local state
                setHistoryData(prev => prev.filter(item => !selectedItems.has(item.id)));
                setSelectedItems(new Set());
            } else {
                throw new Error('Failed to delete items');
            }
        } catch (err) {
            console.error('Delete error:', err);
            setError('Failed to delete selected items');
        } finally {
            setDeleting(false);
        }
    };

    const clearAllData = async () => {
        if (!confirm('Are you sure you want to clear all browsing data? This cannot be undone.')) {
            return;
        }

        setDeleting(true);
        try {
            const response = await fetch('/api/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clearAll: true }),
            });

            if (response.ok) {
                setHistoryData([]);
                setSelectedItems(new Set());
            } else {
                throw new Error('Failed to clear all data');
            }
        } catch (err) {
            console.error('Clear all error:', err);
            setError('Failed to clear browsing data');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-gray-400">
                    Loading your watch history...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-red-500">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (historyData.length === 0) {
        return (
            <div className="flex-1 p-6">
                <h1 className="text-3xl font-bold text-white mb-6">Watch History</h1>
                <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">📺</div>
                    <h2 className="text-xl font-semibold mb-2">No watch history yet</h2>
                    <p>Start watching some videos to see them here!</p>
                </div>
            </div>
        );
    }

    // Group history by date like Chrome
    const groupedHistory = historyData.reduce((groups: { [key: string]: HistoryVideoData[] }, video) => {
        const date = new Date(video.watchedAt);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateKey: string;
        if (date.toDateString() === today.toDateString()) {
            dateKey = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateKey = 'Yesterday';
        } else {
            dateKey = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
            });
        }
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(video);
        return groups;
    }, {});

    return (
        <div className="flex-1 bg-[#0f0f0f] min-h-screen">
            {/* Header matching site theme */}
            <div className="bg-[#282828] border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-2xl font-normal text-white">History</h1>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>•</span>
                            <span>{historyData.length} items</span>
                        </div>
                    </div>
                    
                    {/* Search and clear buttons with site theme */}
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search history" 
                                className="bg-[#444444] text-white placeholder-gray-400 px-4 py-2 pr-10 rounded-full text-sm border border-gray-600 focus:border-white focus:outline-none w-64"
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                        <button 
                            onClick={clearAllData}
                            disabled={deleting}
                            className="text-white hover:text-gray-300 text-sm font-medium px-3 py-2 hover:bg-[#444444] rounded disabled:opacity-50"
                        >
                            {deleting ? 'Clearing...' : 'Clear browsing data'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Selection controls */}
            {historyData.length > 0 && (
                <div className="bg-[#1a1a1a] border-b border-gray-700 px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-400">
                                {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select items to delete'}
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={selectAll}
                                    className="text-white hover:text-gray-300 text-xs px-2 py-1 hover:bg-[#444444] rounded"
                                >
                                    Select all
                                </button>
                                {selectedItems.size > 0 && (
                                    <button
                                        onClick={deselectAll}
                                        className="text-white hover:text-gray-300 text-xs px-2 py-1 hover:bg-[#444444] rounded"
                                    >
                                        Deselect all
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {selectedItems.size > 0 && (
                            <button
                                onClick={deleteSelected}
                                disabled={deleting}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50 flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>{deleting ? 'Deleting...' : 'Delete selected'}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Chrome-style content */}
            <div className="px-6 py-6">
                {Object.entries(groupedHistory).map(([dateKey, videos]) => (
                    <div key={dateKey} className="mb-8">
                        {/* Date header with selection */}
                        <div className="flex items-center mb-4">
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => toggleDateSelection(videos)}
                                    className="text-xs text-gray-400 hover:text-white px-2 py-1 hover:bg-[#444444] rounded"
                                >
                                    {videos.every(v => selectedItems.has(v.id)) ? 'Deselect all' : 'Select all'}
                                </button>
                                <h2 className="text-lg font-medium text-white">{dateKey}</h2>
                            </div>
                            <div className="flex-1 h-px bg-gray-700 ml-4"></div>
                        </div>
                        
                        {/* Site-themed list */}
                        <div className="space-y-1">
                            {videos.map((video, index) => (
                                <div key={video.id} className={`group rounded-lg p-3 flex items-center space-x-4 transition-colors ${selectedItems.has(video.id) ? 'bg-[#444444]' : 'hover:bg-[#282828]'}`}>
                                    {/* Functional checkbox */}
                                    <div className={`transition-opacity ${selectedItems.size > 0 || selectedItems.has(video.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItems.has(video.id)}
                                            onChange={() => toggleItemSelection(video.id)}
                                            className="w-4 h-4 text-white bg-[#444444] border-gray-600 rounded focus:ring-white cursor-pointer" 
                                        />
                                    </div>
                                    
                                    {/* History icon */}
                                    <div className="w-6 h-6 bg-[#444444] rounded-sm flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            {/* Clock/history icon */}
                                            <circle cx="12" cy="12" r="9"/>
                                            <path d="M12 7v5l3 3"/>
                                        </svg>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-white hover:text-gray-300 font-normal text-sm truncate">
                                                {video.title}
                                            </h3>
                                            {video.watchProgress >= 0.95 && (
                                                <span className="text-gray-300 text-xs">✓</span>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-xs mt-1">
                                            mediasite.local • {new Date(video.watchedAt).toLocaleTimeString('en-US', { 
                                                hour: 'numeric', 
                                                minute: '2-digit', 
                                                hour12: true 
                                            })}
                                            {video.watchProgress > 0 && video.watchProgress < 0.95 && (
                                                <span className="ml-2">• {Math.round(video.watchProgress * 100)}% watched</span>
                                            )}
                                        </p>
                                    </div>
                                    
                                    {/* Site-themed actions */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                                        <button className="p-1 hover:bg-[#444444] rounded text-gray-400 hover:text-white">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                            </svg>
                                        </button>
                                        <button className="p-1 hover:bg-[#444444] rounded text-gray-400 hover:text-white">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {/* Empty state with site theme */}
                {historyData.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 bg-[#444444] rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl text-white font-normal mb-2">No history found</h2>
                        <p className="text-gray-400 text-sm">
                            Your browsing history appears here
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPageContentSimple;
