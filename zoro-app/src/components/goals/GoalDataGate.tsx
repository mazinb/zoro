'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import {
  type GoalId,
  type GoalDataType,
  type UserDataRow,
  getRequiredDataForGoal,
  getDataFilled,
  GOAL_TITLES,
} from '@/lib/goalDataConfig';
import { Button } from '@/components/ui/Button';

export type ThemeClasses = {
  bgClass?: string;
  textClass: string;
  textSecondaryClass: string;
  borderClass?: string;
  cardBorderClass?: string;
  cardBgClass?: string;
  accentBgClass?: string;
};

const DATA_LABELS: Record<GoalDataType, string> = {
  expenses: 'Estimated expenses',
  assets: 'Assets & accounts',
  income: 'Income',
};

const DATA_PATHS: Record<GoalDataType, string> = {
  expenses: '/expenses',
  assets: '/assets',
  income: '/income',
};

interface GoalDataGateProps {
  goalId: GoalId;
  userData: UserDataRow | null | undefined;
  token: string | null;
  userName?: string | null;
  darkMode: boolean;
  theme: ThemeClasses;
  onContinue: () => void;
}

export function GoalDataGate({
  goalId,
  userData,
  token,
  userName,
  darkMode,
  theme,
  onContinue,
}: GoalDataGateProps) {
  const required = getRequiredDataForGoal(goalId);
  const filled = getDataFilled(userData);
  const goalTitle = GOAL_TITLES[goalId] ?? goalId;

  if (required.length === 0) {
    return null;
  }

  const buildDataUrl = (path: string) => {
    const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : '');
    if (token) url.searchParams.set('token', token);
    if (userName?.trim()) url.searchParams.set('name', userName.trim());
    return url.pathname + url.search;
  };

  return (
    <div className={`max-w-2xl mx-auto ${theme.bgClass} transition-colors duration-300`}>
      <div className={`border ${theme.cardBorderClass} ${theme.cardBgClass} rounded-2xl p-8`}>
        <h2 className={`text-2xl font-light mb-2 ${theme.textClass}`}>
          Data needed for {goalTitle}
        </h2>
        <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
          We use this to personalize your plan. Fill in the sections below, or open them to update. Then continue to the form.
        </p>

        <ul className="space-y-4 mb-8">
          {required.map((dataType) => {
            const isFilled = filled[dataType];
            const path = DATA_PATHS[dataType];
            const label = DATA_LABELS[dataType];
            const href = buildDataUrl(path);

            return (
              <li
                key={dataType}
                className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass}`}
              >
                <div className="flex items-center gap-3">
                  {isFilled ? (
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-600 dark:text-green-400" aria-hidden>
                      <Check className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${theme.accentBgClass} ${theme.textSecondaryClass}`} aria-hidden>
                      —
                    </span>
                  )}
                  <span className={`font-medium ${theme.textClass}`}>{label}</span>
                  <span className={`text-sm ${theme.textSecondaryClass}`}>
                    {isFilled ? 'Filled' : 'Not filled'}
                  </span>
                </div>
                <Link
                  href={href}
                  className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${theme.textSecondaryClass} hover:${theme.textClass}`}
                >
                  {isFilled ? 'Open' : 'Fill'}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="primary" darkMode={darkMode} onClick={onContinue}>
            Continue to {goalTitle} form
          </Button>
          <Button variant="ghost" darkMode={darkMode} onClick={onContinue}>
            I&apos;ve already filled these
          </Button>
        </div>
      </div>
    </div>
  );
}
