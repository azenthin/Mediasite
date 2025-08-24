'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('No reset token provided.');
      return;
    }

    // TODO: Validate token with API
    setIsValidToken(true);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-md w-full space-y-8 p-8" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="text-center">
            <h2 className="text-2xl font-bold" style={{ color: '#dc2626' }}>Invalid Reset Link</h2>
            <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
              This password reset link is invalid or has expired.
            </p>
            <Link 
              href="/auth/forgot-password"
              className="mt-4 inline-block text-sm hover:underline"
              style={{ color: '#4F46E5' }}
            >
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-md w-full space-y-8 p-8" style={{ backgroundColor: '#1a1a1a' }}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: '#ffffff' }}>
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm" style={{ color: '#9ca3af' }}>
            Enter your new password below.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 rounded-md text-sm" style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-3 rounded-md text-sm" style={{ backgroundColor: '#059669', color: '#ffffff' }}>
              {message}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#d1d5db' }}>
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none"
                style={{ 
                  backgroundColor: '#1f1f1f', 
                  borderColor: '#525252',
                  color: '#ffffff'
                }}
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium" style={{ color: '#d1d5db' }}>
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none"
                style={{ 
                  backgroundColor: '#1f1f1f', 
                  borderColor: '#525252',
                  color: '#ffffff'
                }}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !isValidToken}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ 
                backgroundColor: (isLoading || !isValidToken) ? '#374151' : '#4F46E5',
                cursor: (isLoading || !isValidToken) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Resetting...' : 'Reset password'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/auth/signin"
              className="text-sm hover:underline"
              style={{ color: '#4F46E5' }}
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 