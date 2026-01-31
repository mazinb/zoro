'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ContactMethod } from '@/types';

interface FormSuccessProps {
  phone: string;
  countryCode: string;
  contactMethod: ContactMethod;
  darkMode: boolean;
  onBackToHome: () => void;
}

export const FormSuccess: React.FC<FormSuccessProps> = ({
  phone,
  countryCode,
  contactMethod,
  darkMode,
  onBackToHome
}) => {
  const themeClasses = {
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    cardBgClass: darkMode ? 'bg-slate-800' : 'bg-white',
    cardBorderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-md w-full text-center animate-fadeIn">
        <Card darkMode={darkMode} className="p-8 shadow-lg mb-6">
          {/* Success Ticket */}
          <div className="mb-6">
            <div className="bg-green-500 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center animate-bounce">
              <Check className="w-10 h-10 text-white" aria-hidden="true" />
            </div>
          </div>
          
          <h2 className={`text-3xl font-bold ${themeClasses.textClass} mb-4`}>
            You're all set! 🎉
          </h2>
          <p className={`text-lg ${themeClasses.textSecondaryClass} mb-2`}>
            {contactMethod === 'whatsapp' 
              ? "We'll message you on WhatsApp shortly with your personalized financial plan."
              : "We'll email you shortly with your personalized financial plan."}
          </p>
          <p className={`text-sm ${themeClasses.textSecondaryClass} mb-8`}>
            {contactMethod === 'whatsapp' 
              ? `Check ${countryCode} ${phone} for updates` 
              : 'Check your email inbox for updates'}
          </p>
          
          <Button
            variant="primary"
            darkMode={darkMode}
            onClick={onBackToHome}
          >
            ← Back to home
          </Button>
        </Card>
      </div>
    </div>
  );
};

