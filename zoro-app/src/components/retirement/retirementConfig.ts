/**
 * Retirement Calculator Configuration
 * 
 * This file contains all multipliers and base values used in retirement calculations.
 * Update these values to adjust the calculator's output.
 */

export const RETIREMENT_CONFIG = {
  // Base annual amount (in base currency units)
  baseAmount: 50000,

  // Lifestyle multipliers
  lifestyleMultipliers: {
    'Simple': 0.7,
    'Comfortable': 1.0,
    'Very Comfortable': 1.5,
    'Luxury': 2.5
  },

  // Housing multipliers
  housingMultipliers: {
    'own_paid': 0.8,
    'rent_modest': 1.0,
    'rent_nice': 1.3,
    'own_premium': 1.4,
    'high_end': 2.0
  },

  // Healthcare multipliers
  healthcareMultipliers: {
    'basic': 1.0,
    'reliable': 1.2,
    'top_tier': 1.5,
    'vip': 2.0
  },

  // Travel multipliers
  travelMultipliers: {
    'rarely': 1.0,
    'occasionally': 1.15,
    'frequently': 1.35,
    'constantly': 1.6
  },

  // Safety/Withdrawal rates
  safetyRates: {
    'ultra_safe': { rate: 0.03, label: 'Ultra Safe' },
    'safe': { rate: 0.035, label: 'Safe' },
    'balanced': { rate: 0.04, label: 'Balanced' },
    'aggressive': { rate: 0.045, label: 'Aggressive' }
  },

  // Lifestyle to housing defaults mapping
  lifestyleToHousingDefault: {
    'Simple': 'own_paid',
    'Comfortable': 'rent_modest',
    'Very Comfortable': 'rent_nice',
    'Luxury': 'own_premium'
  }
};

/**
 * Calculate retirement needs based on answers
 * This function can be used for testing
 */
export function calculateRetirementNeeds(
  lifestyle: string,
  country: string,
  housing: string,
  healthcare: string,
  travel: string,
  safety: string,
  customMonthlyExpenses?: number
): {
  annualSpend: number;
  required: number;
  aggressive: number;
  balanced: number;
  conservative: number;
} {
  const { baseAmount, lifestyleMultipliers, housingMultipliers, healthcareMultipliers, travelMultipliers, safetyRates } = RETIREMENT_CONFIG;

  // Country multipliers (from countryData)
  const countryMultipliers: Record<string, number> = {
    'India': 0.8,
    'Thailand': 1.0,
    'UAE': 1.5,
    'Europe': 1.8,
    'US': 2.0,
    'Other': 1.2
  };

  let annualSpend: number;
  
  if (customMonthlyExpenses) {
    annualSpend = customMonthlyExpenses * 12;
  } else {
    annualSpend = baseAmount * 
      (countryMultipliers[country] || 1.2) *
      (lifestyleMultipliers[lifestyle as keyof typeof lifestyleMultipliers] || 1.0) *
      (housingMultipliers[housing as keyof typeof housingMultipliers] || 1.0) *
      (healthcareMultipliers[healthcare as keyof typeof healthcareMultipliers] || 1.0) *
      (travelMultipliers[travel as keyof typeof travelMultipliers] || 1.0);
  }

  const safetyConfig = safetyRates[safety as keyof typeof safetyRates] || safetyRates.balanced;
  const required = annualSpend / safetyConfig.rate;
  const aggressive = annualSpend / 0.05;
  const balanced = annualSpend / 0.04;
  const conservative = annualSpend / 0.03;

  return {
    annualSpend: Math.round(annualSpend),
    required: Math.round(required),
    aggressive: Math.round(aggressive),
    balanced: Math.round(balanced),
    conservative: Math.round(conservative)
  };
}

