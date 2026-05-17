'use client';

import Image from 'next/image';
import { useState } from 'react';

interface PhoneFrameProps {
  videoSrc?: string;
  posterSrc?: string;
  className?: string;
}

/**
 * Device frame with soft glow — drop a screen recording into `videoSrc`
 * or place `public/videos/demo.mp4` (see NEXT_PUBLIC_APP_DEMO_VIDEO).
 */
export function PhoneFrame({
  videoSrc,
  posterSrc = '/images/app/hero.png',
  className = '',
}: PhoneFrameProps) {
  const [videoMissing, setVideoMissing] = useState(false);
  const showVideo = Boolean(videoSrc) && !videoMissing;

  return (
    <div className={`relative mx-auto w-full max-w-[280px] sm:max-w-[320px] ${className}`}>
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-blue-500/25 blur-3xl"
        aria-hidden
      />
      <div className="relative rounded-[2.75rem] border-[10px] border-white/95 bg-slate-950 p-2 shadow-2xl shadow-blue-900/40 ring-1 ring-white/20">
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black/90"
          aria-hidden
        />
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.1rem] bg-black">
          {showVideo ? (
            <video
              className="h-full w-full object-cover"
              src={videoSrc}
              poster={posterSrc}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoMissing(true)}
            />
          ) : (
            <Image
              src={posterSrc}
              alt="Zoro app preview"
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 280px, 320px"
            />
          )}
        </div>
      </div>
    </div>
  );
}
