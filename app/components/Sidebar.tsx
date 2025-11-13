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

    // Keep only AI and Playlists links to avoid referencing archived pages
    const menuItems = [
        { path: '/ai', icon: (
            <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">AI</span>
            </div>
        ), label: 'AI' },
        { path: '/playlists', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
        ), label: 'Playlists' },
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