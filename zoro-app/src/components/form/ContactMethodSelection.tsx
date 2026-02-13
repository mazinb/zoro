'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { COUNTRIES } from '@/constants';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';
// removed inline auth in favor of simple email capture for non-logged-in users

interface ContactMethodSelectionProps {
  name: string;
  netWorth: string;
  phone: string;
  countryCode: string;
  additionalInfo: string;
  darkMode: boolean;
  userEmail?: string;
  isLoggedIn?: boolean;
  email?: string;
  selectedGoals?: string[];
  goalDetails?: Record<string, { selections: string[]; other?: string }>;
  onNameChange: (name: string) => void;
  onNetWorthChange: (value: string) => void;
  onEmailChange?: (email: string) => void;
  onPhoneChange: (phone: string) => void;
  onCountryCodeChange: (code: string) => void;
  onAdditionalInfoChange: (info: string) => void;
  onWhatsAppSubmit: () => void;
  onEmailAuthSuccess: () => void;
  onBack: () => void;
  onRestart: () => void;
  onGoHome: () => void;
}

export const ContactMethodSelection: React.FC<ContactMethodSelectionProps> = ({
  name,
  netWorth,
  phone,
  countryCode,
  additionalInfo,
  darkMode,
  userEmail,
  isLoggedIn = false,
  email = '',
  selectedGoals = [],
  goalDetails = {},
  onNameChange,
  onNetWorthChange,
  onEmailChange,
  onPhoneChange,
  onCountryCodeChange,
  onAdditionalInfoChange,
  onWhatsAppSubmit,
  onEmailAuthSuccess,
  onBack,
  onRestart,
  onGoHome
}) => {
  const [nameError, setNameError] = useState('');
  const [netWorthError, setNetWorthError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [additionalInfoError, setAdditionalInfoError] = useState('');
  const [emailError, setEmailError] = useState('');
  const { validatePhone } = usePhoneValidation(countryCode);

  // Validate additional info has at least 3 words
  const validateAdditionalInfo = (info: string): boolean => {
    const trimmed = info.trim();
    if (!trimmed) {
      setAdditionalInfoError('We need more information to understand you');
      return false;
    }
    const words = trimmed.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 3) {
      setAdditionalInfoError('We need more information to understand you');
      return false;
    }
    setAdditionalInfoError('');
    return true;
  };

  const handleAdditionalInfoChange = (value: string) => {
    onAdditionalInfoChange(value);
    if (additionalInfoError) {
      validateAdditionalInfo(value);
    }
  };
  const handleEmailChange = (value: string) => {
    onEmailChange && onEmailChange(value);
    setEmailError('');
  };

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError('Please tell us your name');
      return false;
    }
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      setNameError('Name can only include letters and numbers');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateNetWorth = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNetWorthError('Please select an approximate net worth range');
      return false;
    }
    setNetWorthError('');
    return true;
  };

  const validateEmail = (value: string, required = false): boolean => {
    const trimmed = value.trim();
    if (!trimmed && !required) {
      setEmailError('');
      return true;
    }
    // basic email regex
    const ok = /.+@.+\..+/.test(trimmed);
    if (!ok) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };
  const themeClasses = {
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    borderClass: darkMode ? 'border-slate-800' : 'border-slate-100',
    inputBgClass: darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900',
    cardBorderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    onPhoneChange(digits);
    setPhoneError('');
  };

  const handlePhoneSubmit = () => {
    const validation = validatePhone(phone);
    if (validation.isValid) {
      onWhatsAppSubmit();
    } else {
      setPhoneError(validation.error);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-bold ${themeClasses.textClass} mb-2`}>
            A few final details
          </h2>
          <p className={`${themeClasses.textSecondaryClass} mb-1`}>
            We use this information to personalize your emails.
          </p>
          <p className={`text-sm ${themeClasses.textSecondaryClass} italic`}>
            We'll never share your data or spam you.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* Name & Net worth */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <h3 className={`font-semibold ${themeClasses.textClass} mb-2`}>
              About you
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex flex-col">
                  <span className={`text-sm ${themeClasses.textClass} mb-1`}>
                    Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      onNameChange(e.target.value);
                      setNameError('');
                    }}
                    onBlur={(e) => validateName(e.target.value)}
                    className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${nameError ? 'border-red-500' : ''}`}
                    placeholder="Your name"
                  />
                  <p className={`text-xs ${themeClasses.textSecondaryClass} mt-2`}>
                    Used to generate your personal email address. Letters and numbers only.
                  </p>
                  {nameError && (
                    <p className="text-red-500 text-sm mt-1" role="alert">
                      {nameError}
                    </p>
                  )}
                </label>
              </div>
              <div>
                <label className="flex flex-col">
                  <span className={`text-sm ${themeClasses.textClass} mb-1`}>
                    Approximate net worth <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={netWorth}
                    onChange={(e) => {
                      onNetWorthChange(e.target.value);
                      setNetWorthError('');
                    }}
                    onBlur={(e) => validateNetWorth(e.target.value)}
                    className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${netWorthError ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select a range</option>
                    <option value="under50L">Under ₹50 Lakhs</option>
                    <option value="50L-1Cr">₹50L – ₹1 Crore</option>
                    <option value="1Cr-10Cr">₹1 Crore – ₹10 Crore</option>
                    <option value="over10Cr">Over ₹10 Crore</option>
                    <option value="do_not_know">Do not know</option>
                  </select>
                  {netWorthError && (
                    <p className="text-red-500 text-sm mt-1" role="alert">
                      {netWorthError}
                    </p>
                  )}
                </label>
              </div>
            </div>
          </Card>

          {/* Required Additional Info */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <h3 className={`font-semibold ${themeClasses.textClass} mb-2`}>
              Anything else we should know? <span className="text-red-500">*</span>
            </h3>
            <p className={`text-sm ${themeClasses.textSecondaryClass} mb-3`}>
              Share any additional context about your financial situation or goals
            </p>
            <textarea
              value={additionalInfo}
              onChange={(e) => handleAdditionalInfoChange(e.target.value)}
              onBlur={(e) => validateAdditionalInfo(e.target.value)}
              required
              placeholder="e.g., Planning to retire early, concerned about children's education, managing family business..."
              className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-none ${additionalInfoError ? 'border-red-500' : ''}`}
              rows={4}
              aria-label="Additional information"
              aria-required="true"
              aria-invalid={!!additionalInfoError}
              aria-describedby={additionalInfoError ? 'additional-info-error' : undefined}
            />
            {additionalInfoError && (
              <p id="additional-info-error" className="text-red-500 text-sm mt-2" role="alert">
                {additionalInfoError}
              </p>
            )}
          </Card>

          {/* Email Option - Second */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Mail className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <h3 className={`font-semibold ${themeClasses.textClass} text-lg`}>Email</h3>
            </div>
            {isLoggedIn && userEmail ? (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className={`text-sm ${themeClasses.textClass} mb-1`}>Logged in as:</p>
                <p className={`font-medium ${themeClasses.textClass}`}>{userEmail}</p>
                <p className={`text-xs ${themeClasses.textSecondaryClass} mt-2`}>Using email for communication</p>
                <Button
                  variant="primary"
                  darkMode={darkMode}
                  onClick={() => {
                    if (validateAdditionalInfo(additionalInfo)) {
                      onEmailAuthSuccess();
                    }
                  }}
                  className="w-full mt-4"
                  showArrow
                >
                  Continue with Email
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        validateEmail(e.target.value);
                      }
                    }}
                    placeholder="your@email.com"
                    className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${emailError ? 'border-red-500' : ''}`}
                    aria-label="Email address"
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'email-error' : undefined}
                  />
                  {emailError && (
                    <p id="email-error" className="text-red-500 text-sm mt-2" role="alert">
                      {emailError}
                    </p>
                  )}
                </div>
                <Button
                  variant="primary"
                  darkMode={darkMode}
                  onClick={() => {
                    const okName = validateName(name);
                    const okNetWorth = validateNetWorth(netWorth);
                    const okInfo = validateAdditionalInfo(additionalInfo);
                    const okEmail = validateEmail(email, true);

                    if (!okName || !okNetWorth || !okInfo || !okEmail) {
                      return;
                    }

                    onEmailAuthSuccess();
                  }}
                  className="w-full"
                  showArrow
                >
                  Continue with Email
                </Button>
              </>
            )}
          </Card>

        </div>

        {/* Navigation Options */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            onClick={onBack}
            className={`${themeClasses.textSecondaryClass} hover:${themeClasses.textClass} text-sm transition-colors`}
          >
            ← Previous
          </button>
          <span className={`text-sm ${themeClasses.textSecondaryClass}`}>•</span>
          <button
            onClick={onRestart}
            className={`${themeClasses.textSecondaryClass} hover:${themeClasses.textClass} text-sm transition-colors`}
          >
            Restart survey
          </button>
          <span className={`text-sm ${themeClasses.textSecondaryClass}`}>•</span>
          <button
            onClick={onGoHome}
            className={`${themeClasses.textSecondaryClass} hover:${themeClasses.textClass} text-sm transition-colors`}
          >
            Go home
          </button>
        </div>

        <p className={`text-xs ${themeClasses.textSecondaryClass} text-center mt-6 italic`}>
          🔒 We never spam or share your information.
        </p>
      </div>
    </div>
  );
};

