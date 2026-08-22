'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { GreenblattMap } from '@/components/usmarket/GreenblattMap';
import { GreenblattTable } from '@/components/usmarket/GreenblattTable';
import { UsMarketChrome } from '@/components/usmarket/UsMarketChrome';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import type { GreenblattSnapshotMeta, GreenblattStockMetrics } from '@/lib/usmarket/types';

function formatRefreshedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function GreenblattPage() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [meta, setMeta] = useState<GreenblattSnapshotMeta | null>(null);
  const [stocks, setStocks] = useState<GreenblattStockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/usmarket/greenblatt')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? json.hint ?? 'Failed to load screen');
        }
        setMeta(json.data.meta);
        setStocks(json.data.stocks ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load screen'))
      .finally(() => setLoading(false));
  }, []);

  const rankedCount = useMemo(
    () => stocks.filter((s) => s.combinedRank != null).length,
    [stocks],
  );

  const plottableCount = useMemo(
    () => stocks.filter((s) => s.earningsYield != null && s.returnOnCapital != null).length,
    [stocks],
  );

  const topQuadrantCount = useMemo(() => {
    if (!stocks.length) return 0;
    const plottable = stocks.filter((s) => s.earningsYield != null && s.returnOnCapital != null);
    if (!plottable.length) return 0;
    const avgEy = plottable.reduce((sum, s) => sum + (s.earningsYield ?? 0), 0) / plottable.length;
    const avgRoc = plottable.reduce((sum, s) => sum + (s.returnOnCapital ?? 0), 0) / plottable.length;
    return plottable.filter(
      (s) => (s.earningsYield ?? 0) >= avgEy && (s.returnOnCapital ?? 0) >= avgRoc,
    ).length;
  }, [stocks]);

  return (
    <UsMarketChrome
      title="Greenblatt index map"
      subtitle="Joel Greenblatt's Magic Formula plots Return on Capital (operating quality) against Earnings Yield (valuation). Names in the upper-right combine efficient businesses with higher pre-tax yields on enterprise value."
    >
      {loading && <p className={theme.textSecondaryClass}>Loading S&amp;P 500 screen…</p>}

      {!loading && error && (
        <div
          className={`rounded-xl border p-5 ${
            darkMode ? 'border-amber-900/50 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              <p className="mt-2 text-sm opacity-90">
                Apply migration <code>20260822120000_us_market_greenblatt.sql</code>, then trigger{' '}
                <code>POST /api/cron/usmarket-greenblatt</code> with your dispatch key to seed the
                cache.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && meta && (
        <>
          <div
            className={`mb-8 grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-5 ${theme.cardBorderClass} ${theme.accentBgClass}`}
          >
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Eligible universe</p>
              <p className={`text-2xl font-semibold ${theme.textClass}`}>{meta.stockCount} names</p>
              <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>
                S&amp;P 500 minus Financials &amp; Utilities
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Plotted on map</p>
              <p className={`text-2xl font-semibold ${theme.textClass}`}>{plottableCount}</p>
              <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>
                Have both ROC and earnings yield
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Magic Formula ranks</p>
              <p className={`text-2xl font-semibold ${theme.textClass}`}>{rankedCount}</p>
              <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>
                {meta.stockCount - rankedCount} names skipped (missing inputs)
              </p>
            </div>
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Quality + cheap</p>
              <p className={`text-2xl font-semibold ${theme.textClass}`}>{topQuadrantCount}</p>
              <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>Above average on both axes</p>
            </div>
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Last refresh</p>
              <p className={`text-lg font-medium ${theme.textClass}`}>{formatRefreshedAt(meta.refreshedAt)}</p>
            </div>
            <div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>Data source</p>
              <p className={`text-lg font-medium ${theme.textClass}`}>
                {meta.source}
                {meta.stale ? (
                  <span className={`ml-2 text-sm ${theme.textSecondaryClass}`}>(stale)</span>
                ) : null}
              </p>
            </div>
          </div>

          <section className="mb-12">
            <div className="mb-4 flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${theme.textSecondaryClass}`} />
              <h2 className={`text-xl font-semibold ${theme.textClass}`}>Index map</h2>
            </div>
            <GreenblattMap stocks={stocks} darkMode={darkMode} />
          </section>

          <section>
            <h2 className={`mb-4 text-xl font-semibold ${theme.textClass}`}>
              Top Magic Formula ranks
            </h2>
            <p className={`mb-4 text-sm ${theme.textSecondaryClass}`}>
              Combined rank sums the ROC rank and earnings-yield rank (lower is better). Greenblatt
              historically buys a diversified basket of the top 20–30 names and rebalances annually.
            </p>
            <GreenblattTable stocks={stocks} darkMode={darkMode} />
          </section>

          <p className={`mt-10 text-sm leading-6 ${theme.textSecondaryClass}`}>
            Metrics use trailing-four-quarter EBIT, latest balance-sheet invested capital, and current
            enterprise value from Yahoo Finance. Financials and utilities are excluded. This screen is
            for research and education only; it is not a recommendation to buy or sell any security.
          </p>
        </>
      )}
    </UsMarketChrome>
  );
}
