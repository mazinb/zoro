'use client';

import Link from 'next/link';
import {
  ANDROID_APP_URL,
  hasAndroidDownload,
  hasIosDownload,
  IOS_APP_URL,
} from '@/lib/app-download';

interface DownloadButtonsProps {
  className?: string;
  size?: 'md' | 'lg';
}

const baseBadge =
  'inline-flex items-center gap-3 rounded-xl font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

const sizes = {
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function StoreBadge({
  href,
  enabled,
  platform,
  size,
  darkMode,
}: {
  href: string;
  enabled: boolean;
  platform: 'ios' | 'android';
  size: 'md' | 'lg';
  darkMode: boolean;
}) {
  const label = platform === 'ios' ? 'Download on the App Store' : 'Get it on Google Play';
  const sub = platform === 'ios' ? 'App Store' : 'Google Play';
  const colorClass = enabled
    ? darkMode
      ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-blue-500/10'
      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-blue-500/20'
    : darkMode
      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
      : 'bg-slate-200 text-slate-500 cursor-not-allowed';

  const content = (
    <>
      {platform === 'ios' ? (
        <AppleIcon className="w-7 h-7 shrink-0" />
      ) : (
        <img
          src="/images/google-play.png"
          alt=""
          width={28}
          height={28}
          className={`w-7 h-7 shrink-0 object-contain ${enabled ? '' : 'opacity-50'}`}
        />
      )}
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-medium uppercase tracking-wide opacity-80">
          {enabled ? (platform === 'ios' ? 'Download on the' : 'Get it on') : 'Coming soon on'}
        </span>
        <span className="block text-base font-bold">{sub}</span>
      </span>
    </>
  );

  if (!enabled) {
    return (
      <span
        className={`${baseBadge} ${sizes[size]} ${colorClass}`}
        aria-label={`${label}, coming soon`}
        title="Set NEXT_PUBLIC_IOS_APP_URL or NEXT_PUBLIC_ANDROID_APP_URL"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseBadge} ${sizes[size]} ${colorClass}`}
      aria-label={label}
    >
      {content}
    </Link>
  );
}

export function DownloadButtons({
  className = '',
  size = 'lg',
  darkMode = false,
}: DownloadButtonsProps & { darkMode?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
      <StoreBadge
        href={IOS_APP_URL}
        enabled={hasIosDownload}
        platform="ios"
        size={size}
        darkMode={darkMode}
      />
      <StoreBadge
        href={ANDROID_APP_URL}
        enabled={hasAndroidDownload}
        platform="android"
        size={size}
        darkMode={darkMode}
      />
    </div>
  );
}
