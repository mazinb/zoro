'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoMissing, setVideoMissing] = useState(false);
  const showVideo = Boolean(videoSrc) && !videoMissing;

  useEffect(() => {
    if (!showVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;

    const tryPlay = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay can be blocked until interaction; retry on visibility.
        });
      }
    };

    tryPlay();
    video.addEventListener('loadeddata', tryPlay);
    video.addEventListener('canplay', tryPlay);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [showVideo, videoSrc]);

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
              ref={videoRef}
              className="h-full w-full object-cover"
              src={videoSrc}
              poster={posterSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              controls={false}
              disablePictureInPicture
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
