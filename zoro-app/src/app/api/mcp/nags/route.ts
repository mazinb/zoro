import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createNagMcpServer } from '../../../../../mcp/nag-server.mjs';

export const dynamic = 'force-dynamic';

/**
 * Streamable HTTP MCP for Nags.
 *
 * **Stateless mode** (no `sessionIdGenerator`): required for serverless / multi-instance
 * deployments (e.g. Vercel). Stateful sessions were stored in a process-local Map, so any
 * request that hit another instance—or after TTL—got a fresh transport that was never
 * initialized → `Bad Request: Server not initialized`. Toggling the MCP in Cursor forced
 * a new `initialize` and masked the issue.
 *
 * Per `@modelcontextprotocol/sdk`: omit `sessionIdGenerator` for stateless mode; create one
 * transport per HTTP request (never reuse across requests).
 */
async function handleRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Intentionally no sessionIdGenerator → stateless; do not reuse this instance.
  });

  const server = createNagMcpServer();
  await server.connect(transport);

  // Do not `server.close()` here: for SSE (`text/event-stream`) responses, `handleRequest`
  // resolves before the body finishes. Closing immediately tears down the transport while
  // Cursor is still reading the stream → flaky follow-up POSTs / "not initialized" style errors.
  return transport.handleRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request);
}
