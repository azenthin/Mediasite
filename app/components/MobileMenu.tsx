'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    currentPath: string | null;
}

const MobileMenu = ({ isOpen, onClose, currentPath }: MobileMenuProps) => {
    const router = useRouter();

    const handleNavigate = (path: string) => {
        router.push(path);
        onClose();
    };

    // Only keep minimal navigation to avoid referencing archived pages
    const menuItems = [
        { path: '/ai', label: 'AI', icon: (
            <div className="w-6 h-6 flex items-center justify-center">
                <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">AI</span>
            </div>
        )},
        { path: '/playlists', label: 'Playlists', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
        )},
        { path: '/', label: 'Home', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        )}
    ];

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[100000] md:hidden transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            
            {/* Slide-out Menu */}
            <div 
                className={`fixed top-0 left-0 h-full w-64 bg-[#0f0f0f] z-[100001] transform transition-transform duration-300 ease-in-out md:hidden ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                role="dialog"
                aria-label="Mobile navigation menu"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-white font-bold text-xl">Menu</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2"
                        aria-label="Close menu"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Menu Items */}
                <nav className="flex flex-col py-4">
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center space-x-4 px-6 py-4 transition-colors ${
                                currentPath === item.path 
                                    ? 'bg-gray-800 text-white border-l-4 border-white' 
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                            }`}
                        >
                            {item.icon}
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </div>
        </>
    );
};

export default MobileMenu;
