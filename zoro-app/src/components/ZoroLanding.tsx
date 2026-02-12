 'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TypingLoader } from '@/components/TypingLoader';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { LandingPage } from '@/components/landing/LandingPage';
import { GoalSelection } from '@/components/form/GoalSelection';
import { GoalDetails, GoalDetailsMap } from '@/components/form/GoalDetails';
import { ContactMethodSelection } from '@/components/form/ContactMethodSelection';
import { FormReview } from '@/components/form/FormReview';
import { FormSuccess } from '@/components/form/FormSuccess';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ContactMethod } from '@/types';

const ZoroLanding = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [goalDetails, setGoalDetails] = useState<GoalDetailsMap>({});
  const [showGoalDetails, setShowGoalDetails] = useState(false);
  const [showContactMethod, setShowContactMethod] = useState(false);
  const [name, setName] = useState('');
  const [netWorth, setNetWorth] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod | ''>('');
  const [showReview, setShowReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFormIntro, setShowFormIntro] = useState(false);

  const resetForm = useCallback(() => {
    setShowForm(false);
    setShowFormIntro(false);
    setShowReview(false);
    setShowGoalDetails(false);
    setShowContactMethod(false);
    setSubmitted(false);
    setShowSuccess(false);
    setSelectedGoals([]);
    setGoalDetails({});
    setName('');
    setNetWorth('');
    setPhone('');
    setCountryCode('+91');
    setAdditionalInfo('');
    setContactMethod('');
    setContactEmail('');
  }, []);

  const handleGoalToggle = useCallback((goalId: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(id => id !== goalId);
      } else if (prev.length < 3) {
        return [...prev, goalId];
      }
      return prev;
    });
  }, []);

  const handleNext = useCallback(() => {
    if (selectedGoals.length > 0 && selectedGoals.length <= 3) {
      setShowGoalDetails(true);
      setShowContactMethod(false);
    }
  }, [selectedGoals]);

  const handleGoalDetailsChange = useCallback(
    (
      goalId: string,
      field: 'selections' | 'other',
      value: string[] | string,
    ) => {
      setGoalDetails((prev) => ({
        ...prev,
        [goalId]: {
          selections:
            field === 'selections'
              ? (value as string[])
              : prev[goalId]?.selections || [],
          other:
            field === 'other'
              ? (value as string)
              : prev[goalId]?.other || '',
        },
      }));
    },
    [],
  );

  const handleGoalDetailsNext = useCallback(() => {
    if (selectedGoals.length > 0 && selectedGoals.length <= 3) {
      setShowGoalDetails(false);
      setShowContactMethod(true);
    }
  }, [selectedGoals]);

  const handlePhoneSubmit = useCallback(() => {
    setContactMethod('whatsapp');
    setShowReview(true);
  }, []);

  const handleEmailAuthSuccess = useCallback(() => {
    setContactMethod('email');
    setShowReview(true);
  }, []);

  const handleFinalSubmit = useCallback(async () => {
    if (!contactMethod) return;

    setIsSubmitting(true);
    try {
      const formData = {
        goals: selectedGoals,
        goalDetails,
        name,
        netWorth,
        phone: contactMethod === 'whatsapp' ? countryCode + phone : null,
        contactMethod,
        additionalInfo,
        email: contactEmail || null,
        userId: null,
      };

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit form');
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(error instanceof Error ? error.message : 'There was an error submitting your form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedGoals,
    goalDetails,
    name,
    netWorth,
    phone,
    countryCode,
    contactMethod,
    additionalInfo,
    contactEmail,
  ]);

  const handleGetStarted = useCallback(() => {
    setShowForm(true);
    setShowFormIntro(true);
  }, []);

  const handleEdit = useCallback(() => {
    setShowReview(false);
  }, []);

  if (isSubmitting || (submitted && !showSuccess)) {
    return (
      <TypingLoader
        darkMode={darkMode}
        onComplete={() => {
          setShowSuccess(true);
        }}
      />
    );
  }

  if (showForm && showFormIntro) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className="flex flex-col items-center justify-center">
          <AnimatedZoroLogo
            className="h-32 md:h-48 lg:h-64"
            isDark={darkMode}
            onAnimationComplete={() => {
              setShowFormIntro(false);
            }}
          />
        </div>
      </div>
    );
  }

  if (submitted && showSuccess && contactMethod) {
    return (
      <FormSuccess
        phone={phone}
        countryCode={countryCode}
        contactMethod={contactMethod as ContactMethod}
        darkMode={darkMode}
        onBackToHome={resetForm}
      />
    );
  }

  if (showReview && contactMethod) {
    return (
      <FormReview
        goals={selectedGoals}
        name={name}
        netWorth={netWorth}
        phone={phone}
        countryCode={countryCode}
        contactMethod={contactMethod as ContactMethod}
        additionalInfo={additionalInfo}
        userEmail={contactEmail}
        darkMode={darkMode}
        isSubmitting={isSubmitting}
        onEdit={handleEdit}
        onBack={() => {
          setShowReview(false);
        }}
        onSubmit={handleFinalSubmit}
      />
    );
  }

  if (showForm && showGoalDetails && !showReview) {
    return (
      <GoalDetails
        selectedGoals={selectedGoals}
        goalDetails={goalDetails}
        onChange={handleGoalDetailsChange}
        darkMode={darkMode}
        onNext={handleGoalDetailsNext}
        onBack={() => {
          setShowGoalDetails(false);
        }}
      />
    );
  }

  if (showForm && showContactMethod && selectedGoals.length > 0 && selectedGoals.length <= 3 && !showReview) {
    return (
      <ContactMethodSelection
        name={name}
        netWorth={netWorth}
        phone={phone}
        countryCode={countryCode}
        additionalInfo={additionalInfo}
        darkMode={darkMode}
        email={contactEmail}
        selectedGoals={selectedGoals}
        goalDetails={goalDetails}
        onNameChange={setName}
        onNetWorthChange={setNetWorth}
        onPhoneChange={setPhone}
        onCountryCodeChange={(code) => {
          setCountryCode(code);
        }}
        onAdditionalInfoChange={setAdditionalInfo}
        onWhatsAppSubmit={handlePhoneSubmit}
        onEmailAuthSuccess={handleEmailAuthSuccess}
        onEmailChange={setContactEmail}
        onBack={() => {
          setShowContactMethod(false);
        }}
        onRestart={() => {
          setSelectedGoals([]);
          setShowContactMethod(false);
          setPhone('');
          setCountryCode('+91');
          setAdditionalInfo('');
          setContactEmail('');
        }}
        onGoHome={resetForm}
      />
    );
  }

  if (showForm && !showFormIntro && !showReview && !showGoalDetails && !showContactMethod) {
    return (
      <GoalSelection
        selectedGoals={selectedGoals}
        onGoalToggle={handleGoalToggle}
        darkMode={darkMode}
        onNext={handleNext}
        onBack={() => {
          setShowForm(false);
        }}
      />
    );
  }

  return (
    <LandingPage
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
      onShowPhilosophy={() => router.push('/philosophy')}
      onGetStarted={handleGetStarted}
    />
  );
};

export default ZoroLanding;
