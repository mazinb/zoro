import { describe, expect, it } from '@jest/globals';

import {
  assignGreenblattRanks,
  computeEarningsYield,
  computeNetFixedAssets,
  computeReturnOnCapital,
  isGreenblattEligible,
} from '../greenblatt-metrics';
import type { GreenblattStockMetrics } from '../types';

describe('greenblatt-metrics', () => {
  it('excludes financials and utilities', () => {
    expect(isGreenblattEligible('Financials')).toBe(false);
    expect(isGreenblattEligible('Utilities')).toBe(false);
    expect(isGreenblattEligible('Information Technology')).toBe(true);
  });

  it('computes net fixed assets from balance sheet components', () => {
    const nfa = computeNetFixedAssets({
      totalAssets: 364_980_000_000,
      currentAssets: 152_987_000_000,
      goodwill: 0,
      intangibleAssets: 0,
    });
    expect(nfa).toBe(211_993_000_000);
  });

  it('computes ROC and earnings yield', () => {
    const ebit = 13_969_000_000;
    const nfa = 16_412_000_000;
    const wc = 11_077_000_000;
    const ev = 177_356_000_000;

    const roc = computeReturnOnCapital(ebit, nfa, wc);
    const ey = computeEarningsYield(ebit, ev);

    expect(roc).toBeCloseTo(0.508, 2);
    expect(ey).toBeCloseTo(0.0787, 3);
  });

  it('assigns combined ranks (lower is better)', () => {
    const stocks: GreenblattStockMetrics[] = [
      {
        symbol: 'AAA',
        name: 'AAA',
        sector: 'Tech',
        subIndustry: '',
        ebit: 100,
        enterpriseValue: 500,
        earningsYield: 0.2,
        returnOnCapital: 0.5,
        netFixedAssets: 100,
        workingCapital: 100,
        investedCapital: 200,
        marketCap: 400,
        fiscalPeriodEnd: '2025-12-31',
        rocRank: null,
        eyRank: null,
        combinedRank: null,
      },
      {
        symbol: 'BBB',
        name: 'BBB',
        sector: 'Tech',
        subIndustry: '',
        ebit: 80,
        enterpriseValue: 400,
        earningsYield: 0.2,
        returnOnCapital: 0.4,
        netFixedAssets: 100,
        workingCapital: 100,
        investedCapital: 200,
        marketCap: 300,
        fiscalPeriodEnd: '2025-12-31',
        rocRank: null,
        eyRank: null,
        combinedRank: null,
      },
      {
        symbol: 'CCC',
        name: 'CCC',
        sector: 'Tech',
        subIndustry: '',
        ebit: 50,
        enterpriseValue: 1000,
        earningsYield: 0.05,
        returnOnCapital: 0.8,
        netFixedAssets: 50,
        workingCapital: 12,
        investedCapital: 62,
        marketCap: 900,
        fiscalPeriodEnd: '2025-12-31',
        rocRank: null,
        eyRank: null,
        combinedRank: null,
      },
    ];

    const ranked = assignGreenblattRanks(stocks);
    const aaa = ranked.find((s) => s.symbol === 'AAA');
    const ccc = ranked.find((s) => s.symbol === 'CCC');

    expect(aaa?.rocRank).toBe(2);
    expect(aaa?.eyRank).toBe(1);
    expect(aaa?.combinedRank).toBe(3);
    expect(ccc?.rocRank).toBe(1);
    expect(ccc?.combinedRank).toBeGreaterThan(3);
  });
});
