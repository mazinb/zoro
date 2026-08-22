'use client';

import { useMemo, useState } from 'react';

import {
  formatCompactUsd,
  formatPercent,
} from '@/lib/usmarket/greenblatt-metrics';
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

function plotPoint(
  stock: GreenblattStockMetrics,
  bounds: { eyMin: number; eyMax: number; rocMin: number; rocMax: number },
  innerW: number,
  innerH: number,
) {
  const x =
    PLOT.padLeft +
    scale(stock.earningsYield as number, bounds.eyMin, bounds.eyMax, innerW);
  const y =
    PLOT.padTop +
    innerH -
    scale(stock.returnOnCapital as number, bounds.rocMin, bounds.rocMax, innerH);
  return { x, y };
}

function StockDetailPanel({
  stock,
  darkMode,
  pinned,
  onClear,
}: {
  stock: GreenblattStockMetrics;
  darkMode: boolean;
  pinned: boolean;
  onClear?: () => void;
}) {
  const axisText = darkMode ? 'text-slate-400' : 'text-slate-500';
  const labelText = darkMode ? 'text-slate-100' : 'text-slate-900';
  const border = darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const sectorColor = SECTOR_COLORS[stock.sector] ?? '#6366f1';

  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: sectorColor }}
            />
            <h3 className={`text-lg font-semibold ${labelText}`}>{stock.symbol}</h3>
          </div>
          <p className={`mt-1 truncate text-sm ${axisText}`}>{stock.name}</p>
          <p className={`mt-1 text-xs ${axisText}`}>{stock.sector}</p>
        </div>
        {pinned && onClear && (
          <button
            type="button"
            onClick={onClear}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              darkMode
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Clear
          </button>
        )}
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className={axisText}>ROC</dt>
          <dd className={`font-medium ${labelText}`}>{formatPercent(stock.returnOnCapital)}</dd>
        </div>
        <div>
          <dt className={axisText}>Earnings yield</dt>
          <dd className={`font-medium ${labelText}`}>{formatPercent(stock.earningsYield)}</dd>
        </div>
        <div>
          <dt className={axisText}>Score</dt>
          <dd className={`font-medium ${labelText}`}>{stock.combinedRank ?? '—'}</dd>
        </div>
        <div>
          <dt className={axisText}>ROC rank</dt>
          <dd className={`font-medium ${labelText}`}>{stock.rocRank ?? '—'}</dd>
        </div>
        <div>
          <dt className={axisText}>EY rank</dt>
          <dd className={`font-medium ${labelText}`}>{stock.eyRank ?? '—'}</dd>
        </div>
        <div>
          <dt className={axisText}>EBIT</dt>
          <dd className={`font-medium ${labelText}`}>{formatCompactUsd(stock.ebit)}</dd>
        </div>
        <div>
          <dt className={axisText}>EV</dt>
          <dd className={`font-medium ${labelText}`}>{formatCompactUsd(stock.enterpriseValue)}</dd>
        </div>
        <div>
          <dt className={axisText}>Market cap</dt>
          <dd className={`font-medium ${labelText}`}>{formatCompactUsd(stock.marketCap)}</dd>
        </div>
      </dl>
    </div>
  );
}

interface GreenblattMapProps {
  stocks: GreenblattStockMetrics[];
  darkMode: boolean;
  selectedSector: string;
  onSectorChange: (sector: string) => void;
}

export function GreenblattMap({
  stocks,
  darkMode,
  selectedSector,
  onSectorChange,
}: GreenblattMapProps) {
  const [hovered, setHovered] = useState<GreenblattStockMetrics | null>(null);
  const [selected, setSelected] = useState<GreenblattStockMetrics | null>(null);

  const plottableAll = useMemo(
    () => stocks.filter((s) => s.earningsYield != null && s.returnOnCapital != null),
    [stocks],
  );

  const plottable = useMemo(
    () =>
      plottableAll.filter(
        (s) => selectedSector === 'all' || s.sector === selectedSector,
      ),
    [plottableAll, selectedSector],
  );

  const sectors = useMemo(
    () => [...new Set(stocks.map((s) => s.sector).filter(Boolean))].sort(),
    [stocks],
  );

  const bounds = useMemo(() => {
    if (plottable.length === 0) {
      return { eyMin: 0, eyMax: 1, rocMin: 0, rocMax: 1 };
    }
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

  const focused = selected ?? hovered;
  const hasSelection = selected != null;

  function handleSelect(stock: GreenblattStockMetrics) {
    setSelected((current) => (current?.symbol === stock.symbol ? null : stock));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Sector
          <select
            value={selectedSector}
            onChange={(e) => {
              onSectorChange(e.target.value);
              setSelected(null);
            }}
            className={`ml-2 rounded-lg border px-3 py-1.5 text-sm ${
              darkMode
                ? 'border-slate-700 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <option value="all">All</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`grid gap-4 ${focused ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
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
              onClick={() => setSelected(null)}
              className="cursor-default"
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
                pointerEvents="none"
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
                pointerEvents="none"
              />
            ))}

            <line
              x1={PLOT.padLeft + scale(medianEy, bounds.eyMin, bounds.eyMax, innerW)}
              y1={PLOT.padTop}
              x2={PLOT.padLeft + scale(medianEy, bounds.eyMin, bounds.eyMax, innerW)}
              y2={PLOT.padTop + innerH}
              stroke={darkMode ? '#475569' : '#cbd5e1'}
              pointerEvents="none"
            />
            <line
              x1={PLOT.padLeft}
              y1={PLOT.padTop + innerH - scale(medianRoc, bounds.rocMin, bounds.rocMax, innerH)}
              x2={PLOT.padLeft + innerW}
              y2={PLOT.padTop + innerH - scale(medianRoc, bounds.rocMin, bounds.rocMax, innerH)}
              stroke={darkMode ? '#475569' : '#cbd5e1'}
              pointerEvents="none"
            />

            <text
              x={PLOT.padLeft + innerW / 2}
              y={PLOT.height - 12}
              textAnchor="middle"
              fill={labelText}
              fontSize="13"
              pointerEvents="none"
            >
              Earnings yield →
            </text>
            <text
              x={16}
              y={PLOT.padTop + innerH / 2}
              textAnchor="middle"
              fill={labelText}
              fontSize="13"
              transform={`rotate(-90 16 ${PLOT.padTop + innerH / 2})`}
              pointerEvents="none"
            >
              Return on capital →
            </text>

            <text
              x={PLOT.padLeft + innerW - 8}
              y={PLOT.padTop + 16}
              textAnchor="end"
              fill="#10b981"
              fontSize="11"
              pointerEvents="none"
            >
              Cheap + quality
            </text>
            <text
              x={PLOT.padLeft + 8}
              y={PLOT.padTop + innerH - 8}
              textAnchor="start"
              fill="#ef4444"
              fontSize="11"
              pointerEvents="none"
            >
              Expensive + weak
            </text>

            {plottable.map((stock) => {
              const { x, y } = plotPoint(stock, bounds, innerW, innerH);
              const color = SECTOR_COLORS[stock.sector] ?? '#6366f1';
              const isSelected = selected?.symbol === stock.symbol;
              const isHovered = hovered?.symbol === stock.symbol;
              const isActive = isSelected || isHovered;
              const dimmed = hasSelection && !isSelected;

              return (
                <g key={stock.symbol}>
                  <circle
                    cx={x}
                    cy={y}
                    r={16}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelect(stock);
                    }}
                    onMouseEnter={() => setHovered(stock)}
                    onMouseLeave={() => setHovered(null)}
                  />
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r={11}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      opacity={0.9}
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 7 : 5}
                    fill={color}
                    fillOpacity={dimmed ? 0.25 : isActive ? 0.95 : 0.72}
                    stroke={isSelected ? '#ffffff' : isHovered ? color : 'transparent'}
                    strokeWidth={isSelected ? 2 : 1.5}
                    pointerEvents="none"
                  />
                  {isActive && (
                    <text
                      x={x + 10}
                      y={y - 10}
                      fill={labelText}
                      fontSize="11"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {stock.symbol}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {focused && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <StockDetailPanel
              stock={focused}
              darkMode={darkMode}
              pinned={selected?.symbol === focused.symbol}
              onClear={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {sectors.map((sector) => (
          <span key={sector} className="inline-flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SECTOR_COLORS[sector] ?? '#6366f1' }}
            />
            <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{sector}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

