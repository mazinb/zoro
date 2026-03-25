'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { McpLandingTool, McpTheme } from './types';

type Props<S extends string> = {
  tools: McpLandingTool<S>[];
  sectionTitle: (section: S) => string;
  theme: McpTheme;
  darkMode: boolean;
  docsOrigin?: string | null;
  title?: string;
  subtitle?: string;
};

function fullUrl(docsOrigin: string | null | undefined, path: string): string {
  const base = (docsOrigin || 'https://www.getzoro.com').replace(/\/$/, '');
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function McpLandingToolsExplorer<S extends string>({
  tools,
  sectionTitle,
  theme,
  darkMode,
  docsOrigin,
  title = 'MCP tools & REST API',
  subtitle = 'Same /api routes.',
}: Props<S>) {
  const [selected, setSelected] = useState<McpLandingTool<S>>(() => tools[0]!);
  const [bodyText, setBodyText] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = selected;
    setBodyText(t.sampleBody && Object.keys(t.sampleBody).length > 0 ? JSON.stringify(t.sampleBody, null, 2) : '');
  }, [selected]);

  useEffect(() => {
    if (tools.length === 0) return;
    if (!tools.some((t) => t.id === selected.id)) setSelected(tools[0]!);
  }, [selected.id, tools]);

  const methodPillClass = useMemo(() => {
    const base =
      'inline-flex min-w-[3rem] shrink-0 justify-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider';
    return (method: McpLandingTool['method']) => {
      if (darkMode) {
        if (method === 'GET') return `${base} bg-emerald-500/20 text-emerald-300`;
        if (method === 'POST') return `${base} bg-sky-500/20 text-sky-300`;
        if (method === 'PATCH') return `${base} bg-amber-500/25 text-amber-200`;
        return `${base} bg-rose-500/20 text-rose-300`;
      }
      if (method === 'GET') return `${base} bg-emerald-100 text-emerald-900`;
      if (method === 'POST') return `${base} bg-sky-100 text-sky-900`;
      if (method === 'PATCH') return `${base} bg-amber-100 text-amber-950`;
      return `${base} bg-rose-100 text-rose-900`;
    };
  }, [darkMode]);

  const runMock = async () => {
    const tool = selected;
    let parsed: unknown = null;
    if (tool.method !== 'GET' && tool.method !== 'DELETE') {
      try {
        const raw = bodyText.trim();
        parsed = raw ? JSON.parse(raw) : tool.sampleBody ?? null;
      } catch {
        setResult({ error: 'Body is not valid JSON.' });
        return;
      }
    }
    setBusy(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 80));
    try {
      setResult(tool.mockResponse(parsed));
    } finally {
      setBusy(false);
    }
  };

  if (tools.length === 0) return null;

  let prevSection = '';

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>{title}</p>
        <p className={`mb-3 text-[11px] leading-snug ${theme.textSecondaryClass}`}>{subtitle}</p>
        <ul className={`rounded-xl border ${theme.borderClass} ${theme.cardBgClass} p-2`} role="list">
          {tools.map((t) => {
            const showSection = t.section !== prevSection;
            prevSection = t.section;
            return (
              <React.Fragment key={t.id}>
                {showSection && (
                  <li className="list-none px-2 pb-2 pt-3 first:pt-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass} opacity-80`}>
                      {sectionTitle(t.section)}
                    </span>
                  </li>
                )}
                <li className="list-none">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(t);
                      setResult(null);
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors ${
                      selected.id === t.id
                        ? `${theme.accentBgClass} ${theme.textClass}`
                        : `hover:bg-black/5 dark:hover:bg-white/5 ${theme.textSecondaryClass}`
                    }`}
                  >
                    <span className={methodPillClass(t.method)}>{t.method}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[12px] font-semibold leading-tight">{t.rowTitle}</span>
                      <span className={`mt-1 block text-[11px] leading-snug ${selected.id === t.id ? 'opacity-95' : 'opacity-80'}`}>
                        {t.description}
                      </span>
                    </span>
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      <div className="min-w-0 lg:col-span-7">
        <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
          REST · same contract in production
        </p>
        <div className={`rounded-xl border p-4 sm:p-5 ${theme.borderClass} ${theme.cardBgClass}`}>
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-current/10 pb-4">
            <span className={methodPillClass(selected.method)}>{selected.method}</span>
            <span className={`font-mono text-[13px] font-semibold sm:text-sm ${theme.textClass}`}>{selected.rowTitle}</span>
          </div>
          {selected.mcpName.trim() && selected.mcpName !== selected.rowTitle && (
            <p className={`mb-3 text-[11px] ${theme.textSecondaryClass}`}>
              MCP tool: <span className="font-mono">{selected.mcpName}</span>
            </p>
          )}
          <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>{selected.description}</p>
          <div
            className={`overflow-x-auto rounded-lg border px-3 py-2.5 font-mono text-[11px] leading-relaxed ${theme.borderClass} ${
              darkMode ? 'bg-black/30' : 'bg-black/[0.03]'
            }`}
          >
            <span className={`select-all ${theme.textClass}`}>{fullUrl(docsOrigin, selected.path)}</span>
          </div>

          {selected.sampleBody != null && Object.keys(selected.sampleBody).length > 0 && (
            <label className={`mt-5 block ${theme.textSecondaryClass}`}>
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide">Sample body (JSON)</span>
              <textarea
                rows={9}
                className={`w-full rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed ${theme.inputBgClass}`}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                spellCheck={false}
              />
            </label>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void runMock()}
            className={`mt-5 w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 sm:w-auto sm:px-8 ${theme.buttonClass}`}
          >
            {busy ? '…' : `Response · ${selected.rowTitle}`}
          </button>

          <pre
            className={`mt-4 max-h-80 overflow-auto rounded-lg border p-4 text-[11px] leading-relaxed ${theme.borderClass} ${
              darkMode ? 'bg-black/25' : 'bg-black/[0.02]'
            } ${theme.textClass}`}
          >
            {result ? JSON.stringify(result, null, 2) : 'Select a tool, then show sample JSON (offline — no request is sent).'}
          </pre>
        </div>
      </div>
    </div>
  );
}

