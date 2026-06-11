'use client';

import React from 'react';
import Link from 'next/link';
import { IOS_APP_URL } from '@/lib/app-download';

interface DownloadButtonsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  darkMode?: boolean;
}

const baseBadge =
  'inline-flex items-center gap-2 rounded-lg font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

const sizes = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-4 py-2.5',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
};

const labelSizes = {
  sm: { sub: 'text-[9px]', main: 'text-xs' },
  md: { sub: 'text-[9px]', main: 'text-sm' },
  lg: { sub: 'text-[10px]', main: 'text-sm' },
};

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function AppStoreBadge({
  size,
  darkMode,
}: {
  size: 'sm' | 'md' | 'lg';
  darkMode: boolean;
}) {
  const colorClass = darkMode
    ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-md shadow-blue-500/10'
    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-blue-500/15';

  const labels = labelSizes[size];

  return (
    <Link
      href={IOS_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseBadge} ${sizes[size]} ${colorClass}`}
      aria-label="Download Zoro on the App Store"
    >
      <AppleIcon className={`${iconSizes[size]} shrink-0`} />
      <span className="text-left leading-none">
        <span className={`block font-medium uppercase tracking-wide opacity-80 ${labels.sub}`}>
          Download on the
        </span>
        <span className={`block font-bold ${labels.main}`}>App Store</span>
      </span>
    </Link>
  );
}

/*
function StoreBadge Android — hidden until Play Store launch
function StoreBadge({ href, enabled, platform, size, darkMode }: ...) { ... }
*/

export function DownloadButtons({
  className = '',
  size = 'md',
  darkMode = false,
}: DownloadButtonsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
      <AppStoreBadge size={size} darkMode={darkMode} />
      {/*
      import { ANDROID_APP_URL, hasAndroidDownload } from '@/lib/app-download';
      <StoreBadge
        href={ANDROID_APP_URL}
        enabled={hasAndroidDownload}
        platform="android"
        size={size}
        darkMode={darkMode}
      />
      */}
    </div>
  );
}
