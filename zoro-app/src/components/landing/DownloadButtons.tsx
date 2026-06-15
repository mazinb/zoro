'use client';

import React from 'react';
import Link from 'next/link';
import { IOS_APP_URL } from '@/lib/app-download';

interface DownloadButtonsProps {
  className?: string;
  badgeClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  darkMode?: boolean;
}

const badgeHeights: Record<NonNullable<DownloadButtonsProps['size']>, string> = {
  sm: 'h-10',
  md: 'h-12',
  lg: 'h-14',
  xl: 'h-16',
};

function appStoreBadgeSrc(darkMode: boolean): string {
  const variant = darkMode ? 'white' : 'black';
  return `https://tools.applemediaservices.com/api/badges/download-on-the-app-store/${variant}/en-us?size=250x83`;
}

function AppStoreBadge({
  size,
  darkMode,
  badgeClassName,
}: {
  size: NonNullable<DownloadButtonsProps['size']>;
  darkMode: boolean;
  badgeClassName?: string;
}) {
  const heightClass = badgeClassName ?? badgeHeights[size];

  return (
    <Link
      href={IOS_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      aria-label="Download Zoro on the App Store"
    >
      <img
        src={appStoreBadgeSrc(darkMode)}
        alt="Download on the App Store"
        className={`${heightClass} w-auto`}
        width={250}
        height={83}
        loading="lazy"
      />
    </Link>
  );
}

/*
function StoreBadge Android — hidden until Play Store launch
function StoreBadge({ href, enabled, platform, size, darkMode }: ...) { ... }
*/

export function DownloadButtons({
  className = '',
  badgeClassName,
  size = 'md',
  darkMode = false,
}: DownloadButtonsProps) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
      <AppStoreBadge size={size} darkMode={darkMode} badgeClassName={badgeClassName} />
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
