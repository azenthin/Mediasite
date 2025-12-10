import React, { useState, useRef, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

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
    const [modalInitialMode, setModalInitialMode] = useState<'signin' | 'signup'>('signin');
    const [modalAllowInlineToggle, setModalAllowInlineToggle] = useState(true);
    const [isNavHidden, setIsNavHidden] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const { data: session } = useSession();
    const pathname = usePathname();
    const navLinks = [
        { label: 'AI', href: '/ai' },
        { label: 'Playlists', href: '/playlists' }
    ];

    const handleAuthSuccess = () => {
        // Refresh the page or update user state
        window.location.reload();
    };

    const handleSignOut = async () => {
        // Close profile menu first to avoid UI jank while signing out
        setShowProfileMenu(false);
        try {
            await signOut({ redirect: false });
        } catch (err) {
            // still reload to clear client state
            console.error('signOut error', err);
        }
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

    // Fade navbar when scrolling down, show when scrolling up or near top
    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            const previousY = lastScrollY.current;
            const scrollingDown = currentY > previousY + 8;
            const scrollingUp = currentY < previousY - 8;

            if (scrollingDown && currentY > 80) {
                setIsNavHidden(true);
            } else if (scrollingUp || currentY <= 80) {
                setIsNavHidden(false);
            }

            lastScrollY.current = currentY;
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav
                className={`text-gray-100 px-3 md:px-8 py-4 w-full z-30 transition-all duration-500 ease-out ${isNavHidden ? 'opacity-0 -translate-y-6 pointer-events-none' : 'opacity-100 translate-y-0'}`}
                role="navigation"
                aria-label="Main navigation"
            >
                <div className="mx-auto max-w-6xl rounded-full border border-white/10 bg-white/5 backdrop-blur-3xl px-4 md:px-6 py-3 flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <a href="/" className="font-semibold text-lg tracking-tight text-white">MediaSite</a>
                        {pageTitle && (
                            <span className="hidden md:inline-flex text-xs uppercase tracking-[0.3em] text-white/50">{pageTitle}</span>
                        )}
                    </div>

                    <div className="flex-1 flex justify-center">
                        <div className="flex items-center gap-2 px-3 py-1.5">
                            {navLinks.map((link) => {
                                const active = pathname === link.href;
                                return (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                            active
                                                ? 'text-white'
                                                : 'text-white/60 hover:text-white'
                                        }`}
                                    >
                                        {link.label}
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-1 justify-end">
                    {session ? (
                        <>
                            <div className="relative" ref={profileMenuRef}>
                                <button
                                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                                    aria-label="Profile menu"
                                    className="w-9 h-9 rounded-full overflow-hidden border border-white/20"
                                >
                                    <img
                                        src={session.user?.avatarUrl || `https://placehold.co/36x36/373737/ffffff?text=${(session.user?.displayName || session.user?.username || 'U').charAt(0).toUpperCase()}`}
                                        alt="avatar"
                                        className="w-full h-full object-cover"
                                    />
                                </button>

                                {showProfileMenu && (
                                    <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-white/10 bg-[#0f0f0f]/95 shadow-2xl z-50">
                                        <div className="px-4 py-3 border-b border-white/10">
                                            <div className="text-sm font-medium text-white">
                                                {session.user?.displayName || session.user?.username}
                                            </div>
                                            <div className="text-xs text-white/50">{session.user?.email}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                window.location.href = '/profile';
                                                setShowProfileMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/5"
                                        >
                                            Profile
                                        </button>
                                        <button
                                            onClick={() => handleSignOut()}
                                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setModalInitialMode('signin');
                                    setModalAllowInlineToggle(true);
                                    setShowAuthModal(true);
                                }}
                                className="px-4 py-1.5 rounded-full text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                Sign In
                            </button>

                            <button
                                onClick={() => {
                                    setModalInitialMode('signup');
                                    setModalAllowInlineToggle(true);
                                    setShowAuthModal(true);
                                }}
                                className="inline-flex items-center px-5 py-1.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90 whitespace-nowrap"
                            >
                                Sign Up
                            </button>
                        </>
                    )}
                    </div>
                </div>
            </nav>

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
                initialMode={modalInitialMode}
                allowInlineToggle={modalAllowInlineToggle}
            />
        </>
    );
};

export default Navbar;