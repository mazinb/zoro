'use client';

import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ZoroLogo } from '@/components/ZoroLogo';
import { FormAnswers, ContactMethod } from '@/types';
import { Question } from '@/types';

interface FormReviewProps {
  answers: FormAnswers;
  phone: string;
  countryCode: string;
  contactMethod: ContactMethod;
  additionalInfo: string;
  questions: Question[];
  darkMode: boolean;
  isSubmitting: boolean;
  onEdit: (stepIndex: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export const FormReview: React.FC<FormReviewProps> = ({
  answers,
  phone,
  countryCode,
  contactMethod,
  additionalInfo,
  questions,
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

  const getAnswerLabel = (questionId: string, value: string): string => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return value;
    const option = question.options.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const answerKeys: Array<{ key: keyof FormAnswers; label: string; stepIndex: number }> = [
    { key: 'primaryGoal', label: 'Primary financial goal', stepIndex: 0 },
    { key: 'netWorth', label: 'Net worth', stepIndex: 1 },
    { key: 'estateStatus', label: 'Estate plan status', stepIndex: 2 },
    { key: 'timeHorizon', label: 'Planning timeline', stepIndex: 3 },
    { key: 'concernLevel', label: 'Primary concern', stepIndex: 4 },
  ];

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
            {answerKeys.map(({ key, label, stepIndex }) => (
              <React.Fragment key={key}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>{label}</p>
                    <p className={`font-semibold ${themeClasses.textClass}`}>
                      {getAnswerLabel(key, answers[key])}
                    </p>
                  </div>
                  <button
                    onClick={() => onEdit(stepIndex)}
                    className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                    aria-label={`Edit ${label}`}
                  >
                    Edit
                  </button>
                </div>
                <div className={`h-px ${themeClasses.borderClass}`}></div>
              </React.Fragment>
            ))}

            {/* Contact Method */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Contact method</p>
                <p className={`font-semibold ${themeClasses.textClass}`}>
                  {contactMethod === 'whatsapp' ? `WhatsApp: ${countryCode} ${phone}` : 'Email via Google'}
                </p>
              </div>
              <button
                onClick={() => onEdit(questions.length)}
                className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                aria-label="Edit contact method"
              >
                Edit
              </button>
            </div>

            {additionalInfo && (
              <>
                <div className={`h-px ${themeClasses.borderClass}`}></div>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className={`text-sm ${themeClasses.textSecondaryClass} mb-1`}>Additional information</p>
                    <p className={`${themeClasses.textClass} text-sm`}>{additionalInfo}</p>
                  </div>
                  <button
                    onClick={() => onEdit(questions.length)}
                    className={`text-blue-600 hover:text-blue-700 text-sm font-medium`}
                    aria-label="Edit additional information"
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
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

