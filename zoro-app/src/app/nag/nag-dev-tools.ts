/**
 * Landing reference: MCP tool names align with `mcp/nag-server.mjs`.
 * Sample responses are static (no network). Paths are origin-relative for prod.
 */

const MOCK_NAG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

export type NagLandingSection = 'auth' | 'parse' | 'nags' | 'profile';

export type NagLandingTool = {
  /** MCP tool id (same string the Cursor MCP server registers) */
  mcpName: string;
  section: NagLandingSection;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  sampleBody?: Record<string, unknown> | null;
  mockResponse: (parsedBody: unknown) => unknown;
};

const sectionLabel: Record<NagLandingSection, string> = {
  auth: 'Auth',
  parse: 'Parse',
  nags: 'Nags',
  profile: 'Profile',
};

export function landingSectionTitle(s: NagLandingSection): string {
  return sectionLabel[s];
}

export const NAG_LANDING_TOOLS: NagLandingTool[] = [
  {
    mcpName: 'nag_email_check',
    section: 'auth',
    description: 'See if an email already has a Zoro account (no email sent).',
    method: 'POST',
    path: '/api/auth/nag-email-check',
    sampleBody: { email: 'you@example.com' },
    mockResponse: () => ({ registered: true }),
  },
  {
    mcpName: 'nag_request_link',
    section: 'auth',
    description: 'Email a magic link to open Nags; new users need a name in the body.',
    method: 'POST',
    path: '/api/auth/nag-request-link',
    sampleBody: { email: 'you@example.com', name: 'Alex' },
    mockResponse: () => ({ success: true, created: false }),
  },
  {
    mcpName: 'nag_parse',
    section: 'parse',
    description: 'Turn natural language into a schedule draft (OpenAI on the server when configured).',
    method: 'POST',
    path: '/api/nag-parse',
    sampleBody: {
      token: 'YOUR_TOKEN',
      text: 'Remind me to file GST every month on the 15th at 10am until 2026-12-31',
      default_channel: 'email',
    },
    mockResponse: () => ({
      draft: {
        message: 'File GST',
        channel: 'email',
        frequency: 'monthly',
        time_hhmm: '10:00',
        day_of_week: null,
        day_of_month: 15,
        end_type: 'until_date',
        until_date: '2026-12-31',
        occurrences_max: null,
        parse_fallback: false,
      },
    }),
  },
  {
    mcpName: 'nags_list',
    section: 'nags',
    description: 'List nags (filter by status: active, archived, cancelled, all).',
    method: 'GET',
    path: '/api/nags?token=YOUR_TOKEN&status=all',
    mockResponse: () => ({
      nags: [
        {
          id: MOCK_NAG_ID,
          message: 'Send invoice',
          channel: 'email',
          frequency: 'weekly',
          time_hhmm: '17:00',
          day_of_week: 4,
          day_of_month: null,
          end_type: 'until_date',
          until_date: '2026-12-31',
          occurrences_max: null,
          occurrences_remaining: null,
          status: 'active',
          next_at: '2026-03-28T17:00:00.000Z',
          last_sent_at: null,
        },
      ],
      profile: { email: 'you@example.com', timezone: 'America/New_York' },
    }),
  },
  {
    mcpName: 'nags_create',
    section: 'nags',
    description: 'Create a nag (email or WhatsApp).',
    method: 'POST',
    path: '/api/nags',
    sampleBody: {
      token: 'YOUR_TOKEN',
      message: 'File GST',
      channel: 'email',
      frequency: 'monthly',
      time_hhmm: '10:00',
      day_of_week: null,
      day_of_month: 15,
      end_type: 'until_date',
      until_date: '2026-12-31',
      occurrences_max: null,
    },
    mockResponse: () => ({
      id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      message: 'File GST',
      channel: 'email',
      frequency: 'monthly',
      time_hhmm: '10:00',
      day_of_week: null,
      day_of_month: 15,
      end_type: 'until_date',
      until_date: '2026-12-31',
      occurrences_max: null,
      occurrences_remaining: null,
      status: 'active',
      next_at: '2026-04-15T10:00:00.000Z',
      last_sent_at: null,
    }),
  },
  {
    mcpName: 'nags_update',
    section: 'nags',
    description: 'PATCH a nag (schedule, message, archive, cancel, etc.).',
    method: 'PATCH',
    path: `/api/nags/${MOCK_NAG_ID}`,
    sampleBody: {
      token: 'YOUR_TOKEN',
      time_hhmm: '09:00',
    },
    mockResponse: (body) => ({
      id: MOCK_NAG_ID,
      message: 'Send invoice',
      channel: 'email',
      frequency: 'weekly',
      time_hhmm:
        typeof body === 'object' &&
        body &&
        'time_hhmm' in body &&
        typeof (body as { time_hhmm?: string }).time_hhmm === 'string'
          ? (body as { time_hhmm: string }).time_hhmm
          : '09:00',
      day_of_week: 4,
      day_of_month: null,
      end_type: 'until_date',
      until_date: '2026-12-31',
      status: 'active',
      next_at: '2026-03-28T09:00:00.000Z',
    }),
  },
  {
    mcpName: 'nags_delete',
    section: 'nags',
    description: 'Soft-cancel a nag (status → cancelled).',
    method: 'DELETE',
    path: `/api/nags/${MOCK_NAG_ID}?token=YOUR_TOKEN`,
    mockResponse: () => ({
      id: MOCK_NAG_ID,
      message: 'Send invoice',
      status: 'cancelled',
    }),
  },
  {
    mcpName: 'nag_profile_set_timezone',
    section: 'profile',
    description: 'Set user IANA timezone; recomputes active nags.',
    method: 'PATCH',
    path: '/api/nag-profile',
    sampleBody: {
      token: 'YOUR_TOKEN',
      timezone: 'America/Los_Angeles',
    },
    mockResponse: (body) => ({
      timezone:
        typeof body === 'object' &&
        body &&
        'timezone' in body &&
        typeof (body as { timezone?: string }).timezone === 'string'
          ? (body as { timezone: string }).timezone
          : 'America/Los_Angeles',
    }),
  },
];
