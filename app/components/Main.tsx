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
                <div className="sticky top-0 z-30">
                  <Navbar
                    navbarBgColor={colors.navbarBgColor}
                    buttonTextColor={colors.buttonTextColor}
                    linkColor={colors.linkColor}
                  />
                </div>

                <div className="flex flex-1">
                    {/* Fixed left rail */}
                    <div className="fixed left-0 top-14 z-20 w-16 h-screen">
                      <Sidebar
                        onNavigate={handleNavigate}
                        currentPath={pathname}
                        sidebarBgColor={colors.sidebarBgColor}
                        linkColor={colors.linkColor}
                      />
                    </div>

                    {/* Content area with left margin to avoid overlap */}
                    <div className="flex-1 ml-16 overflow-x-hidden">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default App;
