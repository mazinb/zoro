import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createNagMcpServer } from '../../../../../mcp/nag-server.mjs';

export const dynamic = 'force-dynamic';

type TransportState = {
  transport: WebStandardStreamableHTTPServerTransport;
};

const transportsBySessionId = new Map<string, TransportState>();
const cleanupTimersBySessionId = new Map<string, ReturnType<typeof setTimeout>>();
const SESSION_TTL_MS = 15 * 60 * 1000;

async function createTransportState(): Promise<TransportState> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    // WebStandardStreamableHTTPServerTransport allows only one initialize per transport instance
    // when session management is enabled, so we create one transport per MCP session.
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createNagMcpServer();
  await server.connect(transport);

  return { transport };
}

async function isInitializationRequest(request: Request): Promise<boolean> {
  if (request.method !== 'POST') return false;

  try {
    const body = await request.clone().json();
    const messages = Array.isArray(body) ? body : [body];
    return messages.some(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>).method === 'initialize'
    );
  } catch {
    // If we can't parse, fall back to "not an init request".
    return false;
  }
}

function rememberSession(sessionId: string, state: TransportState) {
  transportsBySessionId.set(sessionId, state);

  // Safety net to avoid leaking transports if DELETE isn't called.
  const existing = cleanupTimersBySessionId.get(sessionId);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => {
    transportsBySessionId.delete(sessionId);
    cleanupTimersBySessionId.delete(sessionId);
  }, SESSION_TTL_MS);
  cleanupTimersBySessionId.set(sessionId, t);
}

function forgetSession(sessionId: string) {
  transportsBySessionId.delete(sessionId);
  const t = cleanupTimersBySessionId.get(sessionId);
  if (t) clearTimeout(t);
  cleanupTimersBySessionId.delete(sessionId);
}

async function handleRequest(request: Request): Promise<Response> {
  const sessionId = request.headers.get('mcp-session-id') ?? '';

  // 1) Non-initial requests should include mcp-session-id; use the cached transport for that session.
  if (sessionId) {
    const state = transportsBySessionId.get(sessionId);
    if (state) {
      const res = await state.transport.handleRequest(request);
      if (request.method === 'DELETE') forgetSession(sessionId);
      return res;
    }
  }

  // 2) Initialization request: create a fresh transport instance.
  if (await isInitializationRequest(request)) {
    const state = await createTransportState();
    const res = await state.transport.handleRequest(request);

    const nextSessionId = res.headers.get('mcp-session-id') ?? '';
    if (nextSessionId) rememberSession(nextSessionId, state);

    return res;
  }

  // 3) Unknown session / request without initialization: create a short-lived transport to return
  // the appropriate MCP error (e.g. "server not initialized" or "session not found").
  const state = await createTransportState();
  return state.transport.handleRequest(request);
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

