import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createGoalsMcpServer } from '../../../../../mcp/goals-server.mjs';

export const dynamic = 'force-dynamic';

async function handleRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({});
  const server = createGoalsMcpServer();
  await server.connect(transport);
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
