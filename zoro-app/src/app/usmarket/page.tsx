'use client';

import { useEffect, useMemo, useState } from 'react';

import { GreenblattMap } from '@/components/usmarket/GreenblattMap';
import { GreenblattTable } from '@/components/usmarket/GreenblattTable';
import { UsMarketChrome } from '@/components/usmarket/UsMarketChrome';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import type { GreenblattSnapshotMeta, GreenblattStockMetrics } from '@/lib/usmarket/types';

function formatRefreshedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UsMarketPage() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [meta, setMeta] = useState<GreenblattSnapshotMeta | null>(null);
  const [stocks, setStocks] = useState<GreenblattStockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/usmarket')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load');
        setMeta(json.data.meta);
        setStocks(json.data.stocks ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const plottableCount = useMemo(
    () => stocks.filter((s) => s.earningsYield != null && s.returnOnCapital != null).length,
    [stocks],
  );

  return (
    <UsMarketChrome title="US Market">
      {loading && <p className={theme.textSecondaryClass}>Loading…</p>}
      {!loading && error && <p className={theme.textSecondaryClass}>{error}</p>}

      {!loading && !error && meta && (
        <>
          <div
            className={`mb-6 grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4 ${theme.cardBorderClass} ${theme.accentBgClass}`}
          >
            <div>
              <p className={`text-xs ${theme.textSecondaryClass}`}>Universe</p>
              <p className={`text-xl font-semibold ${theme.textClass}`}>{meta.stockCount}</p>
            </div>
            <div>
              <p className={`text-xs ${theme.textSecondaryClass}`}>Plotted</p>
              <p className={`text-xl font-semibold ${theme.textClass}`}>{plottableCount}</p>
            </div>
            <div>
              <p className={`text-xs ${theme.textSecondaryClass}`}>Updated</p>
              <p className={`text-sm font-medium ${theme.textClass}`}>{formatRefreshedAt(meta.refreshedAt)}</p>
            </div>
            <div>
              <p className={`text-xs ${theme.textSecondaryClass}`}>Source</p>
              <p className={`text-sm font-medium ${theme.textClass}`}>{meta.source}</p>
            </div>
          </div>

          <section className="mb-10">
            <GreenblattMap stocks={stocks} darkMode={darkMode} />
          </section>

          <section>
            <h2 className={`mb-3 text-lg font-semibold ${theme.textClass}`}>Ranks</h2>
            <GreenblattTable stocks={stocks} darkMode={darkMode} />
          </section>
        </>
      )}
    </UsMarketChrome>
  );
}
