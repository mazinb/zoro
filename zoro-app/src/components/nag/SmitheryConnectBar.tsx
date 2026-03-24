'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, KeyRound } from 'lucide-react';

type SmitheryConnectBarProps = {
  compact?: boolean;
  token?: string | null;
  darkMode: boolean;
};

const BASE_USAGE_URL = 'https://smithery.ai/servers/zoro/nag#usage';

function buildUsageUrl(token?: string | null): string {
  const t = token?.trim();
  if (!t) return BASE_USAGE_URL;
  return `${BASE_USAGE_URL}?token=${encodeURIComponent(t)}`;
}

export function SmitheryConnectBar({ compact = false, token, darkMode }: SmitheryConnectBarProps) {
  const usageUrl = buildUsageUrl(token);

  return (
    <div
      className={`rounded-2xl border p-3 sm:p-4 ${
        darkMode ? 'border-white/10 bg-[#111423]' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src="https://smithery.ai/logos/symbol.svg"
          alt="Smithery logo"
          className="mt-0.5 h-8 w-8 shrink-0 rounded-md bg-white p-1"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            Connect in Smithery
          </p>
          {compact ? (
            <p className={`mt-1 text-sm leading-snug ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              Open usage docs and connect this MCP with your token.
            </p>
          ) : (
            <>
              <p className={`mt-1 text-sm leading-snug ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                Use your personal token when connecting this server in Smithery so requests are scoped to your account.
              </p>
              <p className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-mono ${darkMode ? 'bg-black/30 text-slate-200' : 'bg-white text-slate-700'}`}>
                <KeyRound className="h-3.5 w-3.5" />
                token=YOUR_TOKEN
              </p>
            </>
          )}
        </div>
        <Link
          href={usageUrl}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            darkMode ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          Open <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
