 'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PhilosophyPage } from '@/components/landing/PhilosophyPage';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function PhilosophyRoutePage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const router = useRouter();

  return (
    <PhilosophyPage
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
      onBack={() => router.push('/')}
    />
  );
}

