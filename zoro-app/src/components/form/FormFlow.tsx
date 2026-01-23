'use client';

import React from 'react';
import { ProgressIndicator } from '@/components/ui/ProgressIndicator';
import { QuestionCard } from './QuestionCard';
import { Button } from '@/components/ui/Button';
import { Question, FormAnswers } from '@/types';
import { ANIMATION_DELAYS } from '@/constants';

interface FormFlowProps {
  questions: Question[];
  currentStep: number;
  answers: FormAnswers;
  darkMode: boolean;
  onAnswerSelect: (value: string) => void;
  onBack: () => void;
}

export const FormFlow: React.FC<FormFlowProps> = ({
  questions,
  currentStep,
  answers,
  darkMode,
  onAnswerSelect,
  onBack
}) => {
  const currentQuestion = questions[currentStep];
  const themeClasses = {
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
  };

  const handleAnswerSelect = (value: string) => {
    onAnswerSelect(value);
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Progress */}
          <ProgressIndicator currentStep={currentStep} totalSteps={questions.length} />

          <h2 className={`text-3xl font-bold ${themeClasses.textClass} mb-2`}>
            {currentQuestion.question}
          </h2>
          <p className={themeClasses.textSecondaryClass}>
            Question {currentStep + 1} of {questions.length}
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {currentQuestion.options.map((option) => (
            <QuestionCard
              key={option.value}
              option={option}
              isSelected={answers[currentQuestion.id as keyof FormAnswers] === option.value}
              darkMode={darkMode}
              onClick={() => handleAnswerSelect(option.value)}
            />
          ))}
        </div>

        {currentStep > 0 && (
          <Button
            variant="ghost"
            darkMode={darkMode}
            onClick={onBack}
            className="w-full"
          >
            ← Go back
          </Button>
        )}
      </div>
    </div>
  );
};

