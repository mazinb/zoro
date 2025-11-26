'use client';

import React, { useRef, useEffect } from 'react';
import { Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import ZoroLearningAnimation from '@/components/bloganimation';

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
  },
  {
    title: 'Families planning ahead',
    description: 'Coordinate estate planning, beneficiaries, college savings, and retirement goals all in one place.',
    bgColor: '#10B981', // Green
  },
  {
    title: 'Retirees & seniors',
    description: 'Review estate documents, track healthcare directives, and ensure beneficiaries are aligned across accounts.',
    bgColor: '#F59E0B', // Orange
  },
  {
    title: 'High net worth individuals',
    description: 'Optimize estate tax exposure, manage trusts, and coordinate complex financial structures efficiently.',
    bgColor: '#8B5CF6', // Purple
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onShowPhilosophy,
  onGetStarted
}) => {
  const theme = useThemeClasses(darkMode);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);

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

  const scrollCarousel = (direction: 'left' | 'right') => {
    const newIndex = direction === 'left' 
      ? (currentIndex - 1 + personas.length) % personas.length
      : (currentIndex + 1) % personas.length;
    setCurrentIndex(newIndex);
  };

  // Dark blue for light mode headers and buttons
  const headerTextClass = darkMode ? theme.textClass : 'text-slate-900';
  const numberBgClass = darkMode ? theme.buttonClass : 'bg-slate-900 text-white';
  const ctaInverted = !darkMode; // Inverted for contrast

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
              onClick={onShowPhilosophy}
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
        <div className={`inline-block ${theme.accentBgClass} border ${theme.cardBorderClass} rounded-full px-4 py-2 mb-8`}>
          <span className={`text-sm font-medium ${theme.textSecondaryClass}`}>
            Your AI agent but you stay in control
          </span>
        </div>

        <h1 className={`text-6xl font-bold ${theme.textClass} mb-6 tracking-tight`}>
          Your AI financial advisor
          <br />
          <span className={theme.textSecondaryClass}>and estate planner</span>
        </h1>
        
        <p className={`text-xl ${theme.textSecondaryClass} mb-12 max-w-2xl mx-auto leading-relaxed`}>
          Zoro analyzes your finances, plans your estate, and gives you instant AI-powered insights. 
          Always transparent. Always your decision.
        </p>

        <Button
          variant="primary"
          darkMode={!darkMode}
          showArrow
          onClick={onGetStarted}
          className="px-8 py-4 text-lg transform hover:scale-105"
        >
          Get Started
        </Button>

        <p className={`text-sm ${theme.textSecondaryClass} mt-4`}>
          Free for early adopters • 2 minutes to complete
        </p>
      </div>

      {/* Stats */}
      <div className={`border-t border-b ${theme.borderClass} py-12`}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className={`text-3xl font-bold ${theme.textClass} mb-1`}>10x</div>
            <div className={`text-sm ${theme.textSecondaryClass}`}>Faster analysis</div>
          </div>
          <div>
            <div className={`text-3xl font-bold ${theme.textClass} mb-1`}>24/7</div>
            <div className={`text-sm ${theme.textSecondaryClass}`}>Availability</div>
          </div>
          <div>
            <div className={`text-3xl font-bold ${theme.textClass} mb-1`}>100%</div>
            <div className={`text-sm ${theme.textSecondaryClass}`}>Your control</div>
          </div>
        </div>
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
              Every highlight teaches us how you think about money. Love an idea? Tap to agree Disagree? tell us why. We learn and grows with you
            </p>
            <Button
              variant="primary"
              darkMode={!darkMode}
              onClick={() => { if (typeof window !== 'undefined') window.location.href = '/checkin'; }}
              className="px-6"
              showArrow
            >
              Explore articles
            </Button>
          </div>

          {/* Title (first on mobile only) */}
          <div className="order-1 md:order-3 hidden" />
        </div>
      </div>

      {/* How it works */}
      <div className={`${theme.accentBgClass} py-24`}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className={`text-3xl font-bold ${headerTextClass} mb-16 text-center`}>
            How it works
          </h2>
          
          <div className="space-y-12">
            <div className="flex gap-6">
              <div className={`flex-shrink-0 w-12 h-12 ${numberBgClass} rounded-lg flex items-center justify-center font-semibold`}>
                1
              </div>
              <div>
                <h3 className={`text-xl font-semibold ${theme.textClass} mb-2`}>
                  Connect your Drive
                </h3>
                <p className={theme.textSecondaryClass}>
                  Securely link your Google Drive with one click. Your documents 
                  stay private and under your control.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className={`flex-shrink-0 w-12 h-12 ${numberBgClass} rounded-lg flex items-center justify-center font-semibold`}>
                2
              </div>
              <div>
                <h3 className={`text-xl font-semibold ${theme.textClass} mb-2`}>
                  Add your documents
                </h3>
                <p className={theme.textSecondaryClass}>
                  Upload financial docs, wills, trusts, or create new ones. 
                  Everything stays organized in your Drive.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className={`flex-shrink-0 w-12 h-12 ${numberBgClass} rounded-lg flex items-center justify-center font-semibold`}>
                3
              </div>
              <div>
                <h3 className={`text-xl font-semibold ${theme.textClass} mb-2`}>
                  Ask Zoro anything
                </h3>
                <p className={theme.textSecondaryClass}>
                  Chat with your AI advisor in plain English. Get insights, 
                  recommendations, and make informed decisions with confidence.
                </p>
              </div>
            </div>
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
                  className="relative h-[400px] md:h-[500px] flex items-center justify-center flex-shrink-0"
                  style={{
                    width: `${100 / personas.length}%`,
                  }}
                >
                  {/* Blurred Background */}
                  <div
                    className="absolute inset-0 blur-3xl opacity-60"
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
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-blue-600 dark:bg-blue-400'
                    : 'w-2 bg-slate-400 dark:bg-slate-600'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA - Contrasting section */}
      <div className={`${darkMode ? 'bg-white' : 'bg-slate-900'} py-24 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-4xl font-bold ${darkMode ? 'text-slate-900' : 'text-white'} mb-6`}>
            Ready to take control?
          </h2>
          <p className={`text-xl ${darkMode ? 'text-slate-600' : 'text-slate-300'} mb-12`}>
            Answer 5 quick questions to get your personalized plan
          </p>

          <Button
            variant="primary"
            darkMode={ctaInverted}
            showArrow
            onClick={onGetStarted}
            className="px-8 py-4 text-lg transform hover:scale-105"
          >
            Get Started
          </Button>

          <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-4`}>
            Free for early adopters • Takes 2 minutes
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className={`border-t ${theme.borderClass} py-12`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <ZoroLogo className="h-8" isDark={darkMode} />
          </div>
          <div className={`text-sm ${theme.textSecondaryClass}`}>
            Terms of use | Privacy policy
          </div>
        </div>
      </div>
    </div>
  );
};
