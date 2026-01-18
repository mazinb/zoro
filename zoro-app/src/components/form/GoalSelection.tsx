'use client';

import React from 'react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';

// Goal icons (same as checkin page)
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const InvestIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TaxIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const RetirementIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

interface Goal {
  id: string;
  icon: React.ComponentType;
  title: string;
  desc: string;
}

const goals: Goal[] = [
  { id: "save", icon: SaveIcon, title: "Save more consistently", desc: "Build emergency fund, reduce unnecessary spending" },
  { id: "invest", icon: InvestIcon, title: "Invest smarter", desc: "Diversify portfolio, understand index funds, track returns" },
  { id: "home", icon: HomeIcon, title: "Plan for big purchases", desc: "Home down payment, car, education funding" },
  { id: "insurance", icon: ShieldIcon, title: "Review insurance", desc: "Health, life, and property coverage checkups" },
  { id: "tax", icon: TaxIcon, title: "Tax optimization", desc: "Maximize deductions, plan for tax-saving investments" },
  { id: "retirement", icon: RetirementIcon, title: "Retirement planning", desc: "Set goals, calculate needs, build sustainable strategy" },
];

interface GoalSelectionProps {
  selectedGoals: string[];
  onGoalToggle: (goalId: string) => void;
  darkMode: boolean;
  onNext: () => void;
  onBack: () => void;
}

export const GoalSelection: React.FC<GoalSelectionProps> = ({
  selectedGoals,
  onGoalToggle,
  darkMode,
  onNext,
  onBack
}) => {
  const themeClasses = {
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    cardBgClass: darkMode ? 'bg-slate-800' : 'bg-white',
    borderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <ZoroLogo className="h-10" isDark={darkMode} />
          </div>

          <h2 className={`text-3xl font-bold ${themeClasses.textClass} mb-2`}>
            Pick your financial goals
          </h2>
          <p className={themeClasses.textSecondaryClass}>
            Select 1-3 goals. Your check-ins will focus on these priorities.
          </p>
          {selectedGoals.length > 0 && (
            <p className={`mt-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Goal cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <div
                key={goal.id}
                onClick={() => onGoalToggle(goal.id)}
                className={`${themeClasses.cardBgClass} border-2 rounded-lg p-6 cursor-pointer transition-all relative ${isSelected
                    ? darkMode
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-blue-600 bg-blue-50'
                    : themeClasses.borderClass
                  } hover:border-blue-500`}
              >
                {isSelected && (
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                    ✓
                  </div>
                )}
                <div className={`mb-3 ${isSelected ? (darkMode ? 'text-blue-400' : 'text-blue-600') : (darkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                  <Icon />
                </div>
                <div className={`font-semibold mb-2 ${themeClasses.textClass}`}>
                  {goal.title}
                </div>
                <div className={`text-sm ${themeClasses.textSecondaryClass}`}>
                  {goal.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            variant="ghost"
            darkMode={darkMode}
            onClick={onBack}
            className="flex-1"
          >
            ← Go back
          </Button>
          <Button
            variant="primary"
            darkMode={darkMode}
            onClick={onNext}
            disabled={selectedGoals.length === 0 || selectedGoals.length > 3}
            className="flex-1"
          >
            Continue →
          </Button>
        </div>

        {selectedGoals.length > 3 && (
          <p className={`text-center mt-4 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
            Please select 1-3 goals only
          </p>
        )}
      </div>
    </div>
  );
};

