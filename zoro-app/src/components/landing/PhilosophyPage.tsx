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
      <nav className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
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
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className={`text-4xl font-bold ${theme.textClass} mb-4`}>
            A calmer, clearer way to build wealth
          </h2>
          <p className={`text-xl ${theme.textSecondaryClass} max-w-3xl mx-auto`}>
            What matters to us and how Zoro works
          </p>
        </div>

        {/* Philosophy Copy */}
        <div className="space-y-12 mb-16">
          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Clarity beats complexity</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              We focus on the three key figures that drive outcomes: what you earn, what you spend, and what you keep. When these move in the right direction, your financial goals follow. We believe that a simple plan you review every 90 days is far more effective than a &quot;perfect&quot; plan that gathers dust. We make it easy to track a few priority goals and work on them.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Redefining True Wealth</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Ultimately, the goal isn&apos;t just to accumulate numbers in a bank account but to buy back your time. It&apos;s about reaching a point where work becomes optional, not mandatory. This isn&apos;t about perfectly timing the market but about building a portfolio large enough that your real returns (what you earn minus the rising cost of living) comfortably cover your lifestyle.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Remember, money&apos;s greatest intrinsic value is the ability to give you control over your time. True wealth means waking up every morning and saying, &quot;I can do whatever I want today.&quot; When you stop working for money and start making your money work for you, the entire game changes. It&apos;s no longer about endless hustle. It&apos;s about freedom.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Once you reach that milestone where work becomes truly optional, the anxiety of accumulation diminishes, but it&apos;s often replaced by a new, subtle fear of losing what you have. Gaining money involves taking risks and being optimistic, but keeping money demands the opposite: humility and a healthy fear that what you&apos;ve built could be taken away.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              This is where most people falter. They try to apply the &quot;growth&quot; mindset to a &quot;preservation&quot; phase. Just as a professional athlete needs a coach to refine their form even at the top of their game, you need a partner to protect you from your own biases.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Advisory models and incentives</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Financial success is often more about endurance than intensity. To stay in the game, you must understand how the &quot;referees&quot; are paid.
            </p>
            <ul className={`text-lg ${theme.textSecondaryClass} space-y-3 list-disc pl-6`}>
              <li><strong className={theme.textClass}>Commission-Led Distributors:</strong> The free model, earning commissions from the products you buy. Incentivised by commissions and sign-up bonuses.</li>
              <li><strong className={theme.textClass}>AUM-Based Advisors:</strong> They grow when you grow, which aligns interests, but they may prefer you keep your money invested. The fees also add up quickly over time.</li>
              <li><strong className={theme.textClass}>Fee-Only Advisors:</strong> You pay for the roadmap. There are only about 1,000 RIAs in India serving a billion people. Quality varies, and service can be manual and time-consuming.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>How Zoro works</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Zoro is designed to bridge the gap between financial intention and daily action through a simple, email-based interface. Here is the process:
            </p>
            <ul className={`text-lg ${theme.textSecondaryClass} space-y-3 list-disc pl-6`}>
              <li><strong className={theme.textClass}>Intent Mapping:</strong> When you email Zoro, the agent analyses the text to understand your specific financial intent (e.g., &quot;I just got a bonus,&quot; &quot;I need to update my insurance,&quot; or &quot;Review my portfolio&quot;).</li>
              <li><strong className={theme.textClass}>Contextual Analysis:</strong> Zoro reviews your saved structured data — income, expenses, and current net worth to ensure advice is personalised to your situation.</li>
              <li><strong className={theme.textClass}>Actionable Drafting:</strong> Zoro drafts a response that isn&apos;t just advice, but a next step. This reply often includes a customised link to: securely update a specific data point; review a curated summary of your last 90 days; adjust your priority goals.</li>
              <li><strong className={theme.textClass}>Data Integration (coming soon):</strong> With your permission, Zoro scans your inbox to automatically update your tracking sheet, turning manual data entry into a passive process.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className={`text-2xl font-bold ${theme.textClass}`}>Where Zoro fits</h3>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              Zoro isn&apos;t another app to check stock prices. It&apos;s a behavioural interface designed to turn &quot;I should do this&quot; into &quot;I have done this.&quot; Think of Zoro as your system for consistency. We don&apos;t sell products or take commissions. We simply provide the framework to keep you on track.
            </p>
            <p className={`text-lg ${theme.textSecondaryClass}`}>
              <strong className={theme.textClass}>Privacy First:</strong> You will only hear from us if you email us first or if you specifically ask for a reminder or follow-up. We never spam.
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

