'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-md w-full space-y-8 p-8" style={{ backgroundColor: '#1a1a1a' }}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: '#ffffff' }}>
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-sm" style={{ color: '#9ca3af' }}>
            Enter your email address and we&apos;ll send you a link to reset your password.
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
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: '#d1d5db' }}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none"
              style={{ 
                backgroundColor: '#1f1f1f', 
                borderColor: '#525252',
                color: '#ffffff'
              }}
              placeholder="Enter your email"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ 
                backgroundColor: isLoading ? '#374151' : '#4F46E5',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Sending...' : 'Send reset link'}
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