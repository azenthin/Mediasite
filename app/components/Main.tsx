'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileMenu from './MobileMenu';

interface AppProps {
  children: React.ReactNode;
}

// Main App component
const App = ({ children }: AppProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Move colors outside component to prevent re-creation
    const colors = useMemo(() => ({
        siteBgColor: '#141414',
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
                        <div className="flex flex-col min-h-screen h-auto pt-14" style={{ backgroundColor: colors.siteBgColor }}>
                                <div className="fixed top-0 left-0 right-0 z-30 md:block" id="navbar-container">
                                                        <Navbar
                    navbarBgColor={colors.navbarBgColor}
                    buttonTextColor={colors.buttonTextColor}
                                        linkColor={colors.linkColor}
                                                            showSearch={!pathname?.startsWith('/ai')}
                                                            pageTitle={pathname?.startsWith('/ai') ? 'AI Playlist Generator' : undefined}
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
                    <div 
                        id="main-content" 
                        className="flex-1 md:ml-16 overflow-x-hidden pb-16 md:pb-0"
                        role="main"
                        aria-label="Main content"
                    >
                        {children}
                    </div>
                </div>
                
                {/* Mobile Menu - slide from left */}
                <MobileMenu 
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                    currentPath={pathname}
                />
                
                {/* Mobile Bottom Navigation - Only burger button (hidden on AI page) */}
                {!pathname?.startsWith('/ai') && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-sm border-t border-gray-800">
                    <div className="flex items-center justify-center py-3">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="flex flex-col items-center p-2 text-gray-400 hover:text-white transition-colors"
                            aria-label="Open menu"
                        >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span className="text-xs mt-1">Menu</span>
                        </button>
                    </div>
                </div>
                )}
            </div>
        </>
    );
};

export default App;
