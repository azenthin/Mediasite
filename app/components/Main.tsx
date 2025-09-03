'use client';

import React, { useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface AppProps {
  children: React.ReactNode;
}

// Main App component
const App = ({ children }: AppProps) => {
    const router = useRouter();
    const pathname = usePathname();

    // Move colors outside component to prevent re-creation
    const colors = useMemo(() => ({
        siteBgColor: '#0f0f0fff',
        navbarBgColor: 'transparent',
        sidebarBgColor: '#0f0f0fff',
        buttonBgColor: '#282828',
        lightUpColor: '#444444',
        buttonTextColor: '#ffffff',
        linkColor: '#ffffff'
    }), []);

    const handleNavigate = useCallback((newPath: string) => {
        router.push(newPath);
    }, [router]);

    return (
        <>
            <div className="flex flex-col min-h-screen h-auto" style={{ backgroundColor: colors.siteBgColor }}>
                <div className="sticky top-0 z-30 md:block" id="navbar-container">
                  <Navbar
                    navbarBgColor={colors.navbarBgColor}
                    buttonTextColor={colors.buttonTextColor}
                    linkColor={colors.linkColor}
                  />
                </div>

                <div className="flex flex-1">
                    {/* Fixed left rail - hidden on mobile */}
                    <div className="hidden md:block fixed left-0 top-14 z-20 w-16 h-screen">
                      <Sidebar
                        onNavigate={handleNavigate}
                        currentPath={pathname}
                        sidebarBgColor={colors.sidebarBgColor}
                        linkColor={colors.linkColor}
                      />
                    </div>

                    {/* Content area with left margin to avoid overlap on desktop */}
                    <div className="flex-1 md:ml-16 overflow-x-hidden pb-16 md:pb-0">
                        {children}
                    </div>
                </div>
                
                {/* Mobile Bottom Navigation - only visible on mobile */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-sm border-t border-gray-800">
                    <div className="flex items-center justify-around py-2">
                        <button 
                            onClick={() => handleNavigate('/')}
                            className={`flex flex-col items-center p-2 ${pathname === '/' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                            <span className="text-xs mt-1">Home</span>
                        </button>
                        
                        <button 
                            onClick={() => handleNavigate('/browse')}
                            className={`flex flex-col items-center p-2 ${pathname === '/browse' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs mt-1">Browse</span>
                        </button>
                        
                        <button 
                            onClick={() => handleNavigate('/recommended')}
                            className={`flex flex-col items-center p-2 ${pathname === '/recommended' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs mt-1">Shorts</span>
                        </button>
                        
                        <button 
                            onClick={() => handleNavigate('/liked-content')}
                            className={`flex flex-col items-center p-2 ${pathname === '/liked-content' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs mt-1">Liked</span>
                        </button>
                        
                        <button 
                            onClick={() => handleNavigate('/profile')}
                            className={`flex flex-col items-center p-2 ${pathname === '/profile' ? 'text-white' : 'text-gray-400'}`}
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs mt-1">Profile</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default App;
