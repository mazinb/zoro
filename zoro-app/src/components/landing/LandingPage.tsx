'use client';

import React from 'react';
import { ArrowRight, Moon, Sun, TrendingUp } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface LandingPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onShowPhilosophy: () => void;
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onShowPhilosophy,
  onGetStarted
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <ZoroLogo className="h-8" isDark={darkMode} />
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
          darkMode={darkMode}
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

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <h3 className={`text-2xl font-semibold ${theme.textClass} mb-4`}>
              Natural language queries
            </h3>
            <p className={`${theme.textSecondaryClass} leading-relaxed`}>
              Ask "Am I on track for retirement?" or "Is my estate plan complete?" 
              Get detailed answers with specific numbers and recommendations.
            </p>
          </div>

          <div>
            <h3 className={`text-2xl font-semibold ${theme.textClass} mb-4`}>
              Estate planning review
            </h3>
            <p className={`${theme.textSecondaryClass} leading-relaxed`}>
              Analyze wills, trusts, and beneficiary designations. Get completeness 
              checks, alignment verification, and tax efficiency recommendations.
            </p>
          </div>

          <div>
            <h3 className={`text-2xl font-semibold ${theme.textClass} mb-4`}>
              Financial insights
            </h3>
            <p className={`${theme.textSecondaryClass} leading-relaxed`}>
              Track budgets, retirement accounts, investments, and debt. 
              AI analyzes everything in seconds and surfaces what matters most.
            </p>
          </div>

          <div>
            <h3 className={`text-2xl font-semibold ${theme.textClass} mb-4`}>
              You're always in control
            </h3>
            <p className={`${theme.textSecondaryClass} leading-relaxed`}>
              Zoro suggests, you decide. Review every recommendation before taking action. 
              Your documents stay private in your Google Drive.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className={`${theme.accentBgClass} py-24`}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className={`text-3xl font-bold ${theme.textClass} mb-16 text-center`}>
            How it works
          </h2>
          
          <div className="space-y-12">
            <div className="flex gap-6">
              <div className={`flex-shrink-0 w-12 h-12 ${theme.buttonClass} rounded-lg flex items-center justify-center font-semibold`}>
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
              <div className={`flex-shrink-0 w-12 h-12 ${theme.buttonClass} rounded-lg flex items-center justify-center font-semibold`}>
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
              <div className={`flex-shrink-0 w-12 h-12 ${theme.buttonClass} rounded-lg flex items-center justify-center font-semibold`}>
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

      {/* Use cases */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        <h2 className={`text-3xl font-bold ${theme.textClass} mb-16 text-center`}>
          Perfect for
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card darkMode={darkMode} className="p-6">
            <div className="text-2xl mb-2">📊</div>
            <h3 className={`font-semibold ${theme.textClass} mb-2`}>Busy professionals</h3>
            <p className={`${theme.textSecondaryClass} text-sm`}>
              Get quick financial insights and estate planning status without 
              scheduling advisor meetings.
            </p>
          </Card>

          <Card darkMode={darkMode} className="p-6">
            <div className="text-2xl mb-2">🏠</div>
            <h3 className={`font-semibold ${theme.textClass} mb-2`}>Families planning ahead</h3>
            <p className={`${theme.textSecondaryClass} text-sm`}>
              Coordinate estate planning, beneficiaries, college savings, and 
              retirement goals all in one place.
            </p>
          </Card>

          <Card darkMode={darkMode} className="p-6">
            <div className="text-2xl mb-2">👴</div>
            <h3 className={`font-semibold ${theme.textClass} mb-2`}>Retirees & seniors</h3>
            <p className={`${theme.textSecondaryClass} text-sm`}>
              Review estate documents, track healthcare directives, and ensure 
              beneficiaries are aligned across accounts.
            </p>
          </Card>

          <Card darkMode={darkMode} className="p-6">
            <div className="text-2xl mb-2">💼</div>
            <h3 className={`font-semibold ${theme.textClass} mb-2`}>High net worth individuals</h3>
            <p className={`${theme.textSecondaryClass} text-sm`}>
              Optimize estate tax exposure, manage trusts, and coordinate complex 
              financial structures efficiently.
            </p>
          </Card>
        </div>
      </div>

      {/* Final CTA */}
      <div className={`${darkMode ? 'bg-slate-900' : 'bg-white border-t border-slate-200'} py-24`}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-4xl font-bold ${theme.textClass} mb-6`}>
            Ready to take control?
          </h2>
          <p className={`text-xl ${theme.textSecondaryClass} mb-12`}>
            Answer 5 quick questions to get your personalized plan
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
            Free for early adopters • Takes 2 minutes
          </p>
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

