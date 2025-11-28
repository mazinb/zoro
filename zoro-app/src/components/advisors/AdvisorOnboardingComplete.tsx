'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Goal icons (same as user goal selection)
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const InvestIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const TaxIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const RetirementIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
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

type CheckInFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

interface AdvisorOnboardingCompleteProps {
  advisorId: string;
  darkMode?: boolean;
  onComplete?: () => void;
}

export const AdvisorOnboardingComplete: React.FC<AdvisorOnboardingCompleteProps> = ({
  advisorId,
  darkMode = false,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<CheckInFrequency>('monthly');
  const [expertiseExplanation, setExpertiseExplanation] = useState('');
  const [explanationError, setExplanationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const themeClasses = {
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    cardBgClass: darkMode ? 'bg-slate-800' : 'bg-white',
    borderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
    inputBgClass: darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900',
  };

  const handleGoalToggle = (goalId: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(id => id !== goalId);
      } else if (prev.length < 6) {
        return [...prev, goalId];
      }
      return prev;
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (selectedGoals.length === 0) {
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 1) return;
    setStep((step - 1) as 1 | 2 | 3);
  };

  const validateExplanation = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) {
      setExplanationError('Please explain why you are the right advisor for these goals');
      return false;
    }
    const words = trimmed.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 20) {
      setExplanationError('Please provide at least 20 words explaining your expertise');
      return false;
    }
    setExplanationError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateExplanation(expertiseExplanation)) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const { data: { session } } = await (await import('@/lib/supabase-client')).supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/advisors/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          advisorId,
          checkInFrequency: frequency,
          selectedGoals,
          expertiseExplanation: expertiseExplanation.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save preferences');
      }

      setIsComplete(true);
      if (onComplete) {
        setTimeout(() => onComplete(), 2000);
      }
    } catch (error) {
      console.error('Error saving advisor preferences:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}>
        <Card darkMode={darkMode} className="p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="bg-green-500 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className={`text-2xl font-bold ${themeClasses.textClass} mb-4`}>
            Setup complete! 🎉
          </h2>
          <p className={themeClasses.textSecondaryClass}>
            Your advisor profile is now active. Clients can find you based on your expertise.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <ZoroLogo className="h-10 mx-auto mb-4" isDark={darkMode} />
          <h1 className={`text-3xl font-bold ${themeClasses.textClass} mb-2`}>
            Complete your advisor profile
          </h1>
          <p className={themeClasses.textSecondaryClass}>
            {step === 1 && 'Select the financial goals you can help clients with'}
            {step === 2 && 'Choose how often you want to send check-in updates'}
            {step === 3 && 'Explain why you are the right advisor for these goals'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step
                    ? 'w-8 bg-blue-600'
                    : s < step
                    ? 'w-2 bg-blue-400'
                    : 'w-2 bg-slate-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Goal Selection */}
        {step === 1 && (
          <Card darkMode={darkMode} className="p-8">
            <h2 className={`text-xl font-semibold ${themeClasses.textClass} mb-4`}>
              Select your areas of expertise
            </h2>
            <p className={`text-sm ${themeClasses.textSecondaryClass} mb-6`}>
              Choose all the financial goals you can help clients achieve. This helps us match you with the right clients.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {goals.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoals.includes(goal.id);
                return (
                  <div
                    key={goal.id}
                    onClick={() => handleGoalToggle(goal.id)}
                    className={`${themeClasses.cardBgClass} border-2 rounded-lg p-6 cursor-pointer transition-all relative ${
                      isSelected
                        ? darkMode
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-blue-600 bg-blue-50'
                        : themeClasses.borderClass
                    } hover:border-blue-500`}
                  >
                    {isSelected && (
                      <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        darkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
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

            {selectedGoals.length > 0 && (
              <p className={`text-sm mb-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {selectedGoals.length} area{selectedGoals.length !== 1 ? 's' : ''} selected
              </p>
            )}

            <div className="flex gap-4">
              <Button
                variant="ghost"
                darkMode={darkMode}
                onClick={handleBack}
                disabled={step === 1}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="primary"
                darkMode={darkMode}
                onClick={handleNext}
                disabled={selectedGoals.length === 0}
                className="flex-1"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Frequency Selection */}
        {step === 2 && (
          <Card darkMode={darkMode} className="p-8">
            <h2 className={`text-xl font-semibold ${themeClasses.textClass} mb-4`}>
              Check-in frequency
            </h2>
            <p className={`text-sm ${themeClasses.textSecondaryClass} mb-6`}>
              How often would you like to send check-in updates to your clients?
            </p>

            <div className="space-y-3 mb-6">
              {([
                { value: 'weekly' as CheckInFrequency, label: 'Weekly', desc: 'Every week' },
                { value: 'biweekly' as CheckInFrequency, label: 'Bi-weekly', desc: 'Every 2 weeks' },
                { value: 'monthly' as CheckInFrequency, label: 'Monthly', desc: 'Once a month' },
                { value: 'quarterly' as CheckInFrequency, label: 'Quarterly', desc: 'Every 3 months' },
              ]).map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    frequency === option.value
                      ? darkMode
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-blue-600 bg-blue-50'
                      : themeClasses.borderClass
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option.value}
                    checked={frequency === option.value}
                    onChange={(e) => setFrequency(e.target.value as CheckInFrequency)}
                    className="accent-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-5 h-5 ${frequency === option.value ? (darkMode ? 'text-blue-400' : 'text-blue-600') : themeClasses.textSecondaryClass}`} />
                      <span className={`font-semibold ${themeClasses.textClass}`}>{option.label}</span>
                    </div>
                    <p className={`text-sm ${themeClasses.textSecondaryClass}`}>{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                variant="ghost"
                darkMode={darkMode}
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="primary"
                darkMode={darkMode}
                onClick={handleNext}
                className="flex-1"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Expertise Explanation */}
        {step === 3 && (
          <Card darkMode={darkMode} className="p-8">
            <h2 className={`text-xl font-semibold ${themeClasses.textClass} mb-4`}>
              Why you are the right advisor
            </h2>
            <p className={`text-sm ${themeClasses.textSecondaryClass} mb-2`}>
              Explain why you are the right advisor for the goals you selected. This explanation will be used to match you with clients who need help with these areas.
            </p>
            <p className={`text-xs ${themeClasses.textSecondaryClass} mb-6 italic`}>
              Minimum 20 words. Be specific about your experience, qualifications, and approach.
            </p>

            <textarea
              value={expertiseExplanation}
              onChange={(e) => {
                setExpertiseExplanation(e.target.value);
                if (explanationError) {
                  validateExplanation(e.target.value);
                }
              }}
              onBlur={(e) => validateExplanation(e.target.value)}
              placeholder="For example: 'I have over 10 years of experience helping clients with retirement planning and tax optimization. I specialize in creating comprehensive financial plans that align with long-term goals while maximizing tax efficiency. My approach combines traditional investment strategies with modern portfolio management techniques...'"
              className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-none ${
                explanationError ? 'border-red-500' : ''
              }`}
              rows={8}
            />
            {explanationError && (
              <p className="text-red-500 text-sm mt-2" role="alert">
                {explanationError}
              </p>
            )}

            {submitError && (
              <p className="text-red-500 text-sm mt-2" role="alert">
                {submitError}
              </p>
            )}

            <div className="flex gap-4 mt-6">
              <Button
                variant="ghost"
                darkMode={darkMode}
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="primary"
                darkMode={darkMode}
                onClick={handleSubmit}
                disabled={isSubmitting || !expertiseExplanation.trim()}
                className="flex-1"
              >
                {isSubmitting ? 'Saving...' : 'Complete setup'}
                {!isSubmitting && <CheckCircle2 className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

