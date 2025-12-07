/**
 * Retirement Calculator Test Cases
 * 
 * Run these tests to verify calculator outputs make sense.
 * Update expected values based on your multiplier adjustments.
 */

import { calculateRetirementNeeds } from './retirementConfig';

interface TestCase {
  name: string;
  inputs: {
    lifestyle: string;
    country: string;
    housing: string;
    healthcare: string;
    travel: string;
    safety: string;
    customMonthlyExpenses?: number;
  };
  expected?: {
    annualSpend?: number;
    required?: number;
    balanced?: number;
  };
}

export const testCases: TestCase[] = [
  {
    name: 'Simple lifestyle in India, own paid housing',
    inputs: {
      lifestyle: 'Simple',
      country: 'India',
      housing: 'own_paid',
      healthcare: 'basic',
      travel: 'rarely',
      safety: 'balanced'
    }
  },
  {
    name: 'Comfortable lifestyle in India, rent modest',
    inputs: {
      lifestyle: 'Comfortable',
      country: 'India',
      housing: 'rent_modest',
      healthcare: 'reliable',
      travel: 'occasionally',
      safety: 'balanced'
    }
  },
  {
    name: 'Very Comfortable lifestyle in Thailand',
    inputs: {
      lifestyle: 'Very Comfortable',
      country: 'Thailand',
      housing: 'rent_nice',
      healthcare: 'top_tier',
      travel: 'frequently',
      safety: 'balanced'
    }
  },
  {
    name: 'Luxury lifestyle in UAE',
    inputs: {
      lifestyle: 'Luxury',
      country: 'UAE',
      housing: 'high_end',
      healthcare: 'vip',
      travel: 'constantly',
      safety: 'balanced'
    }
  },
  {
    name: 'Comfortable in US with custom expenses',
    inputs: {
      lifestyle: 'Comfortable',
      country: 'US',
      housing: 'rent_modest',
      healthcare: 'reliable',
      travel: 'occasionally',
      safety: 'balanced',
      customMonthlyExpenses: 5000
    }
  },
  {
    name: 'Simple lifestyle, ultra safe withdrawal',
    inputs: {
      lifestyle: 'Simple',
      country: 'India',
      housing: 'own_paid',
      healthcare: 'basic',
      travel: 'rarely',
      safety: 'ultra_safe'
    }
  },
  {
    name: 'Luxury lifestyle, aggressive withdrawal',
    inputs: {
      lifestyle: 'Luxury',
      country: 'US',
      housing: 'high_end',
      healthcare: 'vip',
      travel: 'constantly',
      safety: 'aggressive'
    }
  }
];

/**
 * Run all test cases and display results
 */
export function runTests(): void {
  console.log('=== Retirement Calculator Test Results ===\n');
  
  testCases.forEach((testCase, index) => {
    const result = calculateRetirementNeeds(
      testCase.inputs.lifestyle,
      testCase.inputs.country,
      testCase.inputs.housing,
      testCase.inputs.healthcare,
      testCase.inputs.travel,
      testCase.inputs.safety,
      testCase.inputs.customMonthlyExpenses
    );

    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log('Inputs:', testCase.inputs);
    console.log('Results:');
    console.log(`  Annual Spend: ${result.annualSpend.toLocaleString()}`);
    console.log(`  Required (based on safety): ${result.required.toLocaleString()}`);
    console.log(`  Aggressive (5%): ${result.aggressive.toLocaleString()}`);
    console.log(`  Balanced (4%): ${result.balanced.toLocaleString()}`);
    console.log(`  Conservative (3%): ${result.conservative.toLocaleString()}`);
    
    if (testCase.expected) {
      console.log('Expected:');
      if (testCase.expected.annualSpend) {
        console.log(`  Annual Spend: ${testCase.expected.annualSpend.toLocaleString()} (actual: ${result.annualSpend.toLocaleString()})`);
      }
      if (testCase.expected.required) {
        console.log(`  Required: ${testCase.expected.required.toLocaleString()} (actual: ${result.required.toLocaleString()})`);
      }
      if (testCase.expected.balanced) {
        console.log(`  Balanced: ${testCase.expected.balanced.toLocaleString()} (actual: ${result.balanced.toLocaleString()})`);
      }
    }
    console.log('\n');
  });
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
  (window as any).runRetirementTests = runTests;
}

