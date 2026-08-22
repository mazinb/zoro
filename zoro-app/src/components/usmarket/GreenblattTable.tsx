'use client';

import { formatCompactUsd, formatPercent } from '@/lib/usmarket/greenblatt-metrics';
import type { GreenblattStockMetrics } from '@/lib/usmarket/types';

interface GreenblattTableProps {
  stocks: GreenblattStockMetrics[];
  darkMode: boolean;
  limit?: number;
}

export function GreenblattTable({ stocks, darkMode, limit = 50 }: GreenblattTableProps) {
  const rows = stocks
    .filter((s) => s.combinedRank != null)
    .slice(0, limit);

  const headerClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const cellClass = darkMode ? 'text-slate-200' : 'text-slate-800';
  const rowBorder = darkMode ? 'border-slate-800' : 'border-slate-100';

  return (
    <div className="overflow-x-auto rounded-2xl border border-inherit">
      <table className="min-w-full text-left text-sm">
        <thead className={darkMode ? 'bg-slate-800/80' : 'bg-slate-50'}>
          <tr>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>Rank</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>Symbol</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>Company</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>ROC</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>Earnings yield</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>Sector</th>
            <th className={`px-4 py-3 font-medium ${headerClass}`}>EV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((stock) => (
            <tr key={stock.symbol} className={`border-t ${rowBorder}`}>
              <td className={`px-4 py-3 font-mono ${cellClass}`}>{stock.combinedRank}</td>
              <td className={`px-4 py-3 font-semibold ${cellClass}`}>{stock.symbol}</td>
              <td className={`px-4 py-3 ${cellClass}`}>{stock.name}</td>
              <td className={`px-4 py-3 ${cellClass}`}>{formatPercent(stock.returnOnCapital)}</td>
              <td className={`px-4 py-3 ${cellClass}`}>{formatPercent(stock.earningsYield)}</td>
              <td className={`px-4 py-3 ${cellClass}`}>{stock.sector}</td>
              <td className={`px-4 py-3 ${cellClass}`}>{formatCompactUsd(stock.enterpriseValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
