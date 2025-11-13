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
    const [modalInitialMode, setModalInitialMode] = useState<'signin' | 'signup'>('signin');
    const [modalAllowInlineToggle, setModalAllowInlineToggle] = useState(true);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const { data: session } = useSession();

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

    return (
        <>
            <nav className="text-gray-100 px-3 md:px-6 py-2 w-full z-30 backdrop-blur-sm bg-[#0f0f0f]/60 flex items-center justify-between relative" role="navigation" aria-label="Main navigation">
                <div className="flex items-center gap-4">
                    <a href="/" className="font-bold text-lg md:text-2xl">MediaSite</a>
                </div>

                <div className="flex items-center gap-3">
                    {session ? (
                        <>
                            <div className="relative" ref={profileMenuRef}>
                                <button onClick={() => setShowProfileMenu(!showProfileMenu)} aria-label="Profile menu" className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-600">
                                    <img src={session.user?.avatarUrl || `https://placehold.co/32x32/555555/ffffff?text=${(session.user?.displayName || session.user?.username || 'U').charAt(0).toUpperCase()}`} alt="avatar" className="w-full h-full object-cover" />
                                </button>

                                {showProfileMenu && (
                                    <div className="absolute right-0 mt-2 w-44 bg-[#282828] rounded-md shadow-lg border border-gray-600 z-50">
                                        <div className="px-4 py-2 border-b border-gray-600">
                                            <div className="text-sm font-medium text-white">{session.user?.displayName || session.user?.username}</div>
                                            <div className="text-xs text-gray-400">{session.user?.email}</div>
                                        </div>
                                        <button onClick={() => { window.location.href = '/profile'; setShowProfileMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/5">Profile</button>
                                        <button onClick={() => handleSignOut()} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5">Sign Out</button>
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
                                className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20"
                            >
                                Sign In
                            </button>

                            <button
                                onClick={() => {
                                    setModalInitialMode('signup');
                                    setModalAllowInlineToggle(true);
                                    setShowAuthModal(true);
                                }}
                                className="inline-flex items-center px-2 py-1 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 whitespace-nowrap"
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
                initialMode={modalInitialMode}
                allowInlineToggle={modalAllowInlineToggle}
            />
        </>
    );
};

export default Navbar;