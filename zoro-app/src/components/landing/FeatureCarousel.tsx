'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FeatureSlide {
  num: number;
  image: string;
  title: string;
  description: string;
}

interface FeatureCarouselProps {
  features: FeatureSlide[];
  darkMode: boolean;
  textClass: string;
  textSecondaryClass: string;
  borderClass: string;
}

type ExtendedSlide = FeatureSlide & { domIndex: number; isClone: boolean };

function domToLogical(domIndex: number, slideCount: number): number {
  if (domIndex === 0) return slideCount - 1;
  if (domIndex === slideCount + 1) return 0;
  return domIndex - 1;
}

function logicalToDom(logicalIndex: number): number {
  return logicalIndex + 1;
}

export function FeatureCarousel({
  features,
  textClass,
  textSecondaryClass,
  borderClass,
}: FeatureCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const slideCount = features.length;

  const extendedSlides = useMemo((): ExtendedSlide[] => {
    const last = features[slideCount - 1];
    const first = features[0];
    const clones: ExtendedSlide[] = [
      { ...last, domIndex: 0, isClone: true },
      ...features.map((f, i) => ({ ...f, domIndex: i + 1, isClone: false })),
      { ...first, domIndex: slideCount + 1, isClone: true },
    ];
    return clones;
  }, [features, slideCount]);

  activeIndexRef.current = activeIndex;

  const scrollToDom = useCallback((domIndex: number, smooth: boolean) => {
    const container = scrollRef.current;
    if (!container) return;
    const slide = container.querySelector<HTMLElement>(`[data-dom-slide="${domIndex}"]`);
    if (!slide) return;

    jumpingRef.current = !smooth;
    slide.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      inline: 'center',
      block: 'nearest',
    });

    const logical = domToLogical(domIndex, slideCount);
    setActiveIndex(logical);

    if (!smooth) {
      requestAnimationFrame(() => {
        jumpingRef.current = false;
      });
      return;
    }

    window.setTimeout(() => {
      jumpingRef.current = false;
    }, 450);
  }, [slideCount]);

  const scrollToLogical = useCallback(
    (logicalIndex: number, smooth: boolean) => {
      scrollToDom(logicalToDom(logicalIndex), smooth);
    },
    [scrollToDom],
  );

  const go = useCallback(
    (direction: 'prev' | 'next') => {
      const logical = activeIndexRef.current;
      const dom = logicalToDom(logical);
      const nextDom = direction === 'prev' ? dom - 1 : dom + 1;
      scrollToDom(nextDom, true);
    },
    [scrollToDom],
  );

  const settleLoop = useCallback(
    (closestDom: number) => {
      if (closestDom === 0) {
        scrollToDom(slideCount, false);
        return;
      }
      if (closestDom === slideCount + 1) {
        scrollToDom(1, false);
      }
    },
    [slideCount, scrollToDom],
  );

  useEffect(() => {
    scrollToDom(1, false);
  }, [scrollToDom]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const logical = activeIndexRef.current;
      const dom = logicalToDom(logical);
      scrollToDom(dom + 1, true);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [scrollToDom]);

  const getClosestDom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return 1;

    const slides = container.querySelectorAll<HTMLElement>('[data-dom-slide]');
    const center = container.scrollLeft + container.clientWidth / 2;
    let closestDom = 1;
    let minDist = Infinity;

    slides.forEach((slide) => {
      const domIndex = Number(slide.dataset.domSlide);
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(center - slideCenter);
      if (dist < minDist) {
        minDist = dist;
        closestDom = domIndex;
      }
    });

    return closestDom;
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      if (jumpingRef.current) return;
      setActiveIndex(domToLogical(getClosestDom(), slideCount));
    };

    const onScrollEnd = () => {
      if (jumpingRef.current) return;
      const closestDom = getClosestDom();
      setActiveIndex(domToLogical(closestDom, slideCount));
      if (closestDom === 0 || closestDom === slideCount + 1) {
        settleLoop(closestDom);
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('scrollend', onScrollEnd);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('scrollend', onScrollEnd);
    };
  }, [slideCount, settleLoop, getClosestDom]);

  const active = features[activeIndex];
  const slideImageHeight = 'h-[min(48vh,380px)] sm:h-[400px]';

  return (
    <div className="relative">
      <div className="relative h-[min(52vh,460px)] sm:h-[480px] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex h-full items-center gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth px-[max(1rem,calc(50%-160px))] sm:px-[max(1.5rem,calc(50%-150px))] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-roledescription="carousel"
          aria-label="App features"
        >
        {extendedSlides.map((feature) => {
          const logical = domToLogical(feature.domIndex, slideCount);
          const isActive = logical === activeIndex;

          return (
            <article
              key={`${feature.domIndex}-${feature.isClone ? 'clone' : 'real'}-${feature.num}`}
              data-dom-slide={feature.domIndex}
              className="snap-center shrink-0 w-[min(100%,280px)] sm:w-[300px] md:w-[320px] flex items-center justify-center"
              aria-hidden={!isActive}
            >
              <div
                className={`w-full origin-center rounded-2xl overflow-hidden bg-black transition-all duration-300 ease-out ${
                  isActive
                    ? 'z-10 scale-110 sm:scale-[1.08] shadow-2xl shadow-blue-500/25'
                    : 'z-0 scale-[0.82] sm:scale-[0.85] brightness-[0.85] shadow-md'
                }`}
              >
                <div className={`relative bg-black ${slideImageHeight}`}>
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 640px) 280px, 320px"
                    draggable={false}
                  />
                </div>
              </div>
            </article>
          );
        })}
        </div>

        <button
          type="button"
          onClick={() => go('prev')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full border ${borderClass} bg-white/95 text-slate-900 hover:bg-white shadow-md transition-colors hidden sm:flex`}
          aria-label="Previous feature"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => go('next')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full border ${borderClass} bg-white/95 text-slate-900 hover:bg-white shadow-md transition-colors hidden sm:flex`}
          aria-label="Next feature"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div
        className="mt-8 h-[10.5rem] sm:h-[11rem] text-center px-4 flex flex-col items-center"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="block h-5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 line-clamp-1">
          {active.num} · {active.title}
        </span>
        <h3
          className={`h-8 sm:h-9 flex items-center justify-center text-xl sm:text-2xl font-bold ${textClass} mb-2 line-clamp-1 w-full max-w-lg`}
        >
          {active.title}
        </h3>
        <p
          className={`flex-1 text-sm sm:text-base ${textSecondaryClass} max-w-lg mx-auto leading-relaxed line-clamp-3`}
        >
          {active.description}
        </p>
      </div>

      <div className="flex justify-center gap-2 mt-6 flex-wrap">
        {features.map((feature, index) => (
          <button
            key={feature.num}
            type="button"
            onClick={() => scrollToLogical(index, true)}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex
                ? 'w-8 bg-blue-600 dark:bg-blue-400'
                : 'w-2 bg-slate-400 dark:bg-slate-600 hover:bg-slate-500'
            }`}
            aria-label={`Go to feature ${feature.num}: ${feature.title}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
