"use client";

import { useRouter } from 'next/navigation';
import AuthModal from '@/app/components/AuthModal';

export default function SignUpPage() {
  const router = useRouter();

  const handleClose = () => {
    // when closing the direct /auth/signup page, send user to home
    router.push('/');
  };

  return (
    // Render the same modal used for Sign In but open in signup mode.
    <AuthModal isOpen={true} onClose={handleClose} onSuccess={() => router.push('/')} initialMode="signup" allowInlineToggle={false} />
  );
}