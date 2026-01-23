'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { LandingPage } from '@/components/landing/LandingPage';
import { PhilosophyPage } from '@/components/landing/PhilosophyPage';
import { GoalSelection } from '@/components/form/GoalSelection';
import { GoalDetails, GoalDetailsMap } from '@/components/form/GoalDetails';
import { ContactMethodSelection } from '@/components/form/ContactMethodSelection';
import { FormReview } from '@/components/form/FormReview';
import { FormSuccess } from '@/components/form/FormSuccess';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackPageView } from '@/lib/analytics';
import { ContactMethod } from '@/types';

const ZoroLanding = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user } = useAuth();
  const { trackClick } = useAnalytics();

  // Track Philosophy page view when it's shown
  const [showPhilosophy, setShowPhilosophy] = useState(false);
  useEffect(() => {
    if (showPhilosophy) {
      trackPageView('philosophy');
    }
  }, [showPhilosophy]);

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
    (goalId: string, field: 'main' | 'extra', value: string) => {
      setGoalDetails((prev) => ({
        ...prev,
        [goalId]: {
          main: field === 'main' ? value : prev[goalId]?.main || '',
          extra: field === 'extra' ? value : prev[goalId]?.extra || '',
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
      let authToken = null;
      if (user) {
        const { data: { session } } = await (await import('@/lib/supabase-client')).supabaseClient.auth.getSession();
        authToken = session?.access_token || null;
      }

      const formData = {
        goals: selectedGoals,
        goalDetails,
        name,
        netWorth,
        phone: contactMethod === 'whatsapp' ? countryCode + phone : null,
        contactMethod,
        additionalInfo,
        email: user?.email || contactEmail || null,
        userId: user?.id || null,
      };

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      if (user && authToken && contactMethod) {
        try {
          await fetch('/api/user/preference', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              preferred_communication_method: contactMethod,
            }),
          });
        } catch (error) {
          console.error('Error saving communication preference:', error);
        }
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your form. Please try again.');
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
    user,
    contactEmail,
  ]);

  const handleGetStarted = useCallback(() => {
    setShowForm(true);
    setShowFormIntro(true);
    setShowPhilosophy(false);
  }, []);

  const handleEdit = useCallback(() => {
    setShowReview(false);
  }, []);

  if (submitted && !showSuccess) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className="flex flex-col items-center justify-center">
          <AnimatedZoroLogo
            className="h-32 md:h-48 lg:h-64"
            isDark={darkMode}
            onAnimationComplete={() => {
              setShowSuccess(true);
            }}
          />
        </div>
      </div>
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
        userEmail={user?.email || contactEmail}
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
        userEmail={user?.email}
        isLoggedIn={!!user}
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

  if (showPhilosophy) {
    return (
      <PhilosophyPage
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onBack={() => {
          setShowPhilosophy(false);
          resetForm();
        }}
      />
    );
  }

  return (
    <LandingPage
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
      onShowPhilosophy={() => setShowPhilosophy(true)}
      onGetStarted={handleGetStarted}
    />
  );
};

export default ZoroLanding;
