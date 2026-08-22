'use client';

import Link from 'next/link';
import { ArrowRight, ScatterChart } from 'lucide-react';

import { UsMarketChrome } from '@/components/usmarket/UsMarketChrome';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';

export default function UsMarketPage() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  return (
    <UsMarketChrome
      title="US market screens"
      subtitle="Research views on large-cap US equities. Screens refresh from public market data on a daily cadence and are for education only — not investment advice."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/usmarket/greenblatt"
          className={`group rounded-2xl border p-6 transition-colors ${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`inline-flex rounded-xl p-3 ${theme.accentBgClass}`}>
                <ScatterChart className={`h-6 w-6 ${theme.linkClass}`} />
              </div>
              <h2 className={`mt-4 text-xl font-semibold ${theme.textClass}`}>
                Greenblatt index map
              </h2>
              <p className={`mt-2 leading-7 ${theme.textSecondaryClass}`}>
                Plot S&amp;P 500 names by Return on Capital (quality) and Earnings Yield (cheapness).
                Highlights clusters of opportunity and risk using Joel Greenblatt&apos;s Magic Formula lens.
              </p>
            </div>
            <ArrowRight className={`mt-2 h-5 w-5 shrink-0 ${theme.textSecondaryClass} group-hover:translate-x-0.5 transition-transform`} />
          </div>
          <ul className={`mt-4 space-y-1 text-sm ${theme.textSecondaryClass}`}>
            <li>Excludes Financials and Utilities (Greenblatt convention)</li>
            <li>TTM EBIT from quarterly filings; EV from latest market prices</li>
            <li>Combined rank = ROC rank + earnings-yield rank</li>
          </ul>
        </Link>
      </div>
    </UsMarketChrome>
  );
}
