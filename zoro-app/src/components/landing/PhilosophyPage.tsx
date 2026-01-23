'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface PhilosophyPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
}


export const PhilosophyPage: React.FC<PhilosophyPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onBack
}) => {
  const router = useRouter();
  const theme = useThemeClasses(darkMode);

  const bgGradientClass = darkMode 
    ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
    : 'bg-gradient-to-br from-slate-50 to-blue-50';

  const handleRetireClick = () => {
    router.push('/retire');
  };

  // Philosophy page (main)
  return (
    <div className={`min-h-screen ${bgGradientClass} transition-colors duration-300`}>
      <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={onBack}
              className="flex items-center cursor-pointer"
              aria-label="Back to home"
            >
              <ZoroLogo className="h-8" isDark={darkMode} />
            </button>
            <div className="flex items-center gap-6">
              <button
                onClick={onBack}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors flex items-center gap-1`}
              >
                <ChevronLeft className="w-4 h-4" /> Back to Home
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
          <h1 className={`text-3xl font-bold ${theme.textClass} mb-2 mt-4`}>Our Philosophy</h1>
          <p className={theme.textSecondaryClass}>
            Built for clarity, accountability, and compounding outcomes.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className={`text-4xl font-bold ${theme.textClass} mb-4`}>
            A calmer, clearer way to build wealth
          </h2>
          <p className={`text-xl ${theme.textSecondaryClass} max-w-3xl mx-auto`}>
            Our founder reached financial freedom and retired at 37. We turned that playbook into a platform focused on clear goals, consistent habits, and compounding progress.
          </p>
        </div>

        {/* Philosophy Copy */}
        <div className="space-y-12 mb-16">
          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Clarity beats complexity</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              We focus on the 3 numbers that drive 90% of outcomes: your income, your monthly spend, and your net worth.
              When those move in the right direction, your goals follow.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              A simple plan you review every 90 days beats a perfect plan you never open.
              We make it easy to track 3–5 priority goals, build a 6–12 month emergency runway,
              and target a retirement corpus of 25x–30x annual expenses.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Advisory models in India</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              India has multiple advisory models. You will see fee-only SEBI-registered advisers who charge a flat annual fee,
              AUM-based advisers who charge a percentage of assets (often around 0.5%–1.5% per year),
              and commission-led distributors or bank relationship managers whose compensation comes from product trails.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Each model can work, but incentives vary. We help you ask the right questions, compare fees in plain numbers,
              and keep your plan simple enough to follow without constant hand-holding.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Where Zoro fits</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Zoro is your personal system for consistency. It keeps your information in one place, sends timely check-ins,
              and turns complex decisions into a few small, trackable actions each month.
            </p>
          </div>
        </div>

        {/* Why This Matters */}
          <div className={`${darkMode ? 'bg-white' : 'bg-slate-800'} ${darkMode ? 'text-blue-600' : 'text-white'} rounded-2xl p-12 border ${theme.borderClass}`}>
          <h3 className={`text-3xl font-bold mb-4 text-center ${darkMode ? 'text-blue-600' : 'text-white'}`}>
            Get your retirement number
          </h3>
          <p className={`text-lg ${darkMode ? 'text-slate-700' : 'text-slate-200'} max-w-3xl mx-auto mb-8 text-center`}>
            Build a retirement plan in minutes and get a clear target based on your lifestyle, location, and savings.
          </p>
          <div className="text-center mb-8">
            <Button
              variant="primary"
              darkMode={darkMode}
              onClick={handleRetireClick}
              className={`px-8 py-4 text-lg shadow-sm hover:shadow-md ${darkMode ? 'shadow-blue-500/30' : 'shadow-slate-900/10'}`}
            >
              Start the retirement calculator
            </Button>
          </div>
          <p className={`text-sm ${darkMode ? 'text-slate-600' : 'text-slate-400'} text-center italic`}>
            Zoro is your money cat. It stays calm, pays attention, and nudges you toward consistent progress.
          </p>
        </div>
      </div>
    </div>
  );
};

