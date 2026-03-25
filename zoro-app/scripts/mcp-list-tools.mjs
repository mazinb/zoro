#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/mcp-list-tools.mjs <mcp-endpoint-url>');
  process.exit(2);
}

const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: 'zoro-mcp-tool-lister', version: '1.0.0' }, { capabilities: {} });

await client.connect(transport);
const tools = await client.listTools();

const names = (tools?.tools || []).map((t) => t?.name).filter(Boolean).sort();
process.stdout.write(JSON.stringify({ url, toolCount: names.length, toolNames: names }, null, 2));
process.stdout.write('\n');

await client.close();

