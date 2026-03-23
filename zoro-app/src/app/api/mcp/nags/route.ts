import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createNagMcpServer } from '../../../../../mcp/nag-server.mjs';

export const dynamic = 'force-dynamic';

type TransportState = {
  transport: WebStandardStreamableHTTPServerTransport;
};

let initPromise: Promise<TransportState> | null = null;

async function getTransportState(): Promise<TransportState> {
  if (!initPromise) {
    initPromise = (async () => {
      const transport = new WebStandardStreamableHTTPServerTransport({
        // Maintain per-session state (Cursor performs multiple HTTP requests for one MCP session).
        sessionIdGenerator: () => randomUUID(),
      });

      const server = createNagMcpServer();
      await server.connect(transport);

      return { transport };
    })();
  }

  return initPromise;
}

export async function GET(request: Request): Promise<Response> {
  const { transport } = await getTransportState();
  return transport.handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  const { transport } = await getTransportState();
  return transport.handleRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  const { transport } = await getTransportState();
  return transport.handleRequest(request);
}

