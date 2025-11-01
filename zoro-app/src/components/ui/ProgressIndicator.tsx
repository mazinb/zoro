'use client';

import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps
}) => {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: totalSteps }).map((_, idx) => (
        <div
          key={idx}
          className={`h-1.5 rounded-full transition-all ${
            idx <= currentStep ? 'bg-blue-600 w-12' : 'bg-slate-300 w-8'
          }`}
          aria-label={`Step ${idx + 1} of ${totalSteps}`}
        />
      ))}
    </div>
  );
};

