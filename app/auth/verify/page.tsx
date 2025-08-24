'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Network error. Please try again.');
      }
    };

    verifyEmail();
  }, [token]);

  const handleSignIn = () => {
    router.push('/auth/signin');
  };

  const handleResendEmail = async () => {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'user@example.com' }), // TODO: Get email from token or session
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f0f0fff' }}>
      <div className="max-w-md w-full space-y-8 p-8 rounded-lg shadow-lg border" style={{ backgroundColor: '#1a1a1a', borderColor: '#404040' }}>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: '#ffffff' }}>
            Email Verification
          </h2>
        </div>

        <div className="mt-8 space-y-6">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#dc2626' }}></div>
              <p className="mt-4" style={{ color: '#d1d5db' }}>Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#16a34a' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium" style={{ color: '#ffffff' }}>Verification Successful!</h3>
              <p className="mt-2" style={{ color: '#d1d5db' }}>{message}</p>
              <div className="mt-6">
                <button
                  onClick={handleSignIn}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium"
                  style={{ 
                    backgroundColor: '#dc2626', 
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" style={{ backgroundColor: '#fef2f2' }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#dc2626' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium" style={{ color: '#ffffff' }}>Verification Failed</h3>
              <p className="mt-2" style={{ color: '#d1d5db' }}>{message}</p>
              {error && (
                <p className="mt-2 text-sm" style={{ color: '#dc2626' }}>{error}</p>
              )}
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleResendEmail}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium"
                  style={{ 
                    backgroundColor: '#dc2626', 
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  Resend Verification Email
                </button>
                <button
                  onClick={handleSignIn}
                  className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium"
                  style={{ 
                    backgroundColor: '#1f1f1f', 
                    borderColor: '#525252',
                    color: '#d1d5db'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 