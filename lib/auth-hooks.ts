'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const login = async (email: string, password: string, csrfToken?: string) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        csrfToken,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  const requireAuth = (callback?: () => void) => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (callback) callback();
  };

  return {
    session,
    status,
    login,
    logout,
    requireAuth,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
  };
}

export function useRequireAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') return { loading: true };

  if (!session) {
    router.push('/auth/signin');
    return { loading: true };
  }

  return { loading: false, user: session.user };
} 