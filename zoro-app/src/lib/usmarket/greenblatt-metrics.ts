import type { GreenblattStockMetrics } from './types';

/** Greenblatt excludes financials and utilities from the Magic Formula universe. */
export const EXCLUDED_SECTORS = new Set([
  'Financials',
  'Utilities',
]);

export function isGreenblattEligible(sector: string): boolean {
  return sector.length > 0 && !EXCLUDED_SECTORS.has(sector);
}

export function computeNetFixedAssets(input: {
  totalAssets?: number | null;
  currentAssets?: number | null;
  goodwill?: number | null;
  intangibleAssets?: number | null;
  grossPpe?: number | null;
  accumulatedDepreciation?: number | null;
}): number | null {
  const {
    totalAssets,
    currentAssets,
    goodwill,
    intangibleAssets,
    grossPpe,
    accumulatedDepreciation,
  } = input;

  if (
    totalAssets != null &&
    currentAssets != null &&
    Number.isFinite(totalAssets) &&
    Number.isFinite(currentAssets)
  ) {
    const intangibles = (goodwill ?? 0) + (intangibleAssets ?? 0);
    return totalAssets - currentAssets - intangibles;
  }

  if (
    grossPpe != null &&
    accumulatedDepreciation != null &&
    Number.isFinite(grossPpe) &&
    Number.isFinite(accumulatedDepreciation)
  ) {
    return grossPpe + accumulatedDepreciation;
  }

  return null;
}

export function computeWorkingCapital(input: {
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  workingCapital?: number | null;
}): number | null {
  if (input.workingCapital != null && Number.isFinite(input.workingCapital)) {
    return input.workingCapital;
  }
  if (
    input.currentAssets != null &&
    input.currentLiabilities != null &&
    Number.isFinite(input.currentAssets) &&
    Number.isFinite(input.currentLiabilities)
  ) {
    return input.currentAssets - input.currentLiabilities;
  }
  return null;
}

export function computeEnterpriseValue(input: {
  enterpriseValue?: number | null;
  marketCap?: number | null;
  totalDebt?: number | null;
  totalCash?: number | null;
}): number | null {
  if (input.enterpriseValue != null && input.enterpriseValue > 0) {
    return input.enterpriseValue;
  }
  if (
    input.marketCap != null &&
    Number.isFinite(input.marketCap) &&
    input.totalDebt != null &&
    input.totalCash != null
  ) {
    return input.marketCap + input.totalDebt - input.totalCash;
  }
  return null;
}

export function computeReturnOnCapital(
  ebit: number | null,
  netFixedAssets: number | null,
  workingCapital: number | null,
): number | null {
  if (ebit == null || !Number.isFinite(ebit) || ebit <= 0) return null;
  if (netFixedAssets == null || workingCapital == null) return null;

  const investedCapital = netFixedAssets + workingCapital;
  if (!Number.isFinite(investedCapital) || investedCapital <= 0) return null;

  return ebit / investedCapital;
}

export function computeEarningsYield(
  ebit: number | null,
  enterpriseValue: number | null,
): number | null {
  if (ebit == null || !Number.isFinite(ebit) || ebit <= 0) return null;
  if (enterpriseValue == null || !Number.isFinite(enterpriseValue) || enterpriseValue <= 0) {
    return null;
  }
  return ebit / enterpriseValue;
}

export function assignGreenblattRanks(stocks: GreenblattStockMetrics[]): GreenblattStockMetrics[] {
  const rankable = stocks.filter(
    (s) => s.returnOnCapital != null && s.earningsYield != null,
  );

  const byRoc = [...rankable].sort(
    (a, b) => (b.returnOnCapital ?? 0) - (a.returnOnCapital ?? 0),
  );
  const byEy = [...rankable].sort(
    (a, b) => (b.earningsYield ?? 0) - (a.earningsYield ?? 0),
  );

  const rocRank = new Map<string, number>();
  const eyRank = new Map<string, number>();

  byRoc.forEach((s, i) => rocRank.set(s.symbol, i + 1));
  byEy.forEach((s, i) => eyRank.set(s.symbol, i + 1));

  return stocks.map((stock) => {
    const roc = rocRank.get(stock.symbol) ?? null;
    const ey = eyRank.get(stock.symbol) ?? null;
    return {
      ...stock,
      rocRank: roc,
      eyRank: ey,
      combinedRank: roc != null && ey != null ? roc + ey : null,
    };
  });
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCompactUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}
