import YahooFinance from 'yahoo-finance2';

import {
  computeEnterpriseValue,
  computeEarningsYield,
  computeNetFixedAssets,
  computeReturnOnCapital,
  computeWorkingCapital,
  isGreenblattEligible,
} from './greenblatt-metrics';
import type { GreenblattStockMetrics, Sp500Constituent } from './types';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

type FundamentalsRow = Record<string, number | string | Date | undefined>;

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function asIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function sumLastQuarters(rows: FundamentalsRow[], field: string, count = 4): number | null {
  const values = rows
    .map((row) => asNumber(row[field]))
    .filter((v): v is number => v != null);

  if (values.length === 0) return null;
  return values.slice(0, count).reduce((acc, v) => acc + v, 0);
}

export async function fetchStockGreenblattMetrics(
  constituent: Sp500Constituent,
): Promise<GreenblattStockMetrics | null> {
  if (!isGreenblattEligible(constituent.sector)) {
    return null;
  }

  const symbol = constituent.symbol;

  try {
    const [quarterly, quoteSummary] = await Promise.all([
      yahooFinance.fundamentalsTimeSeries(symbol, {
        period1: '2022-01-01',
        type: 'quarterly',
        module: 'all',
      }),
      yahooFinance.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics'],
      }),
    ]);

    const sortedQuarters = [...(quarterly as FundamentalsRow[])].sort((a, b) => {
      const ad = a.date instanceof Date ? a.date.getTime() : 0;
      const bd = b.date instanceof Date ? b.date.getTime() : 0;
      return bd - ad;
    });

    const latest = sortedQuarters[0];
    if (!latest) return null;

    const ebitTtm = sumLastQuarters(sortedQuarters, 'EBIT');
    const netFixedAssets = computeNetFixedAssets({
      totalAssets: asNumber(latest.totalAssets),
      currentAssets: asNumber(latest.currentAssets),
      goodwill: asNumber(latest.goodwill),
      intangibleAssets: asNumber(latest.intangibleAssets),
      grossPpe: asNumber(latest.grossPPE),
      accumulatedDepreciation: asNumber(latest.accumulatedDepreciation),
    });
    const workingCapital = computeWorkingCapital({
      workingCapital: asNumber(latest.workingCapital),
      currentAssets: asNumber(latest.currentAssets),
      currentLiabilities: asNumber(latest.totalCurrentLiabilities ?? latest.otherCurrentLiabilities),
    });

    const financialData = quoteSummary.financialData;
    const keyStats = quoteSummary.defaultKeyStatistics;
    const marketCap = asNumber(financialData?.marketCap ?? keyStats?.marketCap);
    const enterpriseValue = computeEnterpriseValue({
      enterpriseValue: asNumber(financialData?.enterpriseValue ?? keyStats?.enterpriseValue),
      marketCap,
      totalDebt: asNumber(financialData?.totalDebt),
      totalCash: asNumber(financialData?.totalCash),
    });

    const returnOnCapital = computeReturnOnCapital(ebitTtm, netFixedAssets, workingCapital);
    const earningsYield = computeEarningsYield(ebitTtm, enterpriseValue);
    const investedCapital =
      netFixedAssets != null && workingCapital != null
        ? netFixedAssets + workingCapital
        : null;

    return {
      symbol,
      name: constituent.name,
      sector: constituent.sector,
      subIndustry: constituent.subIndustry,
      ebit: ebitTtm,
      enterpriseValue,
      earningsYield,
      returnOnCapital,
      netFixedAssets,
      workingCapital,
      investedCapital,
      marketCap,
      fiscalPeriodEnd: asIsoDate(latest.date),
      rocRank: null,
      eyRank: null,
      combinedRank: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${symbol}: ${message}`);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchAllGreenblattMetrics(
  constituents: Sp500Constituent[],
  options?: { concurrency?: number; onProgress?: (done: number, total: number) => void },
): Promise<{ stocks: GreenblattStockMetrics[]; errors: string[] }> {
  const eligible = constituents.filter((c) => isGreenblattEligible(c.sector));
  const concurrency = options?.concurrency ?? 4;
  const errors: string[] = [];
  let done = 0;

  const rows = await mapWithConcurrency(eligible, concurrency, async (constituent) => {
    try {
      const metrics = await fetchStockGreenblattMetrics(constituent);
      done += 1;
      options?.onProgress?.(done, eligible.length);
      return metrics;
    } catch (error) {
      done += 1;
      options?.onProgress?.(done, eligible.length);
      errors.push(error instanceof Error ? error.message : String(error));
      return null;
    }
  });

  const stocks = rows.filter((row): row is GreenblattStockMetrics => row != null);
  return { stocks, errors };
}
