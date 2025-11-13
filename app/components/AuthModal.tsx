import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrf';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialMode?: 'signin' | 'signup';
    allowInlineToggle?: boolean;
}

const AuthModal = ({ isOpen, onClose, onSuccess, initialMode = 'signin', allowInlineToggle = true }: AuthModalProps) => {
    const [isSignup, setIsSignup] = useState(initialMode === 'signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const [csrfToken, setCsrfToken] = useState('');
    const [signupForm, setSignupForm] = useState({ email: '', username: '', password: '', displayName: '' });

    const handleOAuthSignIn = async (provider: 'google' | 'github') => {
        setLoading(true);
        setError('');

        try {
            const result = await signIn(provider, {
                callbackUrl: '/',
                redirect: false,
            });

            if (result?.error) {
                setError(`Failed to sign in with ${provider}`);
                setLoading(false);
            } else if (result?.ok) {
                onSuccess();
                onClose();
                router.refresh();
            }
        } catch (err) {
            setError(`Failed to sign in with ${provider}`);
            setLoading(false);
        }
    };

    // reuse OAuth for signup too
    const handleOAuthSignUp = handleOAuthSignIn;

    useEffect(() => {
        setIsSignup(initialMode === 'signup');
    }, [initialMode]);

    useEffect(() => {
        try {
            setCsrfToken(getCSRFToken());
        } catch (e) {
            // noop
        }
    }, []);

    const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...signupForm, csrfToken }),
            });

            const data = await response.json();

            if (response.ok) {
                onClose();
                router.push('/auth/signin?message=Account created successfully! Please sign in.');
            } else {
                setError(data.error || 'Signup failed');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }

        setLoading(false);
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
                setLoading(false);
            } else if (result?.ok) {
                onSuccess();
                onClose();
                router.refresh();
            }
        } catch (err) {
            setError('Failed to sign in');
            setLoading(false);
        }
    };

    const handleSignupRedirect = () => {
        if (allowInlineToggle) {
            setIsSignup(true);
            return;
        }

        onClose();
        router.push('/auth/signup');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white">{isSignup ? 'Create Account' : 'Sign In'}</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
                </div>

                <div className="space-y-4">
                    {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>}

                    {/* OAuth buttons shown for both sign in and sign up */}
                    <div className="space-y-3">
                        <button onClick={() => (isSignup ? handleOAuthSignUp('google') : handleOAuthSignIn('google'))} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 font-semibold rounded-xl transition-all duration-200">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        <button onClick={() => (isSignup ? handleOAuthSignUp('github') : handleOAuthSignIn('github'))} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/10 border border-white/20 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 font-semibold rounded-xl transition-all duration-200">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            Continue with GitHub
                        </button>
                    </div>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-[#1a1a1a] text-white/60">{isSignup ? 'Or create an account with email' : 'Or sign in with email'}</span>
                        </div>
                    </div>

                    {!isSignup ? (
                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="your@email.com" required disabled={loading} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="••••••••" required disabled={loading} />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 font-semibold py-3 px-4 rounded-xl transition-all duration-200">{loading ? 'Signing in...' : 'Sign In'}</button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignupSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Email address</label>
                                <input type="email" name="email" required value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="Enter your email" disabled={loading} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Username</label>
                                <input type="text" name="username" required minLength={3} value={signupForm.username} onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="Choose a username" disabled={loading} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
                                <input type="password" name="password" required minLength={6} value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="Create a password" disabled={loading} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">Display Name (Optional)</label>
                                <input type="text" name="displayName" value={signupForm.displayName} onChange={(e) => setSignupForm({ ...signupForm, displayName: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all" placeholder="Your display name (optional)" disabled={loading} />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 font-semibold py-3 px-4 rounded-xl transition-all duration-200">{loading ? 'Creating account...' : 'Create account'}</button>
                        </form>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <button onClick={() => (isSignup ? setIsSignup(false) : handleSignupRedirect())} className="text-white/60 hover:text-white text-sm transition-colors">
                        {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;