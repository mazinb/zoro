'use client';

import React from 'react';
import { ArrowRight, Moon, Sun, Brain } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ARTICLES } from '@/constants';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface PhilosophyPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onGetStarted: () => void;
  onBack: () => void;
}

export const PhilosophyPage: React.FC<PhilosophyPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onGetStarted,
  onBack
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-8" isDark={darkMode} />
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className={`text-5xl font-bold ${theme.textClass} mb-6 tracking-tight`}>
          Our Philosophy
        </h1>
        <p className={`text-xl ${theme.textSecondaryClass} max-w-2xl mx-auto leading-relaxed`}>
          Zoro is trained on principles we believe work—simple, evidence-based strategies that prioritize your long-term wealth and security.
        </p>
      </div>

      {/* Core Principles */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <Card darkMode={darkMode} className="p-12">
          <h2 className={`text-2xl font-bold ${theme.textClass} mb-8 text-center`}>
            Three Core Beliefs
          </h2>
          
          <div className="space-y-12">
            {ARTICLES.map((article, idx) => (
              <div key={article.slug} className="flex gap-6 items-start">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center`}>
                  <span className="text-blue-600 font-bold">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className={`text-xl font-bold ${theme.textClass} mb-2`}>
                    {article.title}
                  </h3>
                  <p className={`${theme.textSecondaryClass} mb-3 leading-relaxed`}>
                    {article.excerpt}
                  </p>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1">
                    Read full article ({article.readTime})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AI Training Note */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <Card darkMode={darkMode} className={`p-8 text-center ${theme.accentBgClass}`}>
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} mb-4`}>
            <Brain className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className={`text-xl font-bold ${theme.textClass} mb-3`}>
            AI Trained on Our System
          </h3>
          <p className={`${theme.textSecondaryClass} max-w-2xl mx-auto leading-relaxed`}>
            Zoro's recommendations are shaped by these principles, but you're always in control. 
            Review every suggestion, ask questions, and make decisions that align with your unique situation.
          </p>
        </Card>
      </div>

      {/* CTA */}
      <div className={`border-t ${theme.borderClass} py-16`}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-3xl font-bold ${theme.textClass} mb-4`}>
            Ready to get started?
          </h2>
          <p className={`${theme.textSecondaryClass} mb-8`}>
            Answer a few questions and get your personalized plan
          </p>
          <Button
            variant="primary"
            darkMode={darkMode}
            showArrow
            onClick={onGetStarted}
            className="px-8 py-4 text-lg transform hover:scale-105"
          >
            Get Started
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className={`border-t ${theme.borderClass} py-12`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <ZoroLogo className="h-7" isDark={darkMode} />
          </div>
          <div className={`text-sm ${theme.textSecondaryClass}`}>
            Powered by Claude AI & Google Drive
          </div>
        </div>
      </div>
    </div>
  );
};

