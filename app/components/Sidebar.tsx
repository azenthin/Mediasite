import React from 'react';

interface SidebarProps {
    onNavigate: (newPath: string) => void;
    currentPath: string;
    sidebarBgColor: string;
    linkColor: string;
}

const Sidebar = ({ onNavigate, currentPath, sidebarBgColor, linkColor }: SidebarProps) => {
    const handleLinkClick = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        onNavigate(path);
    };

    // Redefine menu items to reflect the new navigation structure
    const menuItems = [
        { path: '/', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ), label: 'Home' },
        { path: '/recommended', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
        ), label: 'Recommended' },
        { path: '/subscriptions', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        ), label: 'Subscriptions' },
        { path: '/music', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v14M9 19c0 1.105-1.79 2-4 2s-4-.895-4-2 1.79-2 4-2 4 .895 4 2zm12-3c0 1.105-1.79 2-4 2s-4-.895-4-2 1.79-2 4-2 4 .895 4 2zM9 10l12-3" />
            </svg>
        ), label: 'Music' },
        { path: '/history', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ), label: 'History' },
        { path: '/playlists', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
        ), label: 'Playlists' },
        { path: '/liked-content', icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
        ), label: 'Likes' },
        { path: '/ai', icon: (
            <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">AI</span>
            </div>
        ), label: 'AI' },
    ];

    return (
        <div
            style={{ backgroundColor: sidebarBgColor }}
            className="flex-shrink-0 w-16 h-[calc(100vh-56px)] px-2 py-3 flex flex-col items-center space-y-3 shadow-lg z-20 sticky top-14"
        >
            {menuItems.map((item) => (
                <a
                    key={item.path}
                    href={item.path}
                    onClick={(e) => handleLinkClick(e, item.path)}
                    className={`group relative flex flex-col items-center p-2.5 rounded-full transition-colors duration-200 active:bg-[#1f1f1f] focus:outline-none
                        ${currentPath === item.path
                            ? 'bg-[var(--light-up-color)] text-white'
                            : 'hover:bg-[#2a2a2a] text-white'}`
                    }
                    style={{ color: linkColor }}
                    title={item.label}
                >
                    <span className="icon-hq">
                        {item.icon}
                    </span>
                    {/* Tooltip-like label for the icons */}
                    <span className="absolute left-full ml-4 w-auto p-2 bg-[#383838] text-white text-sm rounded-md scale-0 transition-transform duration-200 group-hover:scale-100 origin-left">
                        {item.label}
                    </span>
                </a>
            ))}
        </div>
    );
};

export default Sidebar;