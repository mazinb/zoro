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
            Master your behavior to own your time.
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
            Master your behavior to own your time.
          </p>
        </div>

        {/* Philosophy Copy */}
        <div className="space-y-12 mb-16">
          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Clarity beats complexity</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              We focus on the three numbers that drive 90% of outcomes: your income, your monthly spend, and your net worth. When these move in the right direction, your goals follow.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              A simple plan you actually review every 90 days is far more effective than a &quot;perfect&quot; plan that gathers dust. We make it easy to track a few priority goals, build a 6–12 month emergency runway, and target a retirement corpus of 25x–30x your annual expenses.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>The math of freedom</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              The &quot;25x Rule&quot; is a practical way to calculate when work becomes optional. In a market like India, the key is understanding your Real Return.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              If your portfolio earns 10% but inflation is 6%, your real gain is 4%. To live comfortably without touching your principal, you need a corpus large enough that this 4% gap covers your lifestyle. For most people, that means saving 25 to 30 times what they spend in a year. We help you find your specific &quot;X&quot; so you can stop guessing and start building.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Advisory models and incentives</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Financial success is often more about endurance than intensity. To stay in the game, you need to understand how the advice you receive is funded.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              The US market has largely moved toward a &quot;Fiduciary&quot; standard where advisors are required to put your interests first. India is currently making this transition. As the market matures, it is vital to know how your advisor is compensated.
            </p>
            <ul className={`text-lg ${theme.textSecondaryClass} space-y-3 list-disc pl-6`}>
              <li><strong className={theme.textClass}>Fee-Only Advisors:</strong> You pay a flat annual fee for a roadmap. Their only incentive is your long-term clarity and success.</li>
              <li><strong className={theme.textClass}>AUM-Based Advisors:</strong> They charge a percentage of your total assets, usually between 0.5% and 1.5%. They grow when you grow, which aligns your interests, though they may prefer you keep your money invested rather than spending it on major life goals.</li>
              <li><strong className={theme.textClass}>Commission-Led Distributors:</strong> The advice is often free because they earn commissions from the products you buy. This is the most common model in India, but it can create an incentive for constant movement or complexity.</li>
            </ul>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              We help you compare these models in plain numbers so you can choose a path that lets you sleep at night.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Where Zoro fits</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Zoro is your personal system for consistency. We don&apos;t sell products or take commissions. We simply provide the framework to turn complex financial decisions into small, trackable actions.
            </p>
            <ul className={`text-lg ${theme.textSecondaryClass} space-y-3 list-disc pl-6`}>
              <li><strong className={theme.textClass}>Survival First:</strong> We prioritize your emergency runway so you never have to sell your long-term investments during a market dip.</li>
              <li><strong className={theme.textClass}>Quarterly Pulse:</strong> We move your focus away from daily market noise and toward meaningful 90-day progress.</li>
              <li><strong className={theme.textClass}>Behavioral Support:</strong> We act as the neutral ground where you can see your entire financial life in one place.</li>
            </ul>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              The goal is not just to be wealthy. The goal is to build a life where you are in control of your own time.
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

