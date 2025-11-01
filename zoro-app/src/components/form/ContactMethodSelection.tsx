'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { COUNTRIES } from '@/constants';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';

interface ContactMethodSelectionProps {
  phone: string;
  countryCode: string;
  additionalInfo: string;
  darkMode: boolean;
  onPhoneChange: (phone: string) => void;
  onCountryCodeChange: (code: string) => void;
  onAdditionalInfoChange: (info: string) => void;
  onWhatsAppSubmit: () => void;
  onGoogleSubmit: () => void;
  onBack: () => void;
  onRestart: () => void;
  onGoHome: () => void;
}

export const ContactMethodSelection: React.FC<ContactMethodSelectionProps> = ({
  phone,
  countryCode,
  additionalInfo,
  darkMode,
  onPhoneChange,
  onCountryCodeChange,
  onAdditionalInfoChange,
  onWhatsAppSubmit,
  onGoogleSubmit,
  onBack,
  onRestart,
  onGoHome
}) => {
  const [phoneError, setPhoneError] = useState('');
  const { validatePhone } = usePhoneValidation(countryCode);
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
          <div className={`inline-flex items-center gap-2 mb-4`}>
            <span className={`text-3xl font-bold ${themeClasses.textClass}`}>Zoro</span>
          </div>
          <h2 className={`text-2xl font-bold ${themeClasses.textClass} mb-2`}>
            How should we reach you?
          </h2>
          <p className={`${themeClasses.textSecondaryClass} mb-1`}>
            You're in control - choose your preferred method
          </p>
          <p className={`text-sm ${themeClasses.textSecondaryClass} italic`}>
            We'll only message when you want us to
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* WhatsApp Option */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24" aria-label="WhatsApp icon">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <h3 className={`font-semibold ${themeClasses.textClass} text-lg`}>WhatsApp</h3>
            </div>
            
            <div className="flex gap-2 mb-3">
              <select
                value={countryCode}
                onChange={(e) => {
                  onCountryCodeChange(e.target.value);
                  setPhoneError('');
                }}
                className={`px-3 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base`}
                aria-label="Country code"
              >
                {COUNTRIES.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                placeholder="9876543210"
                className={`flex-1 px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${phoneError ? 'border-red-500' : ''}`}
                aria-label="Phone number"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? 'phone-error' : undefined}
              />
            </div>
            
            {phoneError && (
              <p id="phone-error" className="text-red-500 text-sm mb-3" role="alert">
                {phoneError}
              </p>
            )}
            
            <Button
              variant="primary"
              darkMode={darkMode}
              showArrow
              onClick={handlePhoneSubmit}
              className="w-full"
            >
              Continue with WhatsApp
            </Button>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className={`flex-1 h-px ${themeClasses.borderClass}`}></div>
            <span className={`text-sm ${themeClasses.textSecondaryClass}`}>or</span>
            <div className={`flex-1 h-px ${themeClasses.borderClass}`}></div>
          </div>

          {/* Google/Email Option */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6" viewBox="0 0 24 24" aria-label="Google icon">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <h3 className={`font-semibold ${themeClasses.textClass} text-lg`}>Email via Google</h3>
            </div>
            <Button
              variant="secondary"
              darkMode={darkMode}
              showArrow
              onClick={onGoogleSubmit}
              className="w-full"
            >
              Continue with Google
            </Button>
            <p className={`text-xs ${themeClasses.textSecondaryClass} mt-3 text-center`}>
              We'll use your Google email to send updates
            </p>
          </Card>

          {/* Optional Additional Info */}
          <Card darkMode={darkMode} className="p-6 shadow-lg">
            <h3 className={`font-semibold ${themeClasses.textClass} mb-2`}>
              Anything else we should know? (Optional)
            </h3>
            <p className={`text-sm ${themeClasses.textSecondaryClass} mb-3`}>
              Share any additional context about your financial situation or goals
            </p>
            <textarea
              value={additionalInfo}
              onChange={(e) => onAdditionalInfoChange(e.target.value)}
              placeholder="e.g., Planning to retire early, concerned about children's education, managing family business..."
              className={`w-full px-4 py-3 border ${themeClasses.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-none`}
              rows={4}
              aria-label="Additional information"
            />
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
          🔒 Your privacy matters. We never spam or share your information.
        </p>
      </div>
    </div>
  );
};

