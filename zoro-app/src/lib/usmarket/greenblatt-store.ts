import type { SupabaseClient } from '@supabase/supabase-js';

import { assignGreenblattRanks } from './greenblatt-metrics';
import { fetchAllGreenblattMetrics } from './fetch-stock-metrics';
import { fetchSp500Constituents } from './sp500-constituents';
import type {
  GreenblattRefreshResult,
  GreenblattSnapshot,
  GreenblattSnapshotMeta,
  GreenblattStockMetrics,
} from './types';

function rowToStock(row: Record<string, unknown>): GreenblattStockMetrics {
  return {
    symbol: String(row.symbol),
    name: String(row.name),
    sector: row.sector != null ? String(row.sector) : '',
    subIndustry: row.sub_industry != null ? String(row.sub_industry) : '',
    ebit: row.ebit != null ? Number(row.ebit) : null,
    enterpriseValue: row.enterprise_value != null ? Number(row.enterprise_value) : null,
    earningsYield: row.earnings_yield != null ? Number(row.earnings_yield) : null,
    returnOnCapital: row.return_on_capital != null ? Number(row.return_on_capital) : null,
    netFixedAssets: row.net_fixed_assets != null ? Number(row.net_fixed_assets) : null,
    workingCapital: row.working_capital != null ? Number(row.working_capital) : null,
    investedCapital: row.invested_capital != null ? Number(row.invested_capital) : null,
    marketCap: row.market_cap != null ? Number(row.market_cap) : null,
    fiscalPeriodEnd: row.fiscal_period_end != null ? String(row.fiscal_period_end) : null,
    rocRank: row.roc_rank != null ? Number(row.roc_rank) : null,
    eyRank: row.ey_rank != null ? Number(row.ey_rank) : null,
    combinedRank: row.combined_rank != null ? Number(row.combined_rank) : null,
  };
}

function stockToRow(stock: GreenblattStockMetrics) {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    sub_industry: stock.subIndustry,
    ebit: stock.ebit,
    enterprise_value: stock.enterpriseValue,
    earnings_yield: stock.earningsYield,
    return_on_capital: stock.returnOnCapital,
    net_fixed_assets: stock.netFixedAssets,
    working_capital: stock.workingCapital,
    invested_capital: stock.investedCapital,
    roc_rank: stock.rocRank,
    ey_rank: stock.eyRank,
    combined_rank: stock.combinedRank,
    market_cap: stock.marketCap,
    fiscal_period_end: stock.fiscalPeriodEnd,
    updated_at: new Date().toISOString(),
  };
}

export async function loadGreenblattSnapshot(
  supabase: SupabaseClient,
): Promise<GreenblattSnapshot | null> {
  const [{ data: metaRow, error: metaError }, { data: stockRows, error: stockError }] =
    await Promise.all([
      supabase.from('us_market_greenblatt_meta').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('us_market_greenblatt_stocks')
        .select('*')
        .order('combined_rank', { ascending: true, nullsFirst: false }),
    ]);

  if (metaError || stockError) {
    throw new Error(metaError?.message ?? stockError?.message ?? 'Failed to load snapshot');
  }
  if (!metaRow || !stockRows?.length) return null;

  const meta: GreenblattSnapshotMeta = {
    refreshedAt: String(metaRow.refreshed_at),
    stockCount: Number(metaRow.stock_count ?? stockRows.length),
    source: String(metaRow.source ?? 'yahoo'),
    errorCount: Number(metaRow.error_count ?? 0),
    notes: metaRow.notes != null ? String(metaRow.notes) : null,
  };

  return {
    meta,
    stocks: stockRows.map((row) => rowToStock(row as Record<string, unknown>)),
  };
}

export async function refreshGreenblattSnapshot(
  supabase: SupabaseClient,
): Promise<GreenblattRefreshResult> {
  const started = Date.now();
  const constituents = await fetchSp500Constituents();
  const { stocks: rawStocks, errors } = await fetchAllGreenblattMetrics(constituents, {
    concurrency: 4,
  });

  const ranked = assignGreenblattRanks(rawStocks).sort((a, b) => {
    if (a.combinedRank == null && b.combinedRank == null) return a.symbol.localeCompare(b.symbol);
    if (a.combinedRank == null) return 1;
    if (b.combinedRank == null) return -1;
    return a.combinedRank - b.combinedRank;
  });

  const refreshedAt = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from('us_market_greenblatt_stocks')
    .delete()
    .neq('symbol', '');

  if (deleteError) {
    throw new Error(`Failed to clear stock cache: ${deleteError.message}`);
  }

  const batchSize = 100;
  for (let i = 0; i < ranked.length; i += batchSize) {
    const batch = ranked.slice(i, i + batchSize).map(stockToRow);
    const { error: insertError } = await supabase.from('us_market_greenblatt_stocks').insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert stock batch: ${insertError.message}`);
    }
  }

  const notes =
    errors.length > 0
      ? `${errors.length} symbols failed during refresh`
      : 'Daily Yahoo Finance refresh';

  const { error: metaUpdateError } = await supabase.from('us_market_greenblatt_meta').upsert({
    id: 1,
    refreshed_at: refreshedAt,
    stock_count: ranked.length,
    source: 'yahoo',
    error_count: errors.length,
    notes,
  });

  if (metaUpdateError) {
    throw new Error(`Failed to update meta: ${metaUpdateError.message}`);
  }

  return {
    ok: true,
    stockCount: ranked.length,
    errorCount: errors.length,
    refreshedAt,
    durationMs: Date.now() - started,
    errors: errors.slice(0, 25),
  };
}

export function isSnapshotStale(refreshedAt: string, maxAgeHours = 24): boolean {
  const ageMs = Date.now() - new Date(refreshedAt).getTime();
  return ageMs > maxAgeHours * 60 * 60 * 1000;
}
