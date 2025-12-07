'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, TrendingUp, Home, Plane, Heart, Shield } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';
import { RETIREMENT_CONFIG } from './retirementConfig';
import { runAllTests, printTestResults } from './testRunner';

interface ExpenseBucket {
  value: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

interface CountryData {
  flag: string;
  avgMonthly: string;
  multiplier: number;
  currency: string;
  buckets: {
    housing: ExpenseBucket;
    food: ExpenseBucket;
    transportation: ExpenseBucket;
    healthcare: ExpenseBucket;
    entertainment: ExpenseBucket;
    other: ExpenseBucket;
  };
}

interface Answers {
  lifestyle: string | null;
  country: string;
  housing: string | null;
  healthcare: string | null;
  travel: string | null;
  safety: string | null;
  liquidNetWorth: string | null;
  annualIncomeJob: string | null;
  otherIncome: string | null;
  pension: string | null;
}

interface RetirementResult {
  required: number;
  aggressive: number;
  balanced: number;
  conservative: number;
  annualSpend: number;
  currency: string;
}

const countryData: Record<string, CountryData> = {
  'India': { 
    flag: '🇮🇳', 
    avgMonthly: '₹40,000 - ₹1,20,000', 
    multiplier: 0.8, 
    currency: '₹',
    buckets: {
      housing: { value: 15000, label: 'Housing & Utilities', min: 5000, max: 50000, step: 1000 },
      food: { value: 12000, label: 'Food & Dining', min: 5000, max: 30000, step: 1000 },
      transportation: { value: 5000, label: 'Transportation', min: 2000, max: 20000, step: 500 },
      healthcare: { value: 8000, label: 'Healthcare & Insurance', min: 3000, max: 25000, step: 1000 },
      entertainment: { value: 6000, label: 'Entertainment & Leisure', min: 2000, max: 20000, step: 500 },
      other: { value: 4000, label: 'Other Expenses', min: 1000, max: 15000, step: 500 }
    }
  },
  'Thailand': { 
    flag: '🇹🇭', 
    avgMonthly: '฿40,000 - ฿85,000', 
    multiplier: 1.0, 
    currency: '฿',
    buckets: {
      housing: { value: 600, label: 'Housing & Utilities', min: 300, max: 2000, step: 50 },
      food: { value: 400, label: 'Food & Dining', min: 200, max: 1000, step: 50 },
      transportation: { value: 200, label: 'Transportation', min: 100, max: 800, step: 25 },
      healthcare: { value: 300, label: 'Healthcare & Insurance', min: 150, max: 1000, step: 50 },
      entertainment: { value: 250, label: 'Entertainment & Leisure', min: 100, max: 800, step: 25 },
      other: { value: 150, label: 'Other Expenses', min: 50, max: 500, step: 25 }
    }
  },
  'UAE': { 
    flag: '🇦🇪', 
    avgMonthly: 'AED 8,000 - AED 18,000', 
    multiplier: 1.5, 
    currency: 'AED',
    buckets: {
      housing: { value: 5000, label: 'Housing & Utilities', min: 3000, max: 15000, step: 500 },
      food: { value: 3000, label: 'Food & Dining', min: 1500, max: 8000, step: 250 },
      transportation: { value: 1500, label: 'Transportation', min: 500, max: 5000, step: 250 },
      healthcare: { value: 2000, label: 'Healthcare & Insurance', min: 1000, max: 6000, step: 250 },
      entertainment: { value: 2000, label: 'Entertainment & Leisure', min: 500, max: 6000, step: 250 },
      other: { value: 1000, label: 'Other Expenses', min: 300, max: 3000, step: 100 }
    }
  },
  'Europe': { 
    flag: '🇪🇺', 
    avgMonthly: '€2,000 - €4,500', 
    multiplier: 1.8, 
    currency: '€',
    buckets: {
      housing: { value: 1200, label: 'Housing & Utilities', min: 600, max: 3000, step: 100 },
      food: { value: 800, label: 'Food & Dining', min: 400, max: 2000, step: 50 },
      transportation: { value: 400, label: 'Transportation', min: 200, max: 1200, step: 50 },
      healthcare: { value: 500, label: 'Healthcare & Insurance', min: 250, max: 1500, step: 50 },
      entertainment: { value: 600, label: 'Entertainment & Leisure', min: 200, max: 1500, step: 50 },
      other: { value: 300, label: 'Other Expenses', min: 100, max: 800, step: 50 }
    }
  },
  'US': { 
    flag: '🇺🇸', 
    avgMonthly: '$3,000 - $6,000', 
    multiplier: 2.0, 
    currency: '$',
    buckets: {
      housing: { value: 1800, label: 'Housing & Utilities', min: 800, max: 4000, step: 100 },
      food: { value: 1000, label: 'Food & Dining', min: 500, max: 2500, step: 50 },
      transportation: { value: 600, label: 'Transportation', min: 300, max: 2000, step: 50 },
      healthcare: { value: 800, label: 'Healthcare & Insurance', min: 400, max: 2000, step: 50 },
      entertainment: { value: 700, label: 'Entertainment & Leisure', min: 200, max: 2000, step: 50 },
      other: { value: 400, label: 'Other Expenses', min: 100, max: 1000, step: 50 }
    }
  },
  'Other': { 
    flag: '🌍', 
    avgMonthly: 'Varies by location', 
    multiplier: 1.2, 
    currency: '$',
    buckets: {
      housing: { value: 800, label: 'Housing & Utilities', min: 300, max: 2500, step: 50 },
      food: { value: 600, label: 'Food & Dining', min: 200, max: 1500, step: 50 },
      transportation: { value: 300, label: 'Transportation', min: 100, max: 1000, step: 25 },
      healthcare: { value: 400, label: 'Healthcare & Insurance', min: 150, max: 1200, step: 50 },
      entertainment: { value: 350, label: 'Entertainment & Leisure', min: 100, max: 1000, step: 25 },
      other: { value: 200, label: 'Other Expenses', min: 50, max: 600, step: 25 }
    }
  }
};

// Import multipliers from config file for easy updates
const {
  lifestyleMultipliers,
  housingMultipliers,
  healthcareMultipliers,
  travelMultipliers,
  safetyRates,
  lifestyleToHousingDefault
} = RETIREMENT_CONFIG;

interface RetirementCalculatorProps {
  initialData?: {
    answers?: Partial<Answers>;
    expenseBuckets?: Record<string, ExpenseBucket>;
  };
  onSave?: (data: {
    answers: Answers;
    expenseBuckets: Record<string, ExpenseBucket>;
    result: RetirementResult;
    email?: string;
  }) => Promise<void>;
}

export const RetirementCalculator: React.FC<RetirementCalculatorProps> = ({
  initialData,
  onSave
}) => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const { user, session } = useAuth();
  
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [customBuckets, setCustomBuckets] = useState<Record<string, ExpenseBucket> | null>(
    initialData?.expenseBuckets || null
  );
  const [showExpenses, setShowExpenses] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [answers, setAnswers] = useState<Answers>({
    lifestyle: initialData?.answers?.lifestyle || null,
    country: initialData?.answers?.country || 'India',
    housing: initialData?.answers?.housing || null,
    healthcare: initialData?.answers?.healthcare || null,
    travel: initialData?.answers?.travel || null,
    safety: initialData?.answers?.safety || null,
    liquidNetWorth: initialData?.answers?.liquidNetWorth || null,
    annualIncomeJob: initialData?.answers?.annualIncomeJob || null,
    otherIncome: initialData?.answers?.otherIncome || null,
    pension: initialData?.answers?.pension || null
  });
  
  const [emailError, setEmailError] = useState<string>('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    if (initialData?.expenseBuckets) {
      setCustomBuckets(initialData.expenseBuckets);
    }
  }, [initialData]);

  // Make test function available in browser console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).runRetirementTests = () => {
        const results = runAllTests();
        printTestResults(results);
        return results;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).runRetirementTests;
      }
    };
  }, []);

  // Format currency with proper symbols and Indian numbering
  const formatCurrency = (amount: number, currency: string): string => {
    // Helper to format with 3 significant digits
    const formatWithSignificantDigits = (num: number): string => {
      if (num >= 1000) {
        const magnitude = Math.floor(Math.log10(num));
        const significantDigits = 3;
        const divisor = Math.pow(10, magnitude - (significantDigits - 1));
        const rounded = Math.round(num / divisor) * divisor;
        return rounded.toLocaleString();
      }
      return num.toLocaleString();
    };

    if (currency === '₹') {
      // Indian numbering system (lakhs/crores)
      if (amount >= 10000000) {
        // Crores - format as 1.XX Cr with 3 significant digits
        const crores = amount / 10000000;
        const formatted = crores.toPrecision(3);
        return `₹${formatted} Cr`;
      } else if (amount >= 100000) {
        // Lakhs
        const lakhs = amount / 100000;
        const formatted = lakhs.toPrecision(3);
        return `₹${formatted} L`;
      } else {
        // Thousands
        return `₹${amount.toLocaleString('en-IN')}`;
      }
    } else if (currency === 'AED') {
      // UAE Dirham - format over 1M as 1.XX M
      if (amount >= 1000000) {
        const millions = amount / 1000000;
        const formatted = millions.toPrecision(3);
        return `AED ${formatted} M`;
      }
      return `AED ${amount.toLocaleString()}`;
    } else {
      // Standard formatting for other currencies (฿, $, €) - format over 1M as 1.XX M
      if (amount >= 1000000) {
        const millions = amount / 1000000;
        const formatted = millions.toPrecision(3);
        return `${currency}${formatted} M`;
      }
      return `${currency}${amount.toLocaleString()}`;
    }
  };

  const calculateRetirement = (): RetirementResult => {
    const { baseAmount } = RETIREMENT_CONFIG;
    const country = countryData[answers.country] || countryData['Other'];
    
    // Use custom buckets total if available, otherwise use multiplier calculation
    let annualSpend: number;
    if (customBuckets) {
      const monthlyTotal = Object.values(customBuckets).reduce((sum, bucket) => sum + bucket.value, 0);
      annualSpend = monthlyTotal * 12;
    } else {
      const lifestyle = (answers.lifestyle || 'Comfortable') as keyof typeof lifestyleMultipliers;
      const housing = (answers.housing || 'rent_modest') as keyof typeof housingMultipliers;
      const healthcare = (answers.healthcare || 'reliable') as keyof typeof healthcareMultipliers;
      const travel = (answers.travel || 'occasionally') as keyof typeof travelMultipliers;
      
      annualSpend = baseAmount * 
        country.multiplier *
        (lifestyleMultipliers[lifestyle] || 1.0) *
        (housingMultipliers[housing] || 1.0) *
        (healthcareMultipliers[healthcare] || 1.0) *
        (travelMultipliers[travel] || 1.0);
    }

    const safety = (answers.safety || 'balanced') as keyof typeof safetyRates;
    const safetyConfig = safetyRates[safety];
    const required = annualSpend / safetyConfig.rate;

    const aggressive = annualSpend / 0.05;
    const balanced = annualSpend / 0.04;
    const conservative = annualSpend / 0.03;

    return {
      required: Math.round(required),
      aggressive: Math.round(aggressive),
      balanced: Math.round(balanced),
      conservative: Math.round(conservative),
      annualSpend: Math.round(annualSpend),
      currency: country.currency
    };
  };

  const handleAnswer = (question: keyof Answers, value: string) => {
    setAnswers(prev => {
      const updated = { ...prev, [question]: value };
      // Set default housing based on lifestyle
      if (question === 'lifestyle') {
        const lifestyleKey = value as keyof typeof lifestyleToHousingDefault;
        const defaultHousing = lifestyleToHousingDefault[lifestyleKey];
        if (defaultHousing) {
          updated.housing = defaultHousing;
        }
      }
      return updated;
    });
    if (question === 'country') {
      const country = countryData[value];
      setCustomBuckets({ ...country.buckets });
      setShowCountryDropdown(false);
      setShowExpenses(true);
      return;
    }
    setTimeout(() => setStep(step + 1), 300);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      if (step === 1) {
        setShowCountryDropdown(false);
        setShowExpenses(false);
      }
    }
  };

  const handleContinueToExpenses = () => {
    if (!customBuckets) {
      const country = countryData[answers.country];
      setCustomBuckets({ ...country.buckets });
    }
    setShowExpenses(true);
  };

  const handleBucketChange = (bucketKey: string, newValue: string) => {
    const numValue = parseFloat(newValue) || 0;
    
    setCustomBuckets(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [bucketKey]: { ...prev[bucketKey], value: numValue }
      };
    });
  };

  const handleSliderChange = (bucketKey: string, newValue: string) => {
    setCustomBuckets(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [bucketKey]: { ...prev[bucketKey], value: parseFloat(newValue) }
      };
    });
  };

  const isValueInRange = (value: number, bucket: ExpenseBucket): boolean => {
    if (!bucket.min || !bucket.max) return true;
    return value >= bucket.min && value <= bucket.max;
  };

  const getTotalMonthlyExpenses = (): number => {
    if (!customBuckets) return 0;
    return Object.values(customBuckets).reduce((sum, bucket) => sum + bucket.value, 0);
  };

  const getCountriesSorted = (): string[] => {
    return Object.keys(countryData).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  };

  const handleCalculate = () => {
    setCalculating(true);
    setTimeout(() => {
      setCalculating(false);
      setShowResult(true);
    }, 2500);
  };

  const handleEmailSubmit = async () => {
    if (!email) {
      setEmailError('Please enter your email');
      return;
    }

    setCheckingEmail(true);
    setEmailError('');

    try {
      // Check if email exists
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        setEmailError(checkData.message || 'This email is already registered. Please log in instead.');
        // Redirect to login after a delay
        setTimeout(() => {
          window.location.href = `/login?email=${encodeURIComponent(email)}&redirect=/retire&message=${encodeURIComponent('Please log in to save your retirement plan')}`;
        }, 2000);
        return;
      }

      // Email doesn't exist, proceed with saving
      if (onSave && customBuckets) {
        setSaving(true);
        try {
          const result = calculateRetirement();
          await onSave({
            answers,
            expenseBuckets: customBuckets,
            result,
            email: email
          });
          setEmailSubmitted(true);
        } catch (error) {
          console.error('Error saving retirement plan:', error);
          setEmailError('Failed to save. Please try again.');
        } finally {
          setSaving(false);
        }
      } else {
        // Just submit email for non-logged in users
        setEmailSubmitted(true);
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailError('Failed to verify email. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSave = async () => {
    if (!onSave || !customBuckets) return;
    
    setSaving(true);
    try {
      const result = calculateRetirement();
      await onSave({
        answers,
        expenseBuckets: customBuckets,
        result,
        email: email || undefined
      });
      setEmailSubmitted(true);
    } catch (error) {
      console.error('Error saving retirement plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const result = showResult ? calculateRetirement() : null;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme.bgClass}`}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Retirement Calculator</h1>
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Progress Bar - Hide on result page */}
        {!showResult && (
          <div className="mb-12">
            <div className={`h-1 rounded-full ${darkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>
            <p className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
              Step {step + 1} of 7
            </p>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-8">
          {/* Back Button */}
          {step > 0 && !showResult && !calculating && (
            <button
              onClick={handleBack}
              className={`flex items-center gap-2 text-sm transition-colors ${theme.textSecondaryClass} hover:${theme.textClass}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}

          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>Imagine you are fully retired tomorrow.</h2>
              <p className={`text-lg mb-8 ${theme.textSecondaryClass}`}>
                Your money must last forever. How would you like to live?
              </p>
              <div className="space-y-3">
                {['Simple', 'Comfortable', 'Very Comfortable', 'Luxury'].map((option, idx) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer('lifestyle', option)}
                    className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                      darkMode 
                        ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                        : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className={`font-medium text-lg ${theme.textClass}`}>{String.fromCharCode(65 + idx)}. {option}</div>
                    <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                      {option === 'Simple' && 'Calm, basic, stress-free life'}
                      {option === 'Comfortable' && 'Middle/upper-middle lifestyle'}
                      {option === 'Very Comfortable' && 'High flexibility and travel'}
                      {option === 'Luxury' && 'No real constraints'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>Where will you spend most of your retired life?</h2>
              
              {/* Country Dropdown */}
              <div className="relative mb-8">
                <button
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className={`w-full p-5 rounded-lg text-left transition-all flex items-center justify-between ${
                    darkMode 
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{countryData[answers.country].flag}</span>
                    <span className={`font-medium text-lg ${theme.textClass}`}>{answers.country}</span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${theme.textClass}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCountryDropdown && (
                  <div className={`absolute z-10 w-full mt-2 rounded-lg shadow-xl ${
                    darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
                  }`}>
                    {getCountriesSorted().map(country => (
                      <button
                        key={country}
                        onClick={() => handleAnswer('country', country)}
                        className={`w-full p-4 text-left transition-all flex items-center gap-3 hover:bg-opacity-50 ${
                          darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                        } ${country === answers.country ? (darkMode ? 'bg-slate-750' : 'bg-gray-50') : ''}`}
                      >
                        <span className="text-2xl">{countryData[country].flag}</span>
                        <span className={`font-medium ${theme.textClass}`}>{country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Expense Buckets */}
              {showExpenses && customBuckets && (
                <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                  <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Review Monthly Expenses</h3>
                  <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
                    Adjust these values to match your expected lifestyle
                  </p>
                  
                  <div className="space-y-6">
                    {Object.entries(customBuckets).map(([key, bucket]) => {
                      const inRange = bucket.min && bucket.max ? isValueInRange(bucket.value, bucket) : true;
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center mb-1">
                            <label className={`text-sm font-medium ${theme.textClass}`}>
                              {bucket.label}
                            </label>
                            <input
                              type="number"
                              value={bucket.value}
                              onChange={(e) => handleBucketChange(key, e.target.value)}
                              className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                                darkMode 
                                  ? 'bg-slate-900 border border-slate-600 text-gray-100' 
                                  : 'bg-gray-100 border border-gray-300 text-gray-900'
                              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                          </div>
                          {bucket.min !== undefined && bucket.max !== undefined && (
                            <div className="space-y-1">
                              <input
                                type="range"
                                min={bucket.min}
                                max={bucket.max}
                                step={bucket.step || 1}
                                value={inRange ? bucket.value : bucket.min}
                                onChange={(e) => handleSliderChange(key, e.target.value)}
                                disabled={!inRange}
                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider ${
                                  !inRange ? 'opacity-30 cursor-not-allowed' : ''
                                }`}
                                style={{
                                  background: inRange 
                                    ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                                    : darkMode ? '#4b5563' : '#d1d5db'
                                }}
                              />
                              <div className={`flex justify-between text-xs ${theme.textSecondaryClass}`}>
                                <span>{formatCurrency(bucket.min, countryData[answers.country].currency)}</span>
                                <span>{formatCurrency(bucket.max, countryData[answers.country].currency)}</span>
                              </div>
                            </div>
                          )}
                          {!inRange && bucket.min !== undefined && bucket.max !== undefined && (
                            <p className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                              Value outside range - slider disabled
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-lg font-medium ${theme.textClass}`}>Total Monthly</span>
                      <span className="text-2xl font-light text-blue-500">
                        {formatCurrency(getTotalMonthlyExpenses(), countryData[answers.country].currency)}
                      </span>
                    </div>
                    <div className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
                      Annual: {formatCurrency(getTotalMonthlyExpenses() * 12, countryData[answers.country].currency)}
                    </div>
                  </div>
                </div>
              )}

              {!showExpenses ? (
                <button
                  onClick={handleContinueToExpenses}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
                >
                  Review Expenses
                </button>
              ) : (
                <button
                  onClick={() => setStep(step + 1)}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
                >
                  Continue
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <Home className="w-8 h-8 text-blue-500" />
                <h2 className={`text-3xl font-light ${theme.textClass}`}>Housing situation</h2>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'own_paid', letter: 'A', title: 'Already Own It', desc: 'A paid-off apartment or house' },
                  { key: 'rent_modest', letter: 'B', title: 'Rent Something Modest', desc: '1–2 bedroom in a decent area' },
                  { key: 'rent_nice', letter: 'C', title: 'Rent Something Nice', desc: 'Great location, comfort matters' },
                  { key: 'own_premium', letter: 'D', title: 'Own a Nice Place', desc: 'Good neighborhood, no luxury, but premium' },
                  { key: 'high_end', letter: 'E', title: 'High-End Living', desc: 'Top area / beachfront / prime real estate' }
                ].map((option) => {
                  const isSelected = answers.housing === option.key;
                  return (
                    <button
                      key={option.key}
                      onClick={() => handleAnswer('housing', option.key)}
                      className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                        isSelected
                          ? darkMode 
                            ? 'bg-blue-900/30 border-2 border-blue-500' 
                            : 'bg-blue-50 border-2 border-blue-500'
                          : darkMode 
                            ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                            : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                      }`}
                    >
                      <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.title}</div>
                      <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                        {option.desc}
                      </div>
                      {isSelected && (
                        <div className={`text-xs mt-2 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                          ✓ Selected (based on your lifestyle choice)
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <Heart className="w-8 h-8 text-blue-500" />
                <h2 className={`text-3xl font-light ${theme.textClass}`}>Health in retirement</h2>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'basic', letter: 'A', title: 'Basic Coverage', desc: "Public + basic private, I'm okay waiting" },
                  { key: 'reliable', letter: 'B', title: 'Private Care', desc: 'Reliable private hospitals and insurance' },
                  { key: 'top_tier', letter: 'C', title: 'Premium International', desc: 'Top-tier international healthcare' },
                  { key: 'vip', letter: 'D', title: 'VIP Treatment', desc: 'VIP, medical tourism, best of the best' }
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleAnswer('healthcare', option.key)}
                    className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                      darkMode 
                        ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                        : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.title}</div>
                    <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <Plane className="w-8 h-8 text-blue-500" />
                <h2 className={`text-3xl font-light ${theme.textClass}`}>Travel frequency</h2>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'rarely', letter: 'A', title: 'Rarely Travel', desc: '1 small trip per year' },
                  { key: 'occasionally', letter: 'B', title: 'Occasional Traveler', desc: '2–3 trips per year' },
                  { key: 'frequently', letter: 'C', title: 'Frequent Traveler', desc: '4–6 trips per year' },
                  { key: 'constantly', letter: 'D', title: 'Always on the Move', desc: 'Travel whenever I feel like it' }
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => handleAnswer('travel', option.key)}
                    className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                      darkMode 
                        ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                        : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.title}</div>
                    <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-8 h-8 text-blue-500" />
                <h2 className={`text-3xl font-light ${theme.textClass}`}>Income & Assets (Optional)</h2>
              </div>
              <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
                Help us understand your current financial situation. All fields are optional.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
                    Liquid Net Worth
                    <div className="relative group">
                      <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Exclude house, car, and other illiquid assets. Include only stocks, bonds, mutual funds, and cash.
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={answers.liquidNetWorth || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, liquidNetWorth: e.target.value }))}
                    placeholder={countryData[answers.country].currency === '₹' ? '₹5,00,000' : countryData[answers.country].currency === '฿' ? '฿500,000' : '50,000'}
                    className={`w-full px-4 py-3 rounded-lg ${
                      darkMode 
                        ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Annual Income from Job
                  </label>
                  <input
                    type="number"
                    value={answers.annualIncomeJob || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, annualIncomeJob: e.target.value }))}
                    placeholder={countryData[answers.country].currency === '₹' ? '₹10,00,000' : countryData[answers.country].currency === '฿' ? '฿1,000,000' : '100,000'}
                    className={`w-full px-4 py-3 rounded-lg ${
                      darkMode 
                        ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Other Income
                  </label>
                  <input
                    type="number"
                    value={answers.otherIncome || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, otherIncome: e.target.value }))}
                    placeholder={countryData[answers.country].currency === '₹' ? '₹2,00,000' : countryData[answers.country].currency === '฿' ? '฿200,000' : '20,000'}
                    className={`w-full px-4 py-3 rounded-lg ${
                      darkMode 
                        ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Pension
                  </label>
                  <input
                    type="number"
                    value={answers.pension || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, pension: e.target.value }))}
                    placeholder={countryData[answers.country].currency === '₹' ? '₹3,00,000' : countryData[answers.country].currency === '฿' ? '฿300,000' : '30,000'}
                    className={`w-full px-4 py-3 rounded-lg ${
                      darkMode 
                        ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(step + 1)}
                className="mt-6 w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-8 h-8 text-blue-500" />
                <h2 className={`text-3xl font-light ${theme.textClass}`}>How safe does your plan need to be?</h2>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'ultra_safe', letter: 'A', label: 'Ultra Safe', desc: 'I never want to worry' },
                  { key: 'safe', letter: 'B', label: 'Safe', desc: 'Very conservative approach' },
                  { key: 'balanced', letter: 'C', label: 'Balanced', desc: 'Balanced & realistic' },
                  { key: 'aggressive', letter: 'D', label: 'Aggressive', desc: "I'm okay with some risk" }
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => {
                      handleAnswer('safety', option.key);
                      setTimeout(() => handleCalculate(), 500);
                    }}
                    className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                      darkMode 
                        ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                        : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.label}</div>
                    <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {calculating && (
            <div className="text-center py-20 animate-fade-in">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-6"></div>
              <h3 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Calculating your retirement needs...</h3>
              <p className={theme.textSecondaryClass}>
                Analyzing your lifestyle choices and country data
              </p>
            </div>
          )}

          {showResult && !emailSubmitted && result && (
            <div className="animate-fade-in">
              <div className={`p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
                <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>Your Retirement Number</h2>
                
                <p className={`text-lg mb-8 ${theme.textClass}`}>
                  To sustain your selected lifestyle forever in <span className="font-medium text-blue-500">{answers.country}</span>, you need approximately:
                </p>

                <div className="text-center py-8 mb-8">
                  <div className="text-6xl font-light text-blue-500 mb-4 animate-number-reveal">
                    {formatCurrency(result.required, result.currency)}
                  </div>
                  <div className={`text-sm ${theme.textSecondaryClass}`}>
                    Annual spend: {formatCurrency(result.annualSpend, result.currency)}
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-center">
                      <span className={theme.textClass}>Aggressive (higher risk)</span>
                      <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.aggressive, result.currency)}</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-center">
                      <span className={theme.textClass}>Balanced (recommended)</span>
                      <span className="font-medium text-blue-500">{formatCurrency(result.balanced, result.currency)}</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-center">
                      <span className={theme.textClass}>Very Safe (conservative)</span>
                      <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.conservative, result.currency)}</span>
                    </div>
                  </div>
                </div>

                {onSave && user && (
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-slate-900 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                    <h3 className={`text-lg font-medium mb-4 ${theme.textClass}`}>Save your retirement plan</h3>
                    <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                      Save this plan to your profile to access and edit it later.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com (optional)"
                        className={`flex-1 px-4 py-3 rounded-lg ${
                          darkMode 
                            ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                            : 'bg-white border border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                      >
                        {saving ? 'Saving...' : 'Save Plan'}
                      </button>
                    </div>
                  </div>
                )}

                {!user && (
                  <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-slate-900 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                    <h3 className={`text-lg font-medium mb-4 ${theme.textClass}`}>Save your retirement plan</h3>
                    <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                      Enter your email to save this plan and receive a detailed breakdown with tax considerations, inflation adjustments, and investment recommendations.
                    </p>
                    {emailError && (
                      <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-red-900/30 border border-red-500/50' : 'bg-red-50 border border-red-200'}`}>
                        <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>{emailError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError('');
                        }}
                        placeholder="your@email.com"
                        className={`flex-1 px-4 py-3 rounded-lg ${
                          darkMode 
                            ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                            : 'bg-white border border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? (darkMode ? 'border-red-500' : 'border-red-300') : ''}`}
                      />
                      <button
                        onClick={handleEmailSubmit}
                        disabled={checkingEmail || saving}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                      >
                        {checkingEmail ? 'Verifying email address...' : saving ? 'Creating your account...' : 'Save & Continue'}
                      </button>
                    </div>
                    {(checkingEmail || saving) && (
                      <div className={`mt-4 space-y-1 ${theme.textSecondaryClass} text-sm`}>
                        <p>• Checking if this email is already registered</p>
                        <p>• Creating your account to save your plan</p>
                        <p>• Setting up your profile for future access</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setStep(0);
                  setShowResult(false);
                  setCustomBuckets(null);
                  setAnswers({
                    lifestyle: null,
                    country: 'India',
                    housing: null,
                    healthcare: null,
                    travel: null,
                    safety: null,
                    liquidNetWorth: null,
                    annualIncomeJob: null,
                    otherIncome: null,
                    pension: null
                  });
                }}
                className={`mt-6 w-full py-3 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Start Over
              </button>
            </div>
          )}

          {emailSubmitted && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Thank you!</h3>
              <p className={theme.textSecondaryClass}>
                {user ? 'Your retirement plan has been saved to your profile.' : `Your detailed retirement plan will be sent to ${email}`}
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes number-reveal {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-number-reveal {
          animation: number-reveal 0.8s ease-out;
        }

        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider:disabled::-webkit-slider-thumb {
          background: #6b7280;
          cursor: not-allowed;
        }

        .slider:disabled::-moz-range-thumb {
          background: #6b7280;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

