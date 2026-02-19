import { CountryData } from './types';

export const countryData: Record<string, CountryData> = {
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
      housing: { value: 15000, label: 'Housing & Utilities', min: 8000, max: 40000, step: 1000 },
      food: { value: 10000, label: 'Food & Dining', min: 5000, max: 25000, step: 500 },
      transportation: { value: 5000, label: 'Transportation', min: 2000, max: 15000, step: 500 },
      healthcare: { value: 4000, label: 'Healthcare & Insurance', min: 1500, max: 12000, step: 500 },
      entertainment: { value: 6000, label: 'Entertainment & Leisure', min: 2000, max: 15000, step: 500 },
      other: { value: 4000, label: 'Other Expenses', min: 1000, max: 10000, step: 500 }
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

export const getCountriesSorted = (): string[] => {
  return Object.keys(countryData).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
};

