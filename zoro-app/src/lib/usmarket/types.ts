export interface Sp500Constituent {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
}

export interface GreenblattStockMetrics {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
  ebit: number | null;
  enterpriseValue: number | null;
  earningsYield: number | null;
  returnOnCapital: number | null;
  netFixedAssets: number | null;
  workingCapital: number | null;
  investedCapital: number | null;
  marketCap: number | null;
  fiscalPeriodEnd: string | null;
  rocRank: number | null;
  eyRank: number | null;
  combinedRank: number | null;
}

export interface GreenblattSnapshotMeta {
  refreshedAt: string;
  stockCount: number;
  source: string;
  errorCount: number;
  notes: string | null;
  stale?: boolean;
}

export interface GreenblattSnapshot {
  meta: GreenblattSnapshotMeta;
  stocks: GreenblattStockMetrics[];
}

export interface GreenblattRefreshResult {
  ok: boolean;
  stockCount: number;
  errorCount: number;
  refreshedAt: string;
  durationMs: number;
  errors?: string[];
}
