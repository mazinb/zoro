'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RetirementResult, Answers } from '../types';
import { formatCurrency } from '../utils';

interface AdditionalCostsSectionProps {
  darkMode: boolean;
  result: RetirementResult;
  answers: Answers;
  housingCost: number | null;
  healthcareCost: number | null;
  travelCost: number | null;
  emergencyFund: number | null;
  showHousing: boolean;
  showHealthcare: boolean;
  showTravel: boolean;
  showEmergencyFund: boolean;
  onToggleHousing: () => void;
  onToggleHealthcare: () => void;
  onToggleTravel: () => void;
  onToggleEmergencyFund: () => void;
  onHousingChange: (value: number) => void;
  onHealthcareChange: (value: number) => void;
  onTravelChange: (value: number) => void;
  onEmergencyFundChange: (value: number) => void;
}

export const AdditionalCostsSection: React.FC<AdditionalCostsSectionProps> = ({
  darkMode,
  result,
  answers,
  housingCost,
  healthcareCost,
  travelCost,
  emergencyFund,
  showHousing,
  showHealthcare,
  showTravel,
  showEmergencyFund,
  onToggleHousing,
  onToggleHealthcare,
  onToggleTravel,
  onToggleEmergencyFund,
  onHousingChange,
  onHealthcareChange,
  onTravelChange,
  onEmergencyFundChange,
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="space-y-3 mb-6 md:mb-8">
      {/* Housing */}
      {housingCost !== null && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
          <button
            onClick={onToggleHousing}
            className="w-full flex justify-between items-center"
          >
            <span className={`font-medium ${theme.textClass}`}>Housing</span>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold ${housingCost === 0 ? 'text-gray-400' : 'text-blue-500'}`}>
                {housingCost === 0 ? 'Owned (No cost)' : formatCurrency(housingCost, result.currency) + '/month'}
              </span>
              <svg 
                className={`w-5 h-5 transition-transform ${showHousing ? 'rotate-180' : ''} ${theme.textClass}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showHousing && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className={`text-sm mb-3 ${theme.textSecondaryClass}`}>
                {answers.housing === 'own_paid' 
                  ? 'You own your home, so there are no monthly housing costs.'
                  : `Based on your selection: ${answers.housing?.replace(/_/g, ' ')}`}
              </p>
              {housingCost !== 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={housingCost}
                    onChange={(e) => onHousingChange(parseFloat(e.target.value) || 0)}
                    className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                      darkMode 
                        ? 'bg-slate-800 border border-slate-600 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <span className={`text-sm ${theme.textClass}`}>/month</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Healthcare */}
      {healthcareCost !== null && healthcareCost > 0 && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
          <button
            onClick={onToggleHealthcare}
            className="w-full flex justify-between items-center"
          >
            <span className={`font-medium ${theme.textClass}`}>Healthcare</span>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold text-blue-500`}>
                {formatCurrency(healthcareCost, result.currency)}/month
              </span>
              <svg 
                className={`w-5 h-5 transition-transform ${showHealthcare ? 'rotate-180' : ''} ${theme.textClass}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showHealthcare && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className={`text-sm mb-3 ${theme.textSecondaryClass}`}>
                Based on your selection: {answers.healthcare?.replace(/_/g, ' ')}. 
                <span className="font-medium"> Note: Healthcare costs typically increase in retirement.</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={healthcareCost}
                  onChange={(e) => onHealthcareChange(parseFloat(e.target.value) || 0)}
                  className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                    darkMode 
                      ? 'bg-slate-800 border border-slate-600 text-gray-100' 
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <span className={`text-sm ${theme.textClass}`}>/month</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Travel */}
      {travelCost !== null && travelCost > 0 && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
          <button
            onClick={onToggleTravel}
            className="w-full flex justify-between items-center"
          >
            <span className={`font-medium ${theme.textClass}`}>Travel</span>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold text-blue-500`}>
                {formatCurrency(travelCost, result.currency)}/month
              </span>
              <svg 
                className={`w-5 h-5 transition-transform ${showTravel ? 'rotate-180' : ''} ${theme.textClass}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showTravel && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className={`text-sm mb-3 ${theme.textSecondaryClass}`}>
                Based on your travel frequency: {answers.travel?.replace(/_/g, ' ')}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={travelCost}
                  onChange={(e) => onTravelChange(parseFloat(e.target.value) || 0)}
                  className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                    darkMode 
                      ? 'bg-slate-800 border border-slate-600 text-gray-100' 
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <span className={`text-sm ${theme.textClass}`}>/month</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emergency Fund */}
      {emergencyFund !== null && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
          <button
            onClick={onToggleEmergencyFund}
            className="w-full flex justify-between items-center"
          >
            <span className={`font-medium ${theme.textClass}`}>Emergency Fund</span>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold text-blue-500`}>
                {formatCurrency(emergencyFund, result.currency)}
              </span>
              <svg 
                className={`w-5 h-5 transition-transform ${showEmergencyFund ? 'rotate-180' : ''} ${theme.textClass}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showEmergencyFund && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className={`text-sm mb-3 ${theme.textSecondaryClass}`}>
                Emergency fund (one-time amount) - Pre-set to 10% of your retirement corpus. Adjust as needed.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={emergencyFund}
                  onChange={(e) => onEmergencyFundChange(parseFloat(e.target.value) || 0)}
                  className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                    darkMode 
                      ? 'bg-slate-800 border border-slate-600 text-gray-100' 
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <span className={`text-sm ${theme.textClass}`}>one-time</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

