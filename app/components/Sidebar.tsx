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
        {
            path: '/ai',
            icon: (
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#53ffe2] via-[#25a0ff] to-[#8749ff] flex items-center justify-center shadow-lg shadow-[#25a0ff]/30">
                    <span className="text-xs font-bold tracking-[0.2em] text-black">AI</span>
                </div>
            ),
            label: 'AI',
        },
        {
            path: '/playlists',
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M5 7h14M5 12h9m-9 5h14"
                    />
                </svg>
            ),
            label: 'Playlists',
        },
    ];

    return (
        <div
            className="flex-shrink-0 w-24 h-[calc(100vh-160px)] px-4 py-6 flex flex-col justify-between rounded-[32px] border border-white/10 bg-[rgba(8,8,8,0.9)] backdrop-blur-2xl shadow-[0_35px_90px_rgba(0,0,0,0.75)]"
            style={{ backgroundColor: sidebarBgColor }}
        >
            <div className="flex flex-col items-center space-y-4">
                {menuItems.map((item) => (
                    <a
                        key={item.path}
                        href={item.path}
                        onClick={(e) => handleLinkClick(e, item.path)}
                        className={`group relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all duration-200 focus:outline-none ${
                            currentPath === item.path
                                ? 'bg-gradient-to-br from-[#53ffe2]/20 via-[#25a0ff]/10 to-transparent text-white shadow-lg shadow-[#25a0ff]/20 scale-[1.05]'
                                : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                        style={{ color: linkColor }}
                        aria-current={currentPath === item.path ? 'page' : undefined}
                        title={item.label}
                    >
                        <span className="icon-hq">
                            {item.icon}
                        </span>
                        <span className="absolute left-full ml-4 w-auto px-3 py-1 bg-[#111111] text-white text-xs rounded-full scale-0 transition-transform duration-200 group-hover:scale-100 origin-left border border-white/10 shadow-lg">
                            {item.label}
                        </span>
                    </a>
                ))}
            </div>
            <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5" />
        </div>
    );
};

export default Sidebar;