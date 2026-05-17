'use client';

import { useRouter } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';
import { DownloadLandingPage } from '@/components/landing/DownloadLandingPage';

/** Marketing home — app download landing (no waitlist flow). */
export default function AppHome() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const router = useRouter();

  return (
    <DownloadLandingPage
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
      onShowPhilosophy={() => router.push('/philosophy')}
    />
  );
}
