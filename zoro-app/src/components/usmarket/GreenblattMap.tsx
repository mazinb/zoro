'use client';

import { useMemo, useState } from 'react';

import { formatPercent } from '@/lib/usmarket/greenblatt-metrics';
import type { GreenblattStockMetrics } from '@/lib/usmarket/types';

const SECTOR_COLORS: Record<string, string> = {
  'Information Technology': '#3b82f6',
  'Health Care': '#10b981',
  Industrials: '#f59e0b',
  'Consumer Discretionary': '#ec4899',
  'Consumer Staples': '#8b5cf6',
  Energy: '#ef4444',
  Materials: '#64748b',
  'Communication Services': '#06b6d4',
  'Real Estate': '#84cc16',
};

const PLOT = {
  width: 760,
  height: 520,
  padLeft: 56,
  padRight: 24,
  padTop: 24,
  padBottom: 56,
};

function scale(value: number, min: number, max: number, size: number): number {
  if (max === min) return size / 2;
  return ((value - min) / (max - min)) * size;
}

interface GreenblattMapProps {
  stocks: GreenblattStockMetrics[];
  darkMode: boolean;
}

export function GreenblattMap({ stocks, darkMode }: GreenblattMapProps) {
  const [hovered, setHovered] = useState<GreenblattStockMetrics | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('all');

  const plottable = useMemo(
    () =>
      stocks.filter(
        (s) =>
          s.earningsYield != null &&
          s.returnOnCapital != null &&
          (selectedSector === 'all' || s.sector === selectedSector),
      ),
    [selectedSector, stocks],
  );

  const sectors = useMemo(
    () => [...new Set(stocks.map((s) => s.sector).filter(Boolean))].sort(),
    [stocks],
  );

  const bounds = useMemo(() => {
    const eyValues = plottable.map((s) => s.earningsYield as number);
    const rocValues = plottable.map((s) => s.returnOnCapital as number);
    const eyMin = Math.min(...eyValues);
    const eyMax = Math.max(...eyValues);
    const rocMin = Math.min(...rocValues);
    const rocMax = Math.max(...rocValues);
    const eyPad = (eyMax - eyMin) * 0.08 || 0.01;
    const rocPad = (rocMax - rocMin) * 0.08 || 0.05;
    return {
      eyMin: Math.max(0, eyMin - eyPad),
      eyMax: eyMax + eyPad,
      rocMin: Math.max(0, rocMin - rocPad),
      rocMax: rocMax + rocPad,
    };
  }, [plottable]);

  const innerW = PLOT.width - PLOT.padLeft - PLOT.padRight;
  const innerH = PLOT.height - PLOT.padTop - PLOT.padBottom;

  const medianEy =
    plottable.length > 0
      ? plottable.reduce((sum, s) => sum + (s.earningsYield ?? 0), 0) / plottable.length
      : 0;
  const medianRoc =
    plottable.length > 0
      ? plottable.reduce((sum, s) => sum + (s.returnOnCapital ?? 0), 0) / plottable.length
      : 0;

  const gridStroke = darkMode ? '#334155' : '#e2e8f0';
  const axisText = darkMode ? '#94a3b8' : '#64748b';
  const labelText = darkMode ? '#e2e8f0' : '#334155';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`text-sm ${axisText}`}>
          Sector
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className={`ml-2 rounded-lg border px-3 py-1.5 text-sm ${
              darkMode
                ? 'border-slate-700 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <option value="all">All sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </label>
        <span className={`text-sm ${axisText}`}>{plottable.length} companies plotted</span>
      </div>

      <div
        className={`overflow-x-auto rounded-2xl border p-4 ${
          darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <svg
          viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
          className="mx-auto w-full max-w-5xl"
          role="img"
          aria-label="Greenblatt index map: earnings yield versus return on capital"
        >
          <rect
            x={PLOT.padLeft}
            y={PLOT.padTop}
            width={innerW}
            height={innerH}
            fill={darkMode ? '#0f172a' : '#ffffff'}
            stroke={gridStroke}
          />

          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={`gx-${t}`}
              x1={PLOT.padLeft + innerW * t}
              y1={PLOT.padTop}
              x2={PLOT.padLeft + innerW * t}
              y2={PLOT.padTop + innerH}
              stroke={gridStroke}
              strokeDasharray="4 4"
            />
          ))}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={`gy-${t}`}
              x1={PLOT.padLeft}
              y1={PLOT.padTop + innerH * t}
              x2={PLOT.padLeft + innerW}
              y2={PLOT.padTop + innerH * t}
              stroke={gridStroke}
              strokeDasharray="4 4"
            />
          ))}

          <line
            x1={PLOT.padLeft + scale(medianEy, bounds.eyMin, bounds.eyMax, innerW)}
            y1={PLOT.padTop}
            x2={PLOT.padLeft + scale(medianEy, bounds.eyMin, bounds.eyMax, innerW)}
            y2={PLOT.padTop + innerH}
            stroke={darkMode ? '#475569' : '#cbd5e1'}
          />
          <line
            x1={PLOT.padLeft}
            y1={PLOT.padTop + innerH - scale(medianRoc, bounds.rocMin, bounds.rocMax, innerH)}
            x2={PLOT.padLeft + innerW}
            y2={PLOT.padTop + innerH - scale(medianRoc, bounds.rocMin, bounds.rocMax, innerH)}
            stroke={darkMode ? '#475569' : '#cbd5e1'}
          />

          <text
            x={PLOT.padLeft + innerW / 2}
            y={PLOT.height - 12}
            textAnchor="middle"
            fill={labelText}
            fontSize="13"
          >
            Earnings yield (EBIT ÷ Enterprise Value) →
          </text>
          <text
            x={16}
            y={PLOT.padTop + innerH / 2}
            textAnchor="middle"
            fill={labelText}
            fontSize="13"
            transform={`rotate(-90 16 ${PLOT.padTop + innerH / 2})`}
          >
            Return on capital (EBIT ÷ invested capital) →
          </text>

          <text x={PLOT.padLeft + innerW - 8} y={PLOT.padTop + 16} textAnchor="end" fill="#10b981" fontSize="11">
            Quality + cheap
          </text>
          <text x={PLOT.padLeft + 8} y={PLOT.padTop + innerH - 8} textAnchor="start" fill="#ef4444" fontSize="11">
            Weak + expensive
          </text>

          {plottable.map((stock) => {
            const x =
              PLOT.padLeft +
              scale(stock.earningsYield as number, bounds.eyMin, bounds.eyMax, innerW);
            const y =
              PLOT.padTop +
              innerH -
              scale(stock.returnOnCapital as number, bounds.rocMin, bounds.rocMax, innerH);
            const color = SECTOR_COLORS[stock.sector] ?? '#6366f1';
            const active = hovered?.symbol === stock.symbol;

            return (
              <g key={stock.symbol}>
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 7 : 5}
                  fill={color}
                  fillOpacity={active ? 0.95 : 0.72}
                  stroke={active ? '#fff' : 'transparent'}
                  strokeWidth={1.5}
                  onMouseEnter={() => setHovered(stock)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                />
                {active && (
                  <text x={x + 8} y={y - 8} fill={labelText} fontSize="11" fontWeight="600">
                    {stock.symbol}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hovered && (
        <div
          className={`rounded-xl border p-4 ${
            darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {hovered.symbol}
            </h3>
            <span className={axisText}>{hovered.name}</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className={axisText}>Return on capital</dt>
              <dd className={labelText}>{formatPercent(hovered.returnOnCapital)}</dd>
            </div>
            <div>
              <dt className={axisText}>Earnings yield</dt>
              <dd className={labelText}>{formatPercent(hovered.earningsYield)}</dd>
            </div>
            <div>
              <dt className={axisText}>Combined rank</dt>
              <dd className={labelText}>{hovered.combinedRank ?? '—'}</dd>
            </div>
            <div>
              <dt className={axisText}>Sector</dt>
              <dd className={labelText}>{hovered.sector}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {sectors.map((sector) => (
          <span key={sector} className="inline-flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SECTOR_COLORS[sector] ?? '#6366f1' }}
            />
            <span className={axisText}>{sector}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
