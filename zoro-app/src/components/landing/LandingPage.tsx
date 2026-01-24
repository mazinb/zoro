'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { Moon, Sun, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAnalytics } from '@/hooks/useAnalytics';
import ZoroLearningAnimation from '@/components/bloganimation';
import { useWaitlistCount } from '@/hooks/useWaitlistCount';
import { buildTimelineMilestones } from '@/lib/timeline';

interface LandingPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onShowPhilosophy: () => void;
  onGetStarted: () => void;
}

const personas = [
  {
    title: 'Busy professionals',
    description: 'Get quick financial insights and estate planning status without scheduling advisor meetings.',
    bgColor: '#3B82F6', // Blue
    image: '/images/landing/1.JPG',
  },
  {
    title: 'Families planning ahead',
    description: 'Coordinate family finances, beneficiaries, college savings, and retirement goals all in one place.',
    bgColor: '#10B981', // Green
    image: '/images/landing/2.JPG',
  },
  {
    title: 'Retirees & seniors',
    description: 'Review estate documents, track healthcare directives, and ensure beneficiaries are aligned across accounts.',
    bgColor: '#F59E0B', // Orange
    image: '/images/landing/3.JPG',
  },
  {
    title: 'High net worth individuals',
    description: 'Optimize tax exposure, manage trusts, and coordinate complex financial structures efficiently.',
    bgColor: '#8B5CF6', // Purple
    image: '/images/landing/4.JPG',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onShowPhilosophy,
  onGetStarted
}) => {
  const theme = useThemeClasses(darkMode);
  const { trackClick } = useAnalytics();
  const carouselRef = useRef<HTMLDivElement>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isRoadmapVisible, setIsRoadmapVisible] = React.useState(false);
  const signupCount = useWaitlistCount(isRoadmapVisible);
  const timelineMilestones = buildTimelineMilestones(signupCount);

  // Auto-scroll carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % personas.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Scroll carousel on index change
  useEffect(() => {
    if (carouselRef.current) {
      const scrollContainer = carouselRef.current;
      const slideWidth = scrollContainer.offsetWidth;
      const scrollPosition = currentIndex * slideWidth;

      scrollContainer.scrollTo({
        left: scrollPosition,
        behavior: 'smooth',
      });
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!roadmapRef.current || isRoadmapVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsRoadmapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(roadmapRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isRoadmapVisible]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    const newIndex = direction === 'left'
      ? (currentIndex - 1 + personas.length) % personas.length
      : (currentIndex + 1) % personas.length;
    setCurrentIndex(newIndex);
  };

  // Dark blue for light mode headers and buttons
  const headerTextClass = darkMode ? theme.textClass : 'text-slate-900';
  const numberBgClass = darkMode ? theme.buttonClass : 'bg-slate-900 text-white';
  const upcomingNumberClass = darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-200 text-slate-900';

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <ZoroLogo className="h-10" isDark={darkMode} />
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                trackClick('philosophy_nav_click', {
                  category: 'navigation',
                  label: 'Our Philosophy (Nav)',
                  elementId: 'philosophy-nav-link',
                });
                onShowPhilosophy();
              }}
              className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            >
              Our Philosophy
            </button>
            <button
              onClick={onToggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className={`inline-block ${theme.accentBgClass} border ${theme.cardBorderClass} rounded-full px-4 py-2 mb-6`}>
          <span className={`text-sm font-medium ${theme.textSecondaryClass} flex items-center gap-2 whitespace-nowrap truncate max-w-[260px] sm:max-w-none`}>
            <Clock className="w-4 h-4" />
            Limited spots available for early access
          </span>
        </div>

        <h1 className={`text-6xl font-bold ${theme.textClass} mb-6 tracking-tight`}>
          Your Personal
          <br />
          <span className="text-blue-600 dark:text-blue-400">
            Financial Planner
          </span>
        </h1>

        <p className={`text-xl ${theme.textSecondaryClass} mb-12 max-w-2xl mx-auto leading-relaxed`}>
          Zoro analyzes your finances, helps you plan for the future, and gives you regular AI-powered insights.
          In your inbox but only when you need it.
        </p>

        <Button
          variant="primary"
          darkMode={!darkMode}
          showArrow
          onClick={() => {
            trackClick('cta_join_waitlist_hero', {
              category: 'cta',
              label: 'Join Waitlist (Hero)',
              elementId: 'cta-join-waitlist-hero',
            });
            onGetStarted();
          }}
          className="px-8 py-4 text-lg transform hover:scale-105 shadow-xl shadow-blue-500/20"
        >
          Join the Waitlist
        </Button>

        <p className={`text-sm ${theme.textSecondaryClass} mt-4`}>
          Secure your spot • Free for early adopters
        </p>
      </div>

      {/* Blog Interaction Section */}
      <div className="max-w-6xl mx-auto px-6 py-24">
        {/* Mobile-first flow: title → animation → text → CTA */}
        <h3 className={`md:hidden text-3xl font-bold ${theme.textClass} mb-4`}>
          Read, React, We Learn
        </h3>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Animation (left on desktop, second on mobile) */}
          <div className="order-2 md:order-1 flex justify-center md:justify-start">
            <ZoroLearningAnimation width={380} height={260} darkMode={darkMode} />
          </div>

          {/* Copy (right on desktop, third on mobile) */}
          <div className="order-3 md:order-2">
            <h3 className={`hidden md:block text-4xl font-bold ${theme.textClass} mb-4`}>
              Read, React, We Learn
            </h3>
            <p className={`${theme.textSecondaryClass} text-lg leading-relaxed mb-6`}>
              Get timely reminders to stay on track and accomplish your goals. Simply reply to give us feedback or update your info.
            </p>
            <button
              onClick={() => {
                trackClick('philosophy_read_react_click', {
                  category: 'navigation',
                  label: 'Our Philosophy (Read React)',
                  elementId: 'philosophy-read-react-link',
                });
                onShowPhilosophy();
              }}
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              Our Philosophy <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Title (first on mobile only) */}
          <div className="order-1 md:order-3 hidden" />
        </div>
      </div>

      {/* Waitlist Milestones */}
      <div className={`${theme.accentBgClass} py-24`} ref={roadmapRef}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl font-bold ${headerTextClass} mb-4`}>
              The Roadmap
            </h2>
            <p className={`${theme.textSecondaryClass} max-w-xl mx-auto`}>
              We are building in public with early adopters.
            </p>
          </div>

          <div className="space-y-8">
            {timelineMilestones.map((milestone) => {
              const isComplete = milestone.status === 'complete';
              const isCurrent = milestone.status === 'current';
              const isUpcoming = milestone.status === 'upcoming';
              const badgeClass = isComplete
                ? 'bg-green-600 text-white'
                : isCurrent
                  ? 'bg-blue-600 text-white'
                  : '';

              return (
                <div
                  key={milestone.count}
                  className={`flex gap-6 p-6 rounded-2xl border ${theme.borderClass} ${
                    isUpcoming
                      ? darkMode
                        ? 'bg-slate-800/50 opacity-75'
                        : 'bg-white/50 opacity-75'
                      : darkMode
                        ? 'bg-slate-800/50'
                        : 'bg-white'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 ${
                      isUpcoming ? upcomingNumberClass : numberBgClass
                    } rounded-full flex items-center justify-center font-bold text-lg`}
                  >
                    {milestone.displayCount}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${theme.textClass} mb-2 flex items-center gap-2`}>
                      {milestone.title}
                      {!isUpcoming && (
                        <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>
                          {isComplete ? 'Complete' : 'Current'}
                        </span>
                      )}
                    </h3>
                    <p className={theme.textSecondaryClass}>{milestone.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link href="/timeline" className={`text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1`}>
              View full timeline details <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Use cases - Carousel */}
      <div className="max-w-6xl mx-auto px-6 py-24">
        <h2 className={`text-3xl font-bold ${headerTextClass} mb-16 text-center`}>
          Perfect for
        </h2>

        <div className="relative">
          {/* Carousel Container */}
          <div
            ref={carouselRef}
            className="overflow-x-scroll rounded-2xl scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="flex" style={{ width: `${personas.length * 100}%` }}>
              {personas.map((persona, index) => (
                <div
                  key={index}
                  className="relative h-[400px] md:h-[500px] flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    width: `${100 / personas.length}%`,
                  }}
                >
                  {/* Background Image */}
                  <div
                    className="absolute inset-0 bg-cover"
                    style={{
                      backgroundImage: `url(${persona.image})`,
                      backgroundPosition: (index === 0 || index === personas.length - 1) ? 'center top' : 'center center',
                    }}
                  />

                  {/* Colored Overlay with 75% opacity */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundColor: persona.bgColor,
                    }}
                  />

                  {/* Gradient Overlay for better text readability */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/60" />

                  {/* Content */}
                  <div className="relative z-10 max-w-2xl px-8 text-center">
                    <h3 className={`text-3xl md:text-4xl font-bold text-white mb-4`}>
                      {persona.title}
                    </h3>
                    <p className={`text-lg md:text-xl text-white/90 leading-relaxed`}>
                      {persona.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={() => scrollCarousel('left')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white transition-all"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => scrollCarousel('right')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white transition-all"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Indicators */}
          <div className="flex justify-center gap-2 mt-8">
            {personas.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all ${index === currentIndex
                    ? 'w-8 bg-blue-600 dark:bg-blue-400'
                    : 'w-2 bg-slate-400 dark:bg-slate-600'
                  }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className={`${theme.accentBgClass} border-t ${theme.borderClass} py-20`}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-3xl font-bold ${headerTextClass} mb-4`}>
            Ready to get started?
          </h2>
          <p className={`${theme.textSecondaryClass} mb-8`}>
            Join the waitlist to receive early access.
          </p>
          <Button
            variant="primary"
            darkMode={!darkMode}
            showArrow
            onClick={() => {
              trackClick('cta_join_waitlist_footer', {
                category: 'cta',
                label: 'Join Waitlist (Footer)',
                elementId: 'cta-join-waitlist-footer',
              });
              onGetStarted();
            }}
            className="px-8 py-4 text-lg transform hover:scale-105 shadow-xl shadow-blue-500/20"
          >
            Join the Waitlist
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className={`border-t ${theme.borderClass} py-12`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <ZoroLogo className="h-8" isDark={darkMode} />
          </div>
          <div className={`text-sm ${theme.textSecondaryClass} flex items-center gap-2`}>
            <Link
              href="/legal?tab=terms"
              className="hover:underline transition-colors"
            >
              Terms of use
            </Link>
            <span>|</span>
            <Link
              href="/legal?tab=privacy"
              className="hover:underline transition-colors"
            >
              Privacy policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
