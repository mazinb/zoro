'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Home, Plane, Heart, Shield, TrendingUp } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';
import { RETIREMENT_CONFIG } from './retirementConfig';
import { runAllTests, printTestResults } from './testRunner';
import { ExpenseBucket, Answers, RetirementResult, Assumptions } from './types';
import { countryData, getCountriesSorted } from './countryData';
import { formatCurrency, formatInputValue, parseInputValue, isValueInRange, getTotalMonthlyExpenses } from './utils';
import { LifestyleStep } from './steps/LifestyleStep';
import { CountryExpensesStep } from './steps/CountryExpensesStep';
import { HousingStep } from './steps/HousingStep';
import { HealthcareStep } from './steps/HealthcareStep';
import { TravelStep } from './steps/TravelStep';
import { IncomeStep } from './steps/IncomeStep';
import { SafetyStep } from './steps/SafetyStep';
import { MainResultCard } from './results/MainResultCard';
import { ExpenseBreakdown } from './results/ExpenseBreakdown';
import { AdditionalCostsSection } from './results/AdditionalCostsSection';
import { RiskLevels } from './results/RiskLevels';


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
  darkMode?: boolean;
}

export const RetirementCalculator: React.FC<RetirementCalculatorProps> = ({
  initialData,
  onSave,
  darkMode: propDarkMode
}) => {
  // Use darkMode from props if provided, otherwise default to false
  const darkMode = propDarkMode ?? false;
  const theme = useThemeClasses(darkMode);
  const { user, session } = useAuth();
  
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [cameFromResults, setCameFromResults] = useState(false); // Track if navigating from results
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [customBuckets, setCustomBuckets] = useState<Record<string, ExpenseBucket> | null>(
    initialData?.expenseBuckets || null
  );
  const [showExpenses, setShowExpenses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [showHousing, setShowHousing] = useState(false);
  const [showHealthcare, setShowHealthcare] = useState(false);
  const [showTravel, setShowTravel] = useState(false);
  const [showEmergencyFund, setShowEmergencyFund] = useState(false);
  
  // Separate costs calculated from form inputs
  const [housingCost, setHousingCost] = useState<number | null>(null);
  const [healthcareCost, setHealthcareCost] = useState<number | null>(null);
  const [travelCost, setTravelCost] = useState<number | null>(null);
  const [emergencyFund, setEmergencyFund] = useState<number | null>(null);
  
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
    pension: initialData?.answers?.pension || null,
    liabilities: initialData?.answers?.liabilities || null
  });
  
  const [emailError, setEmailError] = useState<string>('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  
  // Assumptions state - pre-populate based on safety selection
  const getDefaultAssumptions = (safety: string | null) => {
    const defaults: Record<string, { preRet: number; postRet: number; equityAlloc: number }> = {
      'ultra_safe': { preRet: 5, postRet: 3, equityAlloc: 40 },
      'safe': { preRet: 6, postRet: 4, equityAlloc: 50 },
      'balanced': { preRet: 8, postRet: 5, equityAlloc: 70 },
      'aggressive': { preRet: 10, postRet: 6, equityAlloc: 80 },
    };
    return defaults[safety || 'balanced'] || defaults.balanced;
  };

  const defaultAssumptions = getDefaultAssumptions(answers.safety);
  const [assumptions, setAssumptions] = useState<Assumptions>({
    preRetirementReturn: defaultAssumptions.preRet, // Annual return before retirement (%)
    postRetirementReturn: defaultAssumptions.postRet, // Annual return after retirement (%)
    inflation: 3, // Annual inflation (%)
    currentAge: 35, // Current age
    retirementAge: 65, // Target retirement age
    showAdvanced: false, // Show advanced breakdown
    // Advanced options
    equityReturn: 10, // Equity return (%)
    debtReturn: 4, // Debt return (%)
    equityAllocation: defaultAssumptions.equityAlloc, // Equity allocation (%)
    debtAllocation: 100 - defaultAssumptions.equityAlloc, // Debt allocation (%)
    // Post-retirement income options
    postRetEquityReturn: 8, // Post-retirement equity return (%)
    postRetDebtReturn: 3, // Post-retirement debt return (%)
    postRetEquityAllocation: 50, // Post-retirement equity allocation (%)
    postRetDebtAllocation: 50, // Post-retirement debt allocation (%)
  });

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


  const calculateRetirement = (): RetirementResult => {
    const { baseAmount } = RETIREMENT_CONFIG;
    const country = countryData[answers.country] || countryData['Other'];
    
    // Calculate monthly expenses (only burn items)
    let monthlyExpenses = 0;
    if (customBuckets) {
      monthlyExpenses = Object.values(customBuckets).reduce((sum, bucket) => sum + bucket.value, 0);
    } else {
      // Fallback calculation using lifestyle multiplier only for base expenses
      const lifestyle = (answers.lifestyle || 'Comfortable') as keyof typeof lifestyleMultipliers;
      const baseMonthly = (baseAmount * country.multiplier * (lifestyleMultipliers[lifestyle] || 1.0)) / 12;
      monthlyExpenses = baseMonthly * 0.6; // Rough estimate for monthly burn (60% of total)
    }
    
    // Add housing, healthcare, and travel costs
    const housing = housingCost ?? calculateHousingCost() ?? 0;
    const healthcare = healthcareCost ?? calculateHealthcareCost();
    const travel = travelCost ?? calculateTravelCost();
    
    const monthlyTotal = monthlyExpenses + housing + healthcare + travel;
    const annualSpend = monthlyTotal * 12;

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

  // Calculate years to work and monthly savings needed
  const calculateSavingsPlan = () => {
    if (!result) return null;

    const liquidNetWorth = parseFloat(answers.liquidNetWorth || '0') || 0;
    const annualIncomeJob = parseFloat(answers.annualIncomeJob || '0') || 0;
    const otherIncome = parseFloat(answers.otherIncome || '0') || 0;
    const pension = parseFloat(answers.pension || '0') || 0;
    
    const targetAmount = result.required;
    const yearsToRetirement = Math.max(1, assumptions.retirementAge - assumptions.currentAge);
    
    // Use advanced breakdown if enabled, otherwise use simple pre-retirement return
    let preRetReturnDecimal: number;
    if (assumptions.showAdvanced) {
      const equityReturn = assumptions.equityReturn / 100;
      const debtReturn = assumptions.debtReturn / 100;
      const equityAlloc = assumptions.equityAllocation / 100;
      const debtAlloc = assumptions.debtAllocation / 100;
      preRetReturnDecimal = (equityReturn * equityAlloc) + (debtReturn * debtAlloc);
    } else {
      preRetReturnDecimal = assumptions.preRetirementReturn / 100;
    }
    
    const inflationDecimal = assumptions.inflation / 100;
    
    // Calculate future value needed (accounting for inflation)
    const futureValueNeeded = targetAmount * Math.pow(1 + inflationDecimal, yearsToRetirement);
    
    // Calculate future value of current savings
    const futureValueOfCurrentSavings = liquidNetWorth * Math.pow(1 + preRetReturnDecimal, yearsToRetirement);
    
    // Calculate shortfall
    const shortfall = Math.max(0, futureValueNeeded - futureValueOfCurrentSavings);
    
    // Calculate monthly savings needed using future value of annuity formula
    const monthlyReturn = preRetReturnDecimal / 12;
    const monthsToRetirement = yearsToRetirement * 12;
    
    let monthlySavingsNeeded = 0;
    if (shortfall > 0 && monthsToRetirement > 0 && monthlyReturn > 0) {
      const annuityFactor = (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) / monthlyReturn;
      monthlySavingsNeeded = shortfall / annuityFactor;
    }
    
    // Calculate total annual income (subtract liabilities)
    const liabilities = parseFloat(answers.liabilities || '0') || 0;
    const annualLiabilities = liabilities * 12; // Convert monthly to annual
    const totalAnnualIncome = annualIncomeJob + otherIncome + pension - annualLiabilities;
    
    // Calculate savings rate
    const savingsRate = totalAnnualIncome > 0 
      ? (monthlySavingsNeeded * 12) / totalAnnualIncome * 100 
      : 0;

    return {
      yearsToRetirement,
      currentSavings: liquidNetWorth,
      targetAmount,
      futureValueNeeded,
      futureValueOfCurrentSavings,
      shortfall,
      monthlySavingsNeeded,
      totalAnnualIncome,
      savingsRate,
      hasIncomeData: annualIncomeJob > 0 || otherIncome > 0 || pension > 0
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

  // Calculate expense values based on form inputs
  const calculateExpenseFromForm = (type: 'housing' | 'healthcare' | 'travel'): number => {
    const country = countryData[answers.country] || countryData['Other'];
    const baseBucket = country.buckets[type === 'housing' ? 'housing' : type === 'healthcare' ? 'healthcare' : 'transportation'];
    const baseValue = baseBucket.value;
    
    let multiplier = 1.0;
    if (type === 'housing' && answers.housing) {
      multiplier = housingMultipliers[answers.housing as keyof typeof housingMultipliers] || 1.0;
    } else if (type === 'healthcare' && answers.healthcare) {
      multiplier = healthcareMultipliers[answers.healthcare as keyof typeof healthcareMultipliers] || 1.0;
    } else if (type === 'travel' && answers.travel) {
      multiplier = travelMultipliers[answers.travel as keyof typeof travelMultipliers] || 1.0;
    }
    
    return Math.round(baseValue * multiplier);
  };

  // Calculate housing cost based on form input
  const calculateHousingCost = (): number | null => {
    if (!answers.housing) return null;
    
    // If they own their house (own_paid), no housing cost
    if (answers.housing === 'own_paid') return 0;
    
    const country = countryData[answers.country] || countryData['Other'];
    const baseHousing = country.buckets.housing.value;
    const multiplier = housingMultipliers[answers.housing as keyof typeof housingMultipliers] || 1.0;
    return Math.round(baseHousing * multiplier);
  };

  // Calculate healthcare cost based on form input
  const calculateHealthcareCost = (): number => {
    if (!answers.healthcare) return 0;
    const country = countryData[answers.country] || countryData['Other'];
    const baseHealthcare = country.buckets.healthcare.value;
    const multiplier = healthcareMultipliers[answers.healthcare as keyof typeof healthcareMultipliers] || 1.0;
    return Math.round(baseHealthcare * multiplier);
  };

  // Calculate travel cost based on form input
  const calculateTravelCost = (): number => {
    if (!answers.travel) return 0;
    const country = countryData[answers.country] || countryData['Other'];
    const baseTransportation = country.buckets.transportation.value;
    const multiplier = travelMultipliers[answers.travel as keyof typeof travelMultipliers] || 1.0;
    return Math.round(baseTransportation * multiplier);
  };

  const initializeCustomBuckets = () => {
    if (!customBuckets) {
      const country = countryData[answers.country] || countryData['Other'];
      // Only include monthly burn items (exclude housing, healthcare)
      const buckets: Record<string, ExpenseBucket> = {
        food: country.buckets.food,
        transportation: country.buckets.transportation,
        entertainment: country.buckets.entertainment,
        other: country.buckets.other
      };
      setCustomBuckets(buckets);
    }
    
    // Calculate separate costs from form inputs
    const housing = calculateHousingCost();
    const healthcare = calculateHealthcareCost();
    const travel = calculateTravelCost();
    
    setHousingCost(housing);
    setHealthcareCost(healthcare);
    setTravelCost(travel);
  };

  const handleContinueToExpenses = () => {
    initializeCustomBuckets();
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

  const getTotalMonthlyCosts = (): number => {
    const monthlyExpenses = getTotalMonthlyExpenses(customBuckets);
    const housing = housingCost ?? 0;
    const healthcare = healthcareCost ?? 0;
    const travel = travelCost ?? 0;
    return monthlyExpenses + housing + healthcare + travel;
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

  // Update separate costs when answers change
  useEffect(() => {
    if (answers.housing !== null) {
      setHousingCost(calculateHousingCost());
    }
    if (answers.healthcare !== null) {
      setHealthcareCost(calculateHealthcareCost());
    }
    if (answers.travel !== null) {
      setTravelCost(calculateTravelCost());
    }
  }, [answers.housing, answers.healthcare, answers.travel, answers.country]);

  // Recalculate result whenever answers, customBuckets, or separate costs change
  const result = useMemo(() => {
    return showResult ? calculateRetirement() : null;
  }, [showResult, answers, customBuckets, housingCost, healthcareCost, travelCost]);

  // Initialize buckets and emergency fund when result is first calculated
  useEffect(() => {
    if (result && showResult) {
      if (!customBuckets) {
        initializeCustomBuckets();
      }
      // Set emergency fund to 10% of corpus if not set
      if (emergencyFund === null) {
        setEmergencyFund(Math.round(result.required * 0.1));
      }
    }
  }, [result, showResult]);
  
  // Recalculate savings plan whenever result, assumptions, or answers change
  const savingsPlan = useMemo(() => {
    return result ? calculateSavingsPlan() : null;
  }, [result, assumptions, answers]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Retirement Calculator</h1>
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
                        {formatCurrency(getTotalMonthlyExpenses(customBuckets), countryData[answers.country].currency)}
                      </span>
                    </div>
                    <div className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
                      Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, countryData[answers.country].currency)}
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
                  onClick={() => {
                    if (cameFromResults) {
                      setCameFromResults(false);
                      setShowResult(true);
                      setStep(0); // Reset step but show results
                    } else {
                      setStep(step + 1);
                    }
                  }}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
                >
                  {cameFromResults ? 'Back to Results' : 'Continue'}
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <HousingStep
              darkMode={darkMode}
              answers={answers}
              onSelect={(housing) => handleAnswer('housing', housing)}
            />
          )}

          {step === 3 && (
            <HealthcareStep
              darkMode={darkMode}
              onSelect={(healthcare) => handleAnswer('healthcare', healthcare)}
            />
          )}

          {step === 4 && (
            <TravelStep
              darkMode={darkMode}
              onSelect={(travel) => handleAnswer('travel', travel)}
            />
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
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                      {countryData[answers.country].currency}
                    </span>
                    <input
                      type="text"
                      value={answers.liquidNetWorth ? formatInputValue(answers.liquidNetWorth, countryData[answers.country].currency) : ''}
                      onChange={(e) => {
                        const parsed = parseInputValue(e.target.value);
                        setAnswers(prev => ({ ...prev, liquidNetWorth: parsed }));
                      }}
                      placeholder={countryData[answers.country].currency === '₹' ? '5,00,000' : countryData[answers.country].currency === '฿' ? '500,000' : '50,000'}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                        darkMode 
                          ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Annual Income from Job
                  </label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                      {countryData[answers.country].currency}
                    </span>
                    <input
                      type="text"
                      value={answers.annualIncomeJob ? formatInputValue(answers.annualIncomeJob, countryData[answers.country].currency) : ''}
                      onChange={(e) => {
                        const parsed = parseInputValue(e.target.value);
                        setAnswers(prev => ({ ...prev, annualIncomeJob: parsed }));
                      }}
                      placeholder={countryData[answers.country].currency === '₹' ? '10,00,000' : countryData[answers.country].currency === '฿' ? '1,000,000' : '100,000'}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                        darkMode 
                          ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Other Income
                  </label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                      {countryData[answers.country].currency}
                    </span>
                    <input
                      type="text"
                      value={answers.otherIncome ? formatInputValue(answers.otherIncome, countryData[answers.country].currency) : ''}
                      onChange={(e) => {
                        const parsed = parseInputValue(e.target.value);
                        setAnswers(prev => ({ ...prev, otherIncome: parsed }));
                      }}
                      placeholder={countryData[answers.country].currency === '₹' ? '2,00,000' : countryData[answers.country].currency === '฿' ? '200,000' : '20,000'}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                        darkMode 
                          ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                    Pension
                  </label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                      {countryData[answers.country].currency}
                    </span>
                    <input
                      type="text"
                      value={answers.pension ? formatInputValue(answers.pension, countryData[answers.country].currency) : ''}
                      onChange={(e) => {
                        const parsed = parseInputValue(e.target.value);
                        setAnswers(prev => ({ ...prev, pension: parsed }));
                      }}
                      placeholder={countryData[answers.country].currency === '₹' ? '3,00,000' : countryData[answers.country].currency === '฿' ? '300,000' : '30,000'}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                        darkMode 
                          ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
                    Monthly Liabilities
                    <div className="relative group">
                      <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Include monthly EMI payments (car loan, home loan) or any other recurring payments (family support, school fees)
                      </div>
                    </div>
                  </label>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                      {countryData[answers.country].currency}
                    </span>
                    <input
                      type="text"
                      value={answers.liabilities ? formatInputValue(answers.liabilities, countryData[answers.country].currency) : ''}
                      onChange={(e) => {
                        const parsed = parseInputValue(e.target.value);
                        setAnswers(prev => ({ ...prev, liabilities: parsed }));
                      }}
                      placeholder={countryData[answers.country].currency === '₹' ? '50,000' : countryData[answers.country].currency === '฿' ? '50,000' : '5,000'}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                        darkMode 
                          ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (cameFromResults) {
                    setCameFromResults(false);
                    setShowResult(true);
                    setStep(0); // Reset step but show results
                  } else {
                    setStep(step + 1);
                  }
                }}
                className="mt-6 w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                {cameFromResults ? 'Back to Results' : 'Continue'}
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
                      // Update assumptions based on safety selection
                      const defaults = getDefaultAssumptions(option.key);
                      setAssumptions(prev => ({
                        ...prev,
                        preRetirementReturn: defaults.preRet,
                        postRetirementReturn: defaults.postRet,
                        equityAllocation: defaults.equityAlloc,
                        debtAllocation: 100 - defaults.equityAlloc,
                      }));
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
            <div className="animate-fade-in space-y-6">
              {/* Sticky Result Number */}
              <div className={`sticky top-0 z-10 p-4 md:p-6 rounded-2xl mb-4 ${darkMode ? 'bg-slate-900/95 backdrop-blur-sm border border-slate-700' : 'bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg'}`}>
                <div className="text-center">
                  <div className="text-3xl md:text-5xl font-light text-blue-500 mb-2 animate-number-reveal">
                    {formatCurrency(result.required, result.currency)}
                  </div>
                  <div className={`text-xs md:text-sm ${theme.textSecondaryClass}`}>
                    Annual spend: {formatCurrency(result.annualSpend, result.currency)}
                  </div>
                </div>
              </div>

              {/* Main Result Card */}
              <div className={`p-6 md:p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
                <h2 className={`text-2xl md:text-3xl font-light mb-4 md:mb-6 ${theme.textClass}`}>Your Retirement Number</h2>
                
                <p className={`text-base md:text-lg mb-6 md:mb-8 ${theme.textClass}`}>
                  To sustain your selected lifestyle forever in <span className="font-medium text-blue-500">{answers.country}</span>, you need approximately:
                </p>

                <div className="text-center py-6 md:py-8 mb-6 md:mb-8">
                  <div className="text-4xl md:text-6xl font-light text-blue-500 mb-4 animate-number-reveal">
                    {formatCurrency(result.required, result.currency)}
                  </div>
                  <div className={`text-sm ${theme.textSecondaryClass} mb-4`}>
                    Annual spend: {formatCurrency(result.annualSpend, result.currency)}
                  </div>
                </div>

                {/* Monthly Expenses - One Line Expandable */}
                {customBuckets && (
                  <div className={`p-4 md:p-6 rounded-lg mb-4 ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <button
                      onClick={() => setShowExpenseBreakdown(!showExpenseBreakdown)}
                      className="w-full flex justify-between items-center"
                    >
                      <span className={`font-medium ${theme.textClass}`}>Monthly Expenses</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold text-blue-500`}>
                          {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}/month
                        </span>
                        <svg 
                          className={`w-5 h-5 transition-transform ${showExpenseBreakdown ? 'rotate-180' : ''} ${theme.textClass}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {showExpenseBreakdown && (
                      <div className={`p-4 md:p-6 rounded-lg mb-6 md:mb-8 ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg md:text-xl font-medium ${theme.textClass}`}>Monthly Expense Breakdown</h3>
                      <button
                        onClick={() => setEditingExpenses(!editingExpenses)}
                        className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} ${theme.textClass}`}
                      >
                        {editingExpenses ? 'Done' : 'Edit'}
                      </button>
                    </div>
                    {editingExpenses ? (
                      <div className="space-y-4">
                        {Object.entries(customBuckets).map(([key, bucket]) => {
                          const inRange = bucket.min && bucket.max ? isValueInRange(bucket.value, bucket) : true;
                          return (
                            <div key={key} className="space-y-2">
                              <div className="flex justify-between items-center">
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
                                      : 'bg-white border border-gray-300 text-gray-900'
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
                                    <span>{formatCurrency(bucket.min, result.currency)}</span>
                                    <span>{formatCurrency(bucket.max, result.currency)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className={`pt-4 mt-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${theme.textClass}`}>Total Monthly</span>
                            <span className={`text-lg font-semibold text-blue-500`}>
                              {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}
                            </span>
                          </div>
                          <div className={`text-xs mt-1 ${theme.textSecondaryClass}`}>
                            Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, result.currency)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(customBuckets).map(([key, bucket]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className={`text-sm ${theme.textSecondaryClass}`}>{bucket.label}</span>
                            <span className={`font-medium ${theme.textClass}`}>
                              {formatCurrency(bucket.value, result.currency)}
                            </span>
                          </div>
                        ))}
                        <div className={`pt-2 mt-2 border-t ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${theme.textClass}`}>Total Monthly</span>
                            <span className={`text-lg font-semibold text-blue-500`}>
                              {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}
                            </span>
                          </div>
                          <div className={`text-xs mt-1 ${theme.textSecondaryClass}`}>
                            Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, result.currency)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                    )}
                  </div>
                )}

                {/* Additional Costs - Separate Sections */}
                <div className="space-y-3 mb-6 md:mb-8">
                  {/* Housing */}
                  {housingCost !== null && (
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                      <button
                        onClick={() => setShowHousing(!showHousing)}
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
                                onChange={(e) => setHousingCost(parseFloat(e.target.value) || 0)}
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
                        onClick={() => setShowHealthcare(!showHealthcare)}
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
                              onChange={(e) => setHealthcareCost(parseFloat(e.target.value) || 0)}
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
                        onClick={() => setShowTravel(!showTravel)}
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
                              onChange={(e) => setTravelCost(parseFloat(e.target.value) || 0)}
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
                        onClick={() => setShowEmergencyFund(!showEmergencyFund)}
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
                              onChange={(e) => setEmergencyFund(parseFloat(e.target.value) || 0)}
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

                {/* Savings Plan Summary */}
                {savingsPlan && (
                  <div className={`p-4 md:p-6 rounded-lg mb-6 md:mb-8 ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-blue-50/50 border border-blue-200'}`}>
                    <h3 className={`text-lg md:text-xl font-medium mb-4 ${theme.textClass}`}>Your Savings Plan</h3>
                    {savingsPlan.hasIncomeData ? (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                          <span className={theme.textSecondaryClass}>Years until retirement:</span>
                          <span className={`text-xl font-semibold ${theme.textClass}`}>{savingsPlan.yearsToRetirement} years</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                          <span className={theme.textSecondaryClass}>Monthly savings needed:</span>
                          <span className={`text-xl font-semibold text-blue-500`}>{formatCurrency(Math.round(savingsPlan.monthlySavingsNeeded), result.currency)}</span>
                        </div>
                        {savingsPlan.totalAnnualIncome > 0 && (
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <span className={theme.textSecondaryClass}>Savings rate:</span>
                            <span className={`text-lg font-medium ${theme.textClass}`}>{savingsPlan.savingsRate.toFixed(1)}% of income</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`p-4 rounded-lg ${darkMode ? 'bg-yellow-900/20 border border-yellow-700/50' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-800'} mb-3`}>
                          Add your income information to see how much you need to save monthly.
                        </p>
                        <button
                          onClick={() => setShowIncomeBreakdown(true)}
                          className="text-sm text-blue-500 hover:text-blue-600 underline"
                        >
                          Add income details →
                        </button>
                      </div>
                    )}
                    
                    {/* Collapsible Income Breakdown */}
                    {showIncomeBreakdown && (
                      <div className={`mt-4 p-4 md:p-6 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg md:text-xl font-medium ${theme.textClass}`}>Income & Assets</h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingIncome(!editingIncome)}
                              className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} ${theme.textClass}`}
                            >
                              {editingIncome ? 'Done' : 'Edit'}
                            </button>
                            <button
                              onClick={() => {
                                setShowIncomeBreakdown(false);
                                setEditingIncome(false);
                              }}
                              className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} ${theme.textClass}`}
                            >
                              Hide
                            </button>
                          </div>
                        </div>
                        {editingIncome ? (
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
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                                  {result.currency}
                                </span>
                                <input
                                  type="text"
                                  value={answers.liquidNetWorth ? formatInputValue(answers.liquidNetWorth, result.currency) : ''}
                                  onChange={(e) => {
                                    const parsed = parseInputValue(e.target.value);
                                    setAnswers(prev => ({ ...prev, liquidNetWorth: parsed }));
                                  }}
                                  placeholder={result.currency === '₹' ? '5,00,000' : result.currency === '฿' ? '500,000' : '50,000'}
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                                    darkMode 
                                      ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                              </div>
                            </div>
                            <div>
                              <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                                Annual Income from Job
                              </label>
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                                  {result.currency}
                                </span>
                                <input
                                  type="text"
                                  value={answers.annualIncomeJob ? formatInputValue(answers.annualIncomeJob, result.currency) : ''}
                                  onChange={(e) => {
                                    const parsed = parseInputValue(e.target.value);
                                    setAnswers(prev => ({ ...prev, annualIncomeJob: parsed }));
                                  }}
                                  placeholder={result.currency === '₹' ? '10,00,000' : result.currency === '฿' ? '1,000,000' : '100,000'}
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                                    darkMode 
                                      ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                              </div>
                            </div>
                            <div>
                              <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                                Other Income
                              </label>
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                                  {result.currency}
                                </span>
                                <input
                                  type="text"
                                  value={answers.otherIncome ? formatInputValue(answers.otherIncome, result.currency) : ''}
                                  onChange={(e) => {
                                    const parsed = parseInputValue(e.target.value);
                                    setAnswers(prev => ({ ...prev, otherIncome: parsed }));
                                  }}
                                  placeholder={result.currency === '₹' ? '2,00,000' : result.currency === '฿' ? '200,000' : '20,000'}
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                                    darkMode 
                                      ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                              </div>
                            </div>
                            <div>
                              <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                                Pension
                              </label>
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                                  {result.currency}
                                </span>
                                <input
                                  type="text"
                                  value={answers.pension ? formatInputValue(answers.pension, result.currency) : ''}
                                  onChange={(e) => {
                                    const parsed = parseInputValue(e.target.value);
                                    setAnswers(prev => ({ ...prev, pension: parsed }));
                                  }}
                                  placeholder={result.currency === '₹' ? '3,00,000' : result.currency === '฿' ? '300,000' : '30,000'}
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                                    darkMode 
                                      ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                              </div>
                            </div>
                            <div>
                              <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
                                Monthly Liabilities
                                <div className="relative group">
                                  <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Include monthly EMI payments (car loan, home loan) or any other recurring payments (family support, school fees)
                                  </div>
                                </div>
                              </label>
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                                  {result.currency}
                                </span>
                                <input
                                  type="text"
                                  value={answers.liabilities ? formatInputValue(answers.liabilities, result.currency) : ''}
                                  onChange={(e) => {
                                    const parsed = parseInputValue(e.target.value);
                                    setAnswers(prev => ({ ...prev, liabilities: parsed }));
                                  }}
                                  placeholder={result.currency === '₹' ? '50,000' : result.currency === '฿' ? '50,000' : '5,000'}
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                                    darkMode 
                                      ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {answers.liquidNetWorth && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondaryClass}`}>Liquid Net Worth</span>
                                <span className={`font-medium ${theme.textClass}`}>
                                  {formatCurrency(parseFloat(answers.liquidNetWorth) || 0, result.currency)}
                                </span>
                              </div>
                            )}
                            {answers.annualIncomeJob && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondaryClass}`}>Annual Income from Job</span>
                                <span className={`font-medium ${theme.textClass}`}>
                                  {formatCurrency(parseFloat(answers.annualIncomeJob) || 0, result.currency)}
                                </span>
                              </div>
                            )}
                            {answers.otherIncome && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondaryClass}`}>Other Income</span>
                                <span className={`font-medium ${theme.textClass}`}>
                                  {formatCurrency(parseFloat(answers.otherIncome) || 0, result.currency)}
                                </span>
                              </div>
                            )}
                            {answers.pension && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondaryClass}`}>Pension</span>
                                <span className={`font-medium ${theme.textClass}`}>
                                  {formatCurrency(parseFloat(answers.pension) || 0, result.currency)}
                                </span>
                              </div>
                            )}
                            {answers.liabilities && (
                              <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondaryClass}`}>Monthly Liabilities</span>
                                <span className={`font-medium ${theme.textClass}`}>
                                  {formatCurrency(parseFloat(answers.liabilities) || 0, result.currency)}
                                </span>
                              </div>
                            )}
                            {!answers.liquidNetWorth && !answers.annualIncomeJob && !answers.otherIncome && !answers.pension && !answers.liabilities && (
                              <p className={`text-sm ${theme.textSecondaryClass}`}>No income information added yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3 mb-6 md:mb-8">
                  <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className={theme.textClass}>Aggressive (higher risk)</span>
                      <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.aggressive, result.currency)}</span>
                    </div>
                  </div>
                  <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className={theme.textClass}>Balanced (recommended)</span>
                      <span className="font-medium text-blue-500">{formatCurrency(result.balanced, result.currency)}</span>
                    </div>
                  </div>
                  <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className={theme.textClass}>Very Safe (conservative)</span>
                      <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.conservative, result.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assumptions Panel */}
              <div className={`p-6 md:p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h3 className={`text-xl md:text-2xl font-light ${theme.textClass}`}>Assumptions & Adjustments</h3>
                  <button
                    onClick={() => setAssumptions(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                    className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${theme.textClass}`}
                  >
                    {assumptions.showAdvanced ? 'Simple' : 'Advanced'}
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Age inputs - Only show if income data exists */}
                  {savingsPlan?.hasIncomeData && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Current Age</label>
                        <input
                          type="number"
                          value={assumptions.currentAge}
                          onChange={(e) => setAssumptions(prev => ({ ...prev, currentAge: parseInt(e.target.value) || 35 }))}
                          className={`w-full px-3 py-2 rounded-lg ${
                            darkMode 
                              ? 'bg-slate-900 border border-slate-700 text-gray-100' 
                              : 'bg-white border border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Retirement Age</label>
                        <input
                          type="number"
                          value={assumptions.retirementAge}
                          onChange={(e) => setAssumptions(prev => ({ ...prev, retirementAge: parseInt(e.target.value) || 65 }))}
                          className={`w-full px-3 py-2 rounded-lg ${
                            darkMode 
                              ? 'bg-slate-900 border border-slate-700 text-gray-100' 
                              : 'bg-white border border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Simple mode: Net growth rate */}
                  {!assumptions.showAdvanced && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className={`text-sm font-medium ${theme.textClass}`}>Pre-Retirement Return</label>
                        <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.preRetirementReturn}%</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="0.5"
                        value={assumptions.preRetirementReturn}
                        onChange={(e) => setAssumptions(prev => ({ ...prev, preRetirementReturn: parseFloat(e.target.value) }))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.preRetirementReturn - 3) / (15 - 3)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.preRetirementReturn - 3) / (15 - 3)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                        }}
                      />
                      <div className={`flex justify-between text-xs mt-1 ${theme.textSecondaryClass}`}>
                        <span>3%</span>
                        <span>15%</span>
                      </div>
                    </div>
                  )}

                  {/* Advanced mode: Equity/Bond breakdown - Only show if income data exists */}
                  {assumptions.showAdvanced && savingsPlan?.hasIncomeData && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className={`text-sm font-medium ${theme.textClass}`}>Equity Allocation</label>
                          <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.equityAllocation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={assumptions.equityAllocation}
                          onChange={(e) => {
                            const equity = parseInt(e.target.value);
                            setAssumptions(prev => ({ 
                              ...prev, 
                              equityAllocation: equity,
                              debtAllocation: 100 - equity
                            }));
                          }}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${assumptions.equityAllocation}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${assumptions.equityAllocation}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                          }}
                        />
                        <div className={`flex justify-between text-xs mt-1 ${theme.textSecondaryClass}`}>
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className={`text-sm font-medium ${theme.textClass}`}>Equity Return</label>
                            <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.equityReturn}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="15"
                            step="0.5"
                            value={assumptions.equityReturn}
                            onChange={(e) => setAssumptions(prev => ({ ...prev, equityReturn: parseFloat(e.target.value) }))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.equityReturn - 5) / (15 - 5)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.equityReturn - 5) / (15 - 5)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className={`text-sm font-medium ${theme.textClass}`}>Debt Return</label>
                            <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.debtReturn}%</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="8"
                            step="0.5"
                            value={assumptions.debtReturn}
                            onChange={(e) => setAssumptions(prev => ({ ...prev, debtReturn: parseFloat(e.target.value) }))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.debtReturn - 2) / (8 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.debtReturn - 2) / (8 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                            }}
                          />
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${theme.textSecondaryClass}`}>Weighted Return:</span>
                          <span className={`font-medium ${theme.textClass}`}>
                            {((assumptions.equityReturn * assumptions.equityAllocation / 100) + (assumptions.debtReturn * assumptions.debtAllocation / 100)).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post-retirement return - Only show if income data exists */}
                  {!assumptions.showAdvanced && savingsPlan?.hasIncomeData ? (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className={`text-sm font-medium ${theme.textClass}`}>Post-Retirement Return</label>
                        <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.postRetirementReturn}%</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="8"
                        step="0.5"
                        value={assumptions.postRetirementReturn}
                        onChange={(e) => setAssumptions(prev => ({ ...prev, postRetirementReturn: parseFloat(e.target.value) }))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.postRetirementReturn - 2) / (8 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.postRetirementReturn - 2) / (8 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                        }}
                      />
                      <div className={`flex justify-between text-xs mt-1 ${theme.textSecondaryClass}`}>
                        <span>2%</span>
                        <span>8%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 border-t pt-4 mt-4">
                      <h4 className={`text-sm font-semibold ${theme.textClass}`}>Post-Retirement Income</h4>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className={`text-sm font-medium ${theme.textClass}`}>Post-Retirement Equity Allocation</label>
                          <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.postRetEquityAllocation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={assumptions.postRetEquityAllocation}
                          onChange={(e) => {
                            const equity = parseInt(e.target.value);
                            setAssumptions(prev => ({ 
                              ...prev, 
                              postRetEquityAllocation: equity,
                              postRetDebtAllocation: 100 - equity
                            }));
                          }}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${assumptions.postRetEquityAllocation}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${assumptions.postRetEquityAllocation}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                          }}
                        />
                        <div className={`flex justify-between text-xs mt-1 ${theme.textSecondaryClass}`}>
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className={`text-sm font-medium ${theme.textClass}`}>Post-Retirement Equity Return</label>
                            <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.postRetEquityReturn}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="12"
                            step="0.5"
                            value={assumptions.postRetEquityReturn}
                            onChange={(e) => setAssumptions(prev => ({ ...prev, postRetEquityReturn: parseFloat(e.target.value) }))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.postRetEquityReturn - 5) / (12 - 5)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.postRetEquityReturn - 5) / (12 - 5)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className={`text-sm font-medium ${theme.textClass}`}>Post-Retirement Debt Return</label>
                            <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.postRetDebtReturn}%</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="6"
                            step="0.5"
                            value={assumptions.postRetDebtReturn}
                            onChange={(e) => setAssumptions(prev => ({ ...prev, postRetDebtReturn: parseFloat(e.target.value) }))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.postRetDebtReturn - 2) / (6 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.postRetDebtReturn - 2) / (6 - 2)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                            }}
                          />
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${theme.textSecondaryClass}`}>Post-Retirement Weighted Return:</span>
                          <span className={`font-medium ${theme.textClass}`}>
                            {((assumptions.postRetEquityReturn * assumptions.postRetEquityAllocation / 100) + (assumptions.postRetDebtReturn * assumptions.postRetDebtAllocation / 100)).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inflation */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-sm font-medium ${theme.textClass}`}>Inflation Rate</label>
                      <span className={`text-sm font-medium ${theme.textClass}`}>{assumptions.inflation}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="0.25"
                      value={assumptions.inflation}
                      onChange={(e) => setAssumptions(prev => ({ ...prev, inflation: parseFloat(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((assumptions.inflation - 1) / (6 - 1)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((assumptions.inflation - 1) / (6 - 1)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                      }}
                    />
                    <div className={`flex justify-between text-xs mt-1 ${theme.textSecondaryClass}`}>
                      <span>1%</span>
                      <span>6%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email & Save Section */}
              <div className={`p-6 md:p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
                <h3 className={`text-lg md:text-xl font-medium mb-4 ${theme.textClass}`}>
                  {user ? 'Save your retirement plan' : 'Save your retirement plan'}
                </h3>
                <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                  {user 
                    ? 'Save this plan to your profile to access and edit it later.'
                    : 'Sign up for check-ins to save this plan and track your progress.'}
                </p>
                {emailError && (
                  <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-red-900/30 border border-red-500/50' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>{emailError}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
                </div>
                {(checkingEmail || saving) && (
                  <div className={`mb-4 space-y-1 ${theme.textSecondaryClass} text-sm`}>
                    <p>• Checking if this email is already registered</p>
                    <p>• Creating your account to save your plan</p>
                    <p>• Setting up your profile for future access</p>
                  </div>
                )}
                <button
                  onClick={user ? handleSave : handleEmailSubmit}
                  disabled={checkingEmail || saving || (!user && !email)}
                  className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  {checkingEmail ? 'Verifying email address...' : saving ? (user ? 'Saving...' : 'Creating your account...') : (user ? 'Save Plan' : 'Save & Continue')}
                </button>
              </div>

              {/* Start Over Button */}
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
                    pension: null,
                    liabilities: null
                  });
                  setAssumptions({
                    preRetirementReturn: 8,
                    postRetirementReturn: 5,
                    inflation: 3,
                    currentAge: 35,
                    retirementAge: 65,
                    showAdvanced: false,
                    equityReturn: 10,
                    debtReturn: 4,
                    equityAllocation: 70,
                    debtAllocation: 30,
                    postRetEquityReturn: 8,
                    postRetDebtReturn: 3,
                    postRetEquityAllocation: 50,
                    postRetDebtAllocation: 50,
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
                {user ? 'Your retirement plan has been saved to your profile.' : 'Sign up for check-ins to save this plan and track your progress.'}
              </p>
            </div>
          )}
        </div>
    </div>
  );
};

