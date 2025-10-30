import React, { useState, useRef, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useSession, signOut } from 'next-auth/react';

// Define the types for the props of the Navbar component
interface NavbarProps {
    navbarBgColor: string;
    buttonTextColor: string;
    linkColor: string;
    showSearch?: boolean;
    pageTitle?: string;
}

// Main Navbar component
const Navbar = ({ navbarBgColor, buttonTextColor, linkColor, showSearch = true, pageTitle }: NavbarProps) => {
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const { data: session } = useSession();

    const handleAuthSuccess = () => {
        // Refresh the page or update user state
        window.location.reload();
    };

    const handleSignOut = async () => {
        await signOut({ redirect: false });
        window.location.reload();
    };

    // Close profile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            {/* The navbar is a fixed element at the very top. */}
            <nav className="text-gray-100 px-3 md:px-6 py-2 w-full z-30 backdrop-blur-sm bg-[#0f0f0f]/60 flex items-center justify-between relative" role="navigation" aria-label="Main navigation">
                {/* Left: Logo */}
                <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
                    <div className="font-bold text-lg md:text-2xl" style={{ color: linkColor }}>
                        MediaSite
                    </div>
                </div>
                {/* Center: Search Bar (absolute true-center; responsive size) */}
                {showSearch && (
                <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 px-3 min-w-0 w-[40rem]">
                    {/* Full search bar - desktop only */}
                    <div className="flex w-full h-9 rounded-full overflow-hidden border border-white/15 bg-white/5 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <input
                            type="search"
                            id="navbar-search"
                            name="search"
                            placeholder="Search"
                            aria-label="Search for videos, images, and audio content"
                            className="search-input w-full h-full px-4 py-0 outline-none placeholder-white/60 caret-white text-sm text-white bg-transparent"
                            style={{ color: linkColor }}
                        />
                        <button aria-label="Search" className="text-white px-4 h-full font-semibold outline-none flex items-center bg-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/30" style={{ color: linkColor }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon-hq" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
                )}
                                {!showSearch && pageTitle && (
                                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 px-2">
                                        <div className="text-lg md:text-xl font-bold text-white tracking-tight" style={{ color: linkColor }}>
                                            {pageTitle}
                                        </div>
                                    </div>
                                )}
                {/* Right: Auth Buttons */}
                <div className="flex items-center space-x-1 md:space-x-2 shrink-0" role="group" aria-label="Authentication">
                    {session ? (
                        <>
                            <button 
                                onClick={() => window.location.href = '/upload'}
                                aria-label="Upload new content"
                                className="px-2 md:px-4 py-1 md:py-1.5 rounded-full font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 bg-white/25 hover:bg-white/30 border border-white/35 text-xs md:text-sm text-white"
                            >
                                <span className="hidden md:inline">Upload</span>
                                <span className="md:hidden" aria-hidden="true">+</span>
                            </button>
                            
                            {/* Profile Picture Dropdown */}
                            <div className="relative mt-0.5" ref={profileMenuRef}>
                                <button
                                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                                    aria-label={`${session.user?.displayName || session.user?.username}'s profile menu`}
                                    aria-expanded={showProfileMenu}
                                    aria-haspopup="true"
                                    className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-600 hover:border-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <img
                                        src={session.user?.avatarUrl || `https://placehold.co/32x32/555555/ffffff?text=${(session.user?.displayName || session.user?.username || 'U').charAt(0).toUpperCase()}`}
                                        alt={`${session.user?.displayName || session.user?.username}'s avatar`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                                
                                {/* Dropdown Menu */}
                                {showProfileMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-[#282828] rounded-md shadow-lg border border-gray-600 z-50" role="menu" aria-label="Profile menu">
                                        <div className="py-1">
                                            <div className="px-4 py-2 border-b border-gray-600">
                                                <div className="text-sm font-medium text-white">{session.user?.displayName || session.user?.username}</div>
                                                <div className="text-xs text-gray-400">{session.user?.email}</div>
                                            </div>
                                            
                                            <button
                                                onClick={() => {
                                                    window.location.href = '/profile';
                                                    setShowProfileMenu(false);
                                                }}
                                                role="menuitem"
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#383838] hover:text-white focus:outline-none focus:bg-[#383838]"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                Your Uploads
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    window.location.href = '/liked-content';
                                                    setShowProfileMenu(false);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#383838] hover:text-white"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                </svg>
                                                Likes
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    window.location.href = '/history';
                                                    setShowProfileMenu(false);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#383838] hover:text-white"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                History
                                            </button>
                                            
                                            <div className="border-t border-gray-600 mt-1"></div>
                                            
                                            <button
                                                onClick={() => {
                                                    handleSignOut();
                                                    setShowProfileMenu(false);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-[#383838] hover:text-white"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setShowAuthModal(true)}
                                className="px-[18px] py-[0.44rem] rounded-full font-semibold shadow transition-colors duration-200 focus:outline-none bg-[var(--button-bg-color)] hover:bg-[#383838] text-[0.92rem]" 
                                style={{ color: buttonTextColor }}
                            >
                                Log In
                            </button>
                            <button 
                                onClick={() => window.location.href = '/auth/signup'}
                                className="px-[18px] py-[0.44rem] rounded-full font-semibold shadow transition-colors duration-200 focus:outline-none bg-[var(--button-bg-color)] hover:bg-[#383838] text-[0.92rem]" 
                                style={{ color: buttonTextColor }}
                            >
                                Sign Up
                            </button>
                        </>
                    )}
                </div>
            </nav>

            <AuthModal 
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />
        </>
    );
};

export default Navbar;