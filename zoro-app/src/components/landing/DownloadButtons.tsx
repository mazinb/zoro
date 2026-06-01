'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { TESTFLIGHT_URL } from '@/lib/app-download';

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

function TestFlightBadge({
  size,
  darkMode,
  onDesktopClick,
}: {
  size: 'sm' | 'md' | 'lg';
  darkMode: boolean;
  onDesktopClick: () => void;
}) {
  const [useDirectLink, setUseDirectLink] = useState(true);

  useEffect(() => {
    const touch = window.matchMedia('(hover: none) and (pointer: coarse)');
    const narrow = window.matchMedia('(max-width: 767px)');

    const update = () => {
      setUseDirectLink(touch.matches || narrow.matches);
    };

    update();
    touch.addEventListener('change', update);
    narrow.addEventListener('change', update);
    return () => {
      touch.removeEventListener('change', update);
      narrow.removeEventListener('change', update);
    };
  }, []);

  const colorClass = darkMode
    ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-md shadow-blue-500/10'
    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-blue-500/15';

  const labels = labelSizes[size];

  const content = (
    <>
      <AppleIcon className={`${iconSizes[size]} shrink-0`} />
      <span className="text-left leading-none">
        <span className={`block font-medium uppercase tracking-wide opacity-80 ${labels.sub}`}>
          Join the beta on
        </span>
        <span className={`block font-bold ${labels.main}`}>TestFlight</span>
      </span>
    </>
  );

  if (useDirectLink) {
    return (
      <Link
        href={TESTFLIGHT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseBadge} ${sizes[size]} ${colorClass}`}
        aria-label="Join the Zoro beta on TestFlight"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onDesktopClick}
      className={`${baseBadge} ${sizes[size]} ${colorClass}`}
      aria-label="Show TestFlight QR code for iOS beta"
    >
      {content}
    </button>
  );
}

function TestFlightQrModal({
  open,
  onClose,
  darkMode,
}: {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl p-6 shadow-2xl ${
          darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="testflight-qr-title"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 opacity-70 hover:opacity-100"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 id="testflight-qr-title" className="text-lg font-bold mb-1 pr-8">
          Join the iOS beta
        </h3>
        <p className={`text-sm mb-5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          Scan with your iPhone camera to open TestFlight.
        </p>

        <div className="flex justify-center mb-5">
          <Image
            src="/images/testflight-qr.png"
            alt="QR code for TestFlight beta"
            width={240}
            height={240}
            className="rounded-lg border border-slate-200"
          />
        </div>

        <Link
          href={TESTFLIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Or open the TestFlight link
        </Link>
      </div>
    </div>
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
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <>
      <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
        <TestFlightBadge
          size={size}
          darkMode={darkMode}
          onDesktopClick={() => setQrOpen(true)}
        />
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
      <TestFlightQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        darkMode={darkMode}
      />
    </>
  );
}
