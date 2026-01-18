'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ZoroLogo } from '@/components/ZoroLogo';
import { ContactMethod } from '@/types';

const goalLabels: Record<string, string> = {
  save: "Save more consistently",
  invest: "Invest smarter",
  home: "Plan for big purchases",
  insurance: "Review insurance",
  tax: "Tax optimization",
  retirement: "Retirement planning",
};

interface FormReviewProps {
  goals: string[];
  name: string;
  netWorth: string;
  phone: string;
  countryCode: string;
  contactMethod: ContactMethod;
  additionalInfo: string;
  userEmail?: string;
  darkMode: boolean;
  isSubmitting: boolean;
  onEdit: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

export const FormReview: React.FC<FormReviewProps> = ({
  goals,
  name,
  netWorth,
  phone,
  countryCode,
  contactMethod,
  additionalInfo,
  userEmail,
  darkMode,
  isSubmitting,
  onEdit,
  onBack,
  onSubmit
}) => {
  const themeClasses = {
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    borderClass: darkMode ? 'border-slate-800' : 'border-slate-100',
    cardBorderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center mb-4`}>
            <ZoroLogo className="h-10" isDark={darkMode} />
          </div>
          <h2 className={`text-2xl font-bold ${themeClasses.textClass} mb-2`}>
            Review your answers
          </h2>
          <p className={themeClasses.textSecondaryClass}>
            Make sure everything looks good before we send your personalized plan
          </p>
        </div>

        <Card darkMode={darkMode} className="p-8 shadow-lg mb-6">
          <div className="space-y-6">
            {/* Name & Net worth */}
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-2">
                <div>
                  <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Name</p>
                  <p className={`font-semibold ${themeClasses.textClass}`}>{name}</p>
                </div>
                <div>
                  <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Approximate net worth</p>
                  <p className={`font-semibold ${themeClasses.textClass}`}>
                    {netWorth === 'under50L' && 'Under ₹50 Lakhs'}
                    {netWorth === '50L-1Cr' && '₹50L – ₹1 Crore'}
                    {netWorth === '1Cr-10Cr' && '₹1 Crore – ₹10 Crore'}
                    {netWorth === 'over10Cr' && 'Over ₹10 Crore'}
                    {!['under50L', '50L-1Cr', '1Cr-10Cr', 'over10Cr'].includes(netWorth) && netWorth}
                  </p>
                </div>
              </div>
            </div>
            <div className={`h-px ${themeClasses.borderClass}`}></div>

            {/* Goals */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className={`text-sm ${themeClasses.textSecondaryClass} mb-2`}>Financial Goals</p>
                <div className="flex flex-wrap gap-2">
                  {goals.map((goalId) => (
                    <span
                      key={goalId}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${darkMode
                          ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                    >
                      {goalLabels[goalId] || goalId}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={onEdit}
                className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                aria-label="Edit goals"
              >
                Edit
              </button>
            </div>
            <div className={`h-px ${themeClasses.borderClass}`}></div>

            {/* Email Address */}
            {userEmail && (
              <>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Email address</p>
                    <p className={`font-semibold ${themeClasses.textClass}`}>
                      {userEmail}
                    </p>
                  </div>
                </div>
                <div className={`h-px ${themeClasses.borderClass}`}></div>
              </>
            )}

            {/* Contact Method */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Communication preference</p>
                <p className={`font-semibold ${themeClasses.textClass}`}>
                  {contactMethod === 'whatsapp'
                    ? `WhatsApp: ${countryCode} ${phone}`
                    : `Email${userEmail ? `: ${userEmail}` : ''}`}
                </p>
              </div>
              <button
                onClick={onEdit}
                className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                aria-label="Edit communication preference"
              >
                Edit
              </button>
            </div>

            <div className={`h-px ${themeClasses.borderClass}`}></div>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Additional information</p>
                <p className={`${themeClasses.textClass} text-sm`}>{additionalInfo || <span className={themeClasses.textSecondaryClass}>No additional information provided</span>}</p>
              </div>
              <button
                onClick={onEdit}
                className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                aria-label="Edit additional information"
              >
                Edit
              </button>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="secondary"
            darkMode={darkMode}
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1"
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            darkMode={darkMode}
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : (
              <>
                Submit
                <Check className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>

        <p className={`text-xs ${themeClasses.textSecondaryClass} text-center mt-6 italic`}>
          🔒 Your information is secure and will never be shared
        </p>
      </div>
    </div>
  );
};

