'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

// Reuse the same goal config as GoalSelection
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

const GOAL_CONFIG: Record<
  string,
  { title: string; desc: string; Icon: React.ComponentType }
> = {
  save: {
    title: 'Save more consistently',
    desc: 'Build emergency fund, reduce unnecessary spending',
    Icon: SaveIcon,
  },
  invest: {
    title: 'Invest smarter',
    desc: 'Diversify portfolio, understand index funds, track returns',
    Icon: InvestIcon,
  },
  home: {
    title: 'Plan for big purchases',
    desc: 'Home down payment, car, education funding',
    Icon: HomeIcon,
  },
  insurance: {
    title: 'Review insurance',
    desc: 'Health, life, and property coverage checkups',
    Icon: ShieldIcon,
  },
  tax: {
    title: 'Tax optimization',
    desc: 'Maximize deductions, plan for tax-saving investments',
    Icon: TaxIcon,
  },
  retirement: {
    title: 'Retirement planning',
    desc: 'Set goals, calculate needs, build sustainable strategy',
    Icon: RetirementIcon,
  },
};

export interface GoalDetailsMap {
  [goalId: string]: {
    main: string;
    extra: string;
  };
}

interface GoalDetailsProps {
  selectedGoals: string[];
  goalDetails: GoalDetailsMap;
  onChange: (goalId: string, field: 'main' | 'extra', value: string) => void;
  darkMode: boolean;
  onNext: () => void;
  onBack: () => void;
}

export const GoalDetails: React.FC<GoalDetailsProps> = ({
  selectedGoals,
  goalDetails,
  onChange,
  darkMode,
  onNext,
  onBack,
}) => {
  const themeClasses = {
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    cardBgClass: darkMode ? 'bg-slate-800' : 'bg-white',
    borderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
  };

  const allRequiredFilled =
    selectedGoals.length > 0 &&
    selectedGoals.every(
      (id) => (goalDetails[id]?.main || '').trim().length > 0,
    );

  return (
    <div
      className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}
    >
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className={`text-3xl font-bold ${themeClasses.textClass} mb-2`}>
            Add a bit more context
          </h2>
          <p className={themeClasses.textSecondaryClass}>
            For each goal, tell Zoro what matters most (required) and anything
            else we should know (optional).
          </p>
        </div>

        <div className="space-y-6 mb-6">
          {selectedGoals.map((goalId) => {
            const config = GOAL_CONFIG[goalId];
            if (!config) return null;
            const { Icon, title, desc } = config;
            const detail = goalDetails[goalId] || { main: '', extra: '' };

            return (
              <div
                key={goalId}
                className={`${themeClasses.cardBgClass} border ${themeClasses.borderClass} rounded-xl p-6`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg ${
                      darkMode ? 'bg-slate-700' : 'bg-slate-100'
                    }`}
                  >
                    <Icon />
                  </div>
                  <div>
                    <h3
                      className={`text-lg font-semibold ${themeClasses.textClass} mb-1`}
                    >
                      {title}
                    </h3>
                    <p className={`text-sm ${themeClasses.textSecondaryClass}`}>
                      {desc}
                    </p>
                  </div>
                </div>

                {/* Required field */}
                <div className="mb-4">
                  <label className="flex flex-col">
                    <span
                      className={`text-sm ${themeClasses.textClass} mb-1`}
                    >
                      What do you want Zoro to help you with here?{' '}
                      <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={detail.main}
                      onChange={(e) =>
                        onChange(goalId, 'main', e.target.value)
                      }
                      rows={3}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        darkMode
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                      placeholder="e.g., Build a 6-month emergency fund in the next 18 months"
                    />
                  </label>
                </div>

                {/* Optional field */}
                <div>
                  <label className="flex flex-col">
                    <span
                      className={`text-sm ${themeClasses.textClass} mb-1`}
                    >
                      Any extra context or constraints?{' '}
                      <span className={themeClasses.textSecondaryClass}>
                        (optional)
                      </span>
                    </span>
                    <textarea
                      value={detail.extra}
                      onChange={(e) =>
                        onChange(goalId, 'extra', e.target.value)
                      }
                      rows={3}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        darkMode
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                      placeholder="e.g., I have irregular income; prefer conservative assumptions"
                    />
                  </label>
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
            disabled={!allRequiredFilled}
            className="flex-1"
          >
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
};


