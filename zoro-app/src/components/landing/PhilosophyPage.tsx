'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowRight, Moon, Sun, User, Mail, ExternalLink } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
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
  const router = useRouter();
  const theme = useThemeClasses(darkMode);
  
  const isAdvisorMode = process.env.NEXT_PUBLIC_ADVISOR_MODE === 'true';

  const bgGradientClass = darkMode 
    ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
    : 'bg-gradient-to-br from-slate-50 to-blue-50';

  const handleRoadmapClick = () => {
    router.push('/timeline');
  };

  const handleProfileClick = () => {
    router.push('/profile');
  };

  const handleAdvisorsListClick = () => {
    window.open('https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13', '_blank');
  };

  const handleEmailAdmin = () => {
    window.location.href = 'mailto:admin@getzoro.com';
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
            <button
              onClick={onToggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <h1 className={`text-3xl font-bold ${theme.textClass} mb-2 mt-4`}>Our Philosophy</h1>
          <p className={theme.textSecondaryClass}>
            {isAdvisorMode
              ? 'Built for clarity, accountability, and compounding outcomes for advisors and clients.'
              : 'Built for clarity, accountability, and compounding outcomes.'}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className={`text-4xl font-bold ${theme.textClass} mb-4`}>
            {isAdvisorMode
              ? 'A calmer, clearer way to build wealth'
              : 'A calmer, clearer way to build wealth'}
          </h2>
          <p className={`text-xl ${theme.textSecondaryClass} max-w-3xl mx-auto`}>
            {isAdvisorMode
              ? 'Our founder reached financial freedom and retired at 37. We turned that playbook into a platform that helps advisors deliver clarity, consistency, and trust.'
              : 'Our founder reached financial freedom and retired at 37. We turned that playbook into a platform focused on clear goals, consistent habits, and compounding progress.'}
          </p>
        </div>

        {/* Three Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Principle 1: Roadmap */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={handleRoadmapClick}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              <BookOpen className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
            </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>
              {isAdvisorMode ? 'Our Roadmap' : 'Our Roadmap'}
            </h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              {isAdvisorMode
                ? 'We build in public. Follow the milestones, see what is shipping next, and how early users benefit as the platform evolves.'
                : 'We build in public. Follow the milestones, see what is shipping next, and how early users benefit as the platform evolves.'}
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              View Roadmap <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Principle 2: Profile/Onboarding */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={handleProfileClick}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              <User className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
            </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>
              {isAdvisorMode ? 'Client Profiles' : 'Complete Your Profile'}
            </h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              {isAdvisorMode
                ? 'Build comprehensive financial profiles for your clients. Track assets, liabilities, insurance, and estate preferences all in one place to deliver better advice.'
                : 'Build your comprehensive financial profile. Track assets, liabilities, insurance, and estate preferences. The more you share, the better Zoro understands your context and can provide personalized recommendations.'}
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              {isAdvisorMode ? 'Manage Profiles' : 'Complete Profile'} <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Principle 3: Advisors List or Contact */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={isAdvisorMode ? handleAdvisorsListClick : handleEmailAdmin}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              {isAdvisorMode ? (
                <ExternalLink className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
              ) : (
                <Mail className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
              )}
            </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>
              {isAdvisorMode ? 'SEBI Registered Advisors' : 'Get Support'}
            </h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              {isAdvisorMode
                ? 'Browse the complete list of SEBI-registered investment advisers. Verify credentials, find contact information, and connect with certified professionals.'
                : 'Have questions or need assistance? Reach out to our team. We\'re here to help you make the most of Zoro and your financial planning journey.'}
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              {isAdvisorMode ? 'View SEBI List' : 'Contact Admin'} <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Why This Matters */}
          <div className={`${darkMode ? 'bg-white' : 'bg-slate-800'} ${darkMode ? 'text-blue-600' : 'text-white'} rounded-2xl p-12 border ${theme.borderClass}`}>
          <h3 className={`text-3xl font-bold mb-4 text-center ${darkMode ? 'text-blue-600' : 'text-white'}`}>
            {isAdvisorMode ? 'Why This Platform Works' : 'Why This Approach Works'}
          </h3>
          <p className={`text-lg ${darkMode ? 'text-slate-700' : 'text-slate-200'} max-w-3xl mx-auto mb-8 text-center`}>
            {isAdvisorMode
              ? 'Advisory outcomes improve with clarity and follow-through. We publish a transparent roadmap, ship in public, and keep advisors in control of how the platform evolves for their clients.'
              : 'Financial progress improves with clarity and follow-through. We publish a transparent roadmap, ship in public, and keep you in control of what Zoro learns and recommends.'}
          </p>
          <div className="text-center mb-8">
            <Button
              variant="primary"
              darkMode={darkMode}
              onClick={handleRoadmapClick}
              className="px-8 py-4 text-lg"
            >
              View the Roadmap
            </Button>
          </div>
          {!isAdvisorMode && (
            <p className={`text-sm ${darkMode ? 'text-slate-600' : 'text-slate-400'} text-center italic`}>
              Zoro is your money cat. It stays calm, pays attention, and nudges you toward consistent progress.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

