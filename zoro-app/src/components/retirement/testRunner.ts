/**
 * Test Runner for Retirement Calculator
 * 
 * Run this file to test the calculator with various scenarios.
 * Usage: Import this file and call runAllTests()
 */

import { calculateRetirementNeeds } from './retirementConfig';
import { testCases } from './retirementTests';

export interface TestResult {
  testName: string;
  inputs: any;
  results: {
    annualSpend: number;
    required: number;
    aggressive: number;
    balanced: number;
    conservative: number;
  };
}

export function runAllTests(): TestResult[] {
  const results: TestResult[] = [];

  testCases.forEach(testCase => {
    const result = calculateRetirementNeeds(
      testCase.inputs.lifestyle,
      testCase.inputs.country,
      testCase.inputs.housing,
      testCase.inputs.healthcare,
      testCase.inputs.travel,
      testCase.inputs.safety,
      testCase.inputs.customMonthlyExpenses
    );

    results.push({
      testName: testCase.name,
      inputs: testCase.inputs,
      results: result
    });
  });

  return results;
}

export function printTestResults(results: TestResult[]): void {
  console.log('=== Retirement Calculator Test Results ===\n');
  
  results.forEach((result, index) => {
    console.log(`Test ${index + 1}: ${result.testName}`);
    console.log('Inputs:', result.inputs);
    console.log('Results:');
    console.log(`  Annual Spend: ${result.results.annualSpend.toLocaleString()}`);
    console.log(`  Required (based on safety): ${result.results.required.toLocaleString()}`);
    console.log(`  Aggressive (5%): ${result.results.aggressive.toLocaleString()}`);
    console.log(`  Balanced (4%): ${result.results.balanced.toLocaleString()}`);
    console.log(`  Conservative (3%): ${result.results.conservative.toLocaleString()}`);
    console.log('\n');
  });
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).runRetirementTests = () => {
    const results = runAllTests();
    printTestResults(results);
    return results;
  };
}

