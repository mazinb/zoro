'use client';

import React, { useState } from 'react';
import { Copy } from 'lucide-react';

type Props = {
  serverKey: string;
  url: string;
  token?: string | null;
  className?: string;
};

function buildSnippet(serverKey: string, url: string, token: string): string {
  const safeToken = String(token).replace(/"/g, '\\"');
  const cleanUrl = url.replace(/\/$/, '');
  return `"${serverKey}": {\n  "url": "${cleanUrl}",\n  "headers": {\n    "token": "${safeToken}"\n  }\n}`;
}

export function McpConnectSnippet({ serverKey, url, token, className }: Props) {
  const [copied, setCopied] = useState(false);
  const t = token?.trim() || 'YOUR_TOKEN';
  const snippet = buildSnippet(serverKey, url, t);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Cursor MCP config</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-md border border-current/15 px-2 py-1 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-auto rounded-lg border border-current/15 bg-black/[0.03] p-3 font-mono text-[11px] leading-relaxed dark:bg-white/5">
        {snippet}
      </pre>
    </div>
  );
}

