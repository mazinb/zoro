'use client';

import { useState, useCallback, useMemo } from 'react';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { LandingPage } from '@/components/landing/LandingPage';
import { PhilosophyPage } from '@/components/landing/PhilosophyPage';
import { FormFlow } from '@/components/form/FormFlow';
import { ContactMethodSelection } from '@/components/form/ContactMethodSelection';
import { FormReview } from '@/components/form/FormReview';
import { FormSuccess } from '@/components/form/FormSuccess';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/hooks/useAuth';
import { Target, Shield, TrendingUp, Users, DollarSign, Check, Briefcase, Home } from 'lucide-react';
import { FormAnswers, ContactMethod, Question } from '@/types';
import { DEFAULT_FORM_ANSWERS, ANIMATION_DELAYS, QUESTION_CONFIGS } from '@/constants';

// Helper function to create questions with icons
const createQuestions = (): Question[] => {
  return [
    {
      ...QUESTION_CONFIGS[0],
      options: [
        { value: 'retirement', label: 'Retirement Planning', icon: <Target className="w-8 h-8" /> },
        { value: 'estate', label: 'Estate Planning', icon: <Shield className="w-8 h-8" /> },
        { value: 'wealth', label: 'Wealth Building', icon: <TrendingUp className="w-8 h-8" /> },
        { value: 'family', label: 'Family Security', icon: <Users className="w-8 h-8" /> }
      ]
    },
    {
      ...QUESTION_CONFIGS[1],
      options: [
        { value: 'under50L', label: 'Under ₹50 Lakhs', icon: <DollarSign className="w-8 h-8" /> },
        { value: '50L-1Cr', label: '₹50L - ₹1 Crore', icon: <DollarSign className="w-8 h-8" /> },
        { value: '1Cr-10Cr', label: '₹1 Cr - ₹10 Crore', icon: <DollarSign className="w-8 h-8" /> },
        { value: 'over10Cr', label: 'Over ₹10 Crore', icon: <DollarSign className="w-8 h-8" /> }
      ]
    },
    {
      ...QUESTION_CONFIGS[2],
      options: [
        { value: 'complete', label: 'Yes, complete', icon: <Check className="w-8 h-8" /> },
        { value: 'partial', label: 'Partially done', icon: <Shield className="w-8 h-8" /> },
        { value: 'outdated', label: 'Yes, but outdated', icon: <Shield className="w-8 h-8" /> },
        { value: 'none', label: 'No, not yet', icon: <Shield className="w-8 h-8" /> }
      ]
    },
    {
      ...QUESTION_CONFIGS[3],
      options: [
        { value: 'immediate', label: 'Immediate (0-1 year)', icon: <TrendingUp className="w-8 h-8" /> },
        { value: 'short', label: 'Short-term (1-5 years)', icon: <TrendingUp className="w-8 h-8" /> },
        { value: 'medium', label: 'Medium-term (5-10 years)', icon: <TrendingUp className="w-8 h-8" /> },
        { value: 'long', label: 'Long-term (10+ years)', icon: <TrendingUp className="w-8 h-8" /> }
      ]
    },
    {
      ...QUESTION_CONFIGS[4],
      options: [
        { value: 'taxes', label: 'Tax optimization', icon: <Briefcase className="w-8 h-8" /> },
        { value: 'legacy', label: 'Leaving a legacy', icon: <Home className="w-8 h-8" /> },
        { value: 'protection', label: 'Asset protection', icon: <Shield className="w-8 h-8" /> },
        { value: 'clarity', label: 'Financial clarity', icon: <Target className="w-8 h-8" /> }
      ]
    }
  ];
};

const ZoroLanding = () => {
  // Dark mode
  const { darkMode, toggleDarkMode } = useDarkMode();
  // Auth
  const { signIn, signUp, user } = useAuth();

  // Navigation state
  const [showForm, setShowForm] = useState(false);
  const [showPhilosophy, setShowPhilosophy] = useState(false);
  
  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(DEFAULT_FORM_ANSWERS);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod | ''>('');
  const [showReview, setShowReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFormIntro, setShowFormIntro] = useState(false);

  // Create questions with icons (memoized to prevent recreation on each render)
  const questions = useMemo(() => createQuestions(), []);

  // Reset form state
  const resetForm = useCallback(() => {
    setShowForm(false);
    setShowFormIntro(false);
    setShowReview(false);
    setSubmitted(false);
    setShowSuccess(false);
    setCurrentStep(0);
    setAnswers(DEFAULT_FORM_ANSWERS);
    setPhone('');
    setCountryCode('+91');
    setAdditionalInfo('');
    setContactMethod('');
  }, []);

  // Handle answer selection
  const handleAnswerSelect = useCallback((value: string) => {
    const currentQuestion = questions[currentStep];
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);
    
    if (currentStep < questions.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), ANIMATION_DELAYS.STEP_TRANSITION);
    } else {
      setTimeout(() => setCurrentStep(questions.length), ANIMATION_DELAYS.STEP_TRANSITION);
    }
  }, [answers, currentStep, questions]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      resetForm();
    }
  }, [currentStep, resetForm]);

  // Handle phone submit (WhatsApp)
  const handlePhoneSubmit = useCallback(() => {
    setContactMethod('whatsapp');
    setShowReview(true);
  }, []);

  // Handle email auth success
  const handleEmailAuthSuccess = useCallback(() => {
    setContactMethod('email');
    setShowReview(true);
  }, []);

  // Handle final form submission
  const handleFinalSubmit = useCallback(async () => {
    if (!contactMethod) return;
    
    setIsSubmitting(true);
    try {
      // Get user session token if logged in
      let authToken = null;
      if (user) {
        const { data: { session } } = await (await import('@/lib/supabase-client')).supabaseClient.auth.getSession();
        authToken = session?.access_token || null;
      }

      const formData = {
        ...answers,
        phone: contactMethod === 'whatsapp' ? countryCode + phone : null,
        contactMethod,
        additionalInfo,
        userId: user?.id || null
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

      const result = await response.json();

      // If user is logged in, save communication preference
      if (user && authToken && contactMethod) {
        try {
          await fetch('/api/user/preference', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              preferred_communication_method: contactMethod
            }),
          });
        } catch (error) {
          console.error('Error saving communication preference:', error);
          // Don't fail the form submission if preference save fails
        }
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, phone, countryCode, contactMethod, additionalInfo, user]);

  // Handle get started
  const handleGetStarted = useCallback(() => {
    setShowForm(true);
    setShowFormIntro(true);
    setShowPhilosophy(false);
    setCurrentStep(0);
  }, []);

  // Handle edit in review
  const handleEdit = useCallback((stepIndex: number) => {
    setShowReview(false);
    setCurrentStep(stepIndex);
  }, []);

  // Show loading animation during submission
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

  // Show animated logo intro before first question
  if (showForm && currentStep === 0 && showFormIntro) {
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

  // Show success message
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

  // Show review page
  if (showReview && contactMethod) {
    return (
      <FormReview
        answers={answers}
        phone={phone}
        countryCode={countryCode}
        contactMethod={contactMethod as ContactMethod}
        additionalInfo={additionalInfo}
        userEmail={user?.email}
        questions={questions}
        darkMode={darkMode}
        isSubmitting={isSubmitting}
        onEdit={handleEdit}
        onBack={() => {
          setShowReview(false);
          setCurrentStep(questions.length);
        }}
        onSubmit={handleFinalSubmit}
      />
    );
  }

  // Show contact method selection
  if (showForm && currentStep >= questions.length) {
    return (
      <ContactMethodSelection
        phone={phone}
        countryCode={countryCode}
        additionalInfo={additionalInfo}
        darkMode={darkMode}
        onPhoneChange={setPhone}
        onCountryCodeChange={(code) => {
          setCountryCode(code);
        }}
        onAdditionalInfoChange={setAdditionalInfo}
        onWhatsAppSubmit={handlePhoneSubmit}
        onEmailAuthSuccess={handleEmailAuthSuccess}
        userEmail={user?.email}
        isLoggedIn={!!user}
        onSignIn={async (email, password) => {
          const result = await signIn(email, password);
          return result;
        }}
        onSignUp={async (email, password, name) => {
          const result = await signUp(email, password, name);
          return result;
        }}
        onBack={handleBack}
        onRestart={() => {
          setCurrentStep(0);
          setAnswers(DEFAULT_FORM_ANSWERS);
          setPhone('');
          setCountryCode('+91');
          setAdditionalInfo('');
        }}
        onGoHome={resetForm}
      />
    );
  }

  // Show form flow (questions)
  if (showForm && currentStep < questions.length) {
    return (
      <FormFlow
        questions={questions}
        currentStep={currentStep}
        answers={answers}
        darkMode={darkMode}
        onAnswerSelect={handleAnswerSelect}
        onBack={handleBack}
      />
    );
  }

  // Show philosophy page
  if (showPhilosophy) {
    return (
      <PhilosophyPage
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onGetStarted={handleGetStarted}
        onBack={() => {
          setShowPhilosophy(false);
          resetForm();
        }}
      />
    );
  }

  // Show main landing page
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
