export type McpLandingSection = string;

export type McpLandingTool = {
  /** Stable key for React lists (unique). */
  id: string;
  /** MCP tool id when the server exposes the same contract; empty = HTTP-only. */
  mcpName: string;
  /** Short label in the endpoint list and detail header (unique per row). */
  rowTitle: string;
  section: McpLandingSection;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  sampleBody?: Record<string, unknown> | null;
  mockResponse: (parsedBody: unknown) => unknown;
};

export type McpTheme = {
  textClass: string;
  textSecondaryClass: string;
  borderClass: string;
  cardBgClass: string;
  accentBgClass: string;
  inputBgClass: string;
  buttonClass: string;
};

