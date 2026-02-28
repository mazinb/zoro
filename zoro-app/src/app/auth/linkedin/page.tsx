'use client';

import { useEffect } from 'react';

/**
 * /auth/linkedin — redirects to LinkedIn OAuth.
 */
export default function LinkedInAuthPage() {
  useEffect(() => {
    window.location.href = '/api/linkedin/auth';
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <p className="text-zinc-600">Redirecting to LinkedIn…</p>
    </div>
  );
}
