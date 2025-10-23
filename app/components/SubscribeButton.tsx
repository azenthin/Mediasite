'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SubscribeButtonProps {
  userId: string;
  username?: string;
  onSubscribeChange?: (subscribed: boolean) => void;
  variant?: 'default' | 'large' | 'compact';
  className?: string;
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  userId,
  username,
  onSubscribeChange,
  variant = 'default',
  className = ''
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!session?.user?.id) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`/api/subscriptions/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setSubscribed(data.subscribed);
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkSubscriptionStatus();
  }, [userId, session?.user?.id]);

  const handleSubscribe = async () => {
    if (!session?.user?.id) {
      router.push('/auth/signin');
      return;
    }

    if (loading) return;

    setLoading(true);
    const previousState = subscribed;
    const newState = !subscribed;

    // Optimistic update
    setSubscribed(newState);
    onSubscribeChange?.(newState);

    try {
      const response = await fetch(`/api/subscriptions/${userId}`, {
        method: newState ? 'POST' : 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      const data = await response.json();
      setSubscribed(data.subscribed);
      onSubscribeChange?.(data.subscribed);

    } catch (error) {
      console.error('Failed to update subscription:', error);
      // Revert on error
      setSubscribed(previousState);
      onSubscribeChange?.(previousState);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null;
  }

  // Don't show if it's the current user's own profile
  if (session?.user?.id === userId) {
    return null;
  }

  const baseClasses = 'transition-all duration-200 font-medium flex items-center justify-center gap-2';
  
  const variantClasses = {
    default: 'px-4 py-2 rounded-full text-sm',
    large: 'px-6 py-3 rounded-full text-base',
    compact: 'px-3 py-1.5 rounded-md text-xs'
  };

  const stateClasses = subscribed
    ? 'bg-gray-700 text-white hover:bg-gray-600'
    : 'bg-red-600 text-white hover:bg-red-700';

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className={`${baseClasses} ${variantClasses[variant]} ${stateClasses} ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{subscribed ? 'Unsubscribing...' : 'Subscribing...'}</span>
        </>
      ) : (
        <>
          {subscribed ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Subscribed</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Subscribe</span>
            </>
          )}
        </>
      )}
    </button>
  );
};

export default SubscribeButton;
