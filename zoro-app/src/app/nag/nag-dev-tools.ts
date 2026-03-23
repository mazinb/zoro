/**
 * Landing reference: MCP tool names align with `mcp/nag-server.mjs` where present.
 * Extra rows document HTTP-only routes (cron, shared auth). Sample responses are static (no network).
 */

const MOCK_NAG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

export type NagLandingSection = 'auth' | 'parse' | 'nags' | 'logs' | 'profile' | 'cron';

export type NagLandingTool = {
  /** Stable key for React lists (unique). */
  id: string;
  /** MCP tool id when the Cursor MCP server exposes the same contract; empty = HTTP-only. */
  mcpName: string;
  /** Short label in the endpoint list and detail header (unique per row). */
  rowTitle: string;
  section: NagLandingSection;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  sampleBody?: Record<string, unknown> | null;
  mockResponse: (parsedBody: unknown) => unknown;
};

const sectionLabel: Record<NagLandingSection, string> = {
  auth: 'Auth & onboarding',
  parse: 'Parse',
  nags: 'Nags CRUD',
  logs: 'Delivery log',
  profile: 'Profile',
  cron: 'Cron (server)',
};

export function landingSectionTitle(s: NagLandingSection): string {
  return sectionLabel[s];
}

export const NAG_LANDING_TOOLS: NagLandingTool[] = [
  {
    id: 'auth_nag_email_check',
    mcpName: 'nag_email_check',
    rowTitle: 'nag_email_check',
    section: 'auth',
    description: 'Check if an email has an account.',
    method: 'POST',
    path: '/api/auth/nag-email-check',
    sampleBody: { email: 'you@example.com' },
    mockResponse: () => ({ registered: true }),
  },
  {
    id: 'auth_nag_request_link',
    mcpName: 'nag_request_link',
    rowTitle: 'nag_request_link',
    section: 'auth',
    description: 'Email a magic link to open Nags.',
    method: 'POST',
    path: '/api/auth/nag-request-link',
    sampleBody: { email: 'you@example.com', name: 'Alex' },
    mockResponse: () => ({ success: true, created: false }),
  },
  {
    id: 'auth_nag_reset_token',
    mcpName: '',
    rowTitle: 'nag-reset-token',
    section: 'auth',
    description: 'Rotate token and email a fresh /nag link.',
    method: 'POST',
    path: '/api/auth/nag-reset-token',
    sampleBody: {
      token: 'YOUR_TOKEN',
    },
    mockResponse: () => ({ success: true, token: 'NEW_TOKEN' }),
  },
  {
    id: 'auth_send_magic_link',
    mcpName: '',
    rowTitle: 'send-magic-link',
    section: 'auth',
    description: 'Shared magic link (not on Nags MCP server).',
    method: 'POST',
    path: '/api/auth/send-magic-link',
    sampleBody: {
      email: 'you@example.com',
      redirectPath: '/nag',
      context: 'nag',
      inviteIfUnregistered: true,
    },
    mockResponse: () => ({ success: true, registered: true }),
  },
  {
    id: 'nag_parse',
    mcpName: 'nag_parse',
    rowTitle: 'nag_parse',
    section: 'parse',
    description: 'Turn text into a nag draft.',
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
    id: 'nags_list',
    mcpName: 'nags_list',
    rowTitle: 'nags_list',
    section: 'nags',
    description: 'List nags.',
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
          nag_until_done: true,
          followup_interval_hours: 24,
          status: 'active',
          next_at: '2026-03-28T17:00:00.000Z',
          last_sent_at: '2026-03-21T17:00:00.000Z',
        },
      ],
      profile: { email: 'you@example.com', timezone: 'America/New_York' },
    }),
  },
  {
    id: 'nags_create',
    mcpName: 'nags_create',
    rowTitle: 'nags_create',
    section: 'nags',
    description: 'Create a nag.',
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
      nag_until_done: true,
      followup_interval_hours: null,
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
      nag_until_done: true,
      followup_interval_hours: null,
      status: 'active',
      next_at: '2026-04-15T10:00:00.000Z',
      last_sent_at: null,
    }),
  },
  {
    id: 'nags_update',
    mcpName: 'nags_update',
    rowTitle: 'nags_update',
    section: 'nags',
    description: 'Update a nag.',
    method: 'PATCH',
    path: `/api/nags/${MOCK_NAG_ID}`,
    sampleBody: {
      token: 'YOUR_TOKEN',
      time_hhmm: '09:00',
      nag_until_done: true,
      followup_interval_hours: 48,
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
      nag_until_done: true,
      followup_interval_hours: 48,
      status: 'active',
      next_at: '2026-03-28T09:00:00.000Z',
    }),
  },
  {
    id: 'nags_task_completed',
    mcpName: 'nags_update',
    rowTitle: 'nags_update · task_completed',
    section: 'nags',
    description: 'Mark an until-done cycle done.',
    method: 'PATCH',
    path: `/api/nags/${MOCK_NAG_ID}`,
    sampleBody: {
      token: 'YOUR_TOKEN',
      task_completed: true,
    },
    mockResponse: () => ({
      id: MOCK_NAG_ID,
      message: 'Send invoice',
      next_at: '2026-04-04T17:00:00.000Z',
      updated_at: '2026-03-23T12:00:00.000Z',
    }),
  },
  {
    id: 'nags_delete',
    mcpName: 'nags_delete',
    rowTitle: 'nags_delete',
    section: 'nags',
    description: 'Cancel a nag.',
    method: 'DELETE',
    path: `/api/nags/${MOCK_NAG_ID}?token=YOUR_TOKEN`,
    mockResponse: () => ({
      id: MOCK_NAG_ID,
      message: 'Send invoice',
      status: 'cancelled',
    }),
  },
  {
    id: 'nags_sent_log',
    mcpName: 'nags_sent_log',
    rowTitle: 'nags_sent_log',
    section: 'logs',
    description: 'Fetch reminder send history.',
    method: 'GET',
    path: '/api/nags/sent-log?token=YOUR_TOKEN&limit=50',
    mockResponse: () => ({
      log: [
        {
          nag_id: MOCK_NAG_ID,
          sent_at: '2026-03-21T17:00:00.000Z',
          subject: 'Reminder: Send invoice',
          body_preview: 'Send invoice',
          resend_id: 're_abc123',
        },
      ],
    }),
  },
  {
    id: 'nag_profile',
    mcpName: 'nag_profile_set_timezone',
    rowTitle: 'nag_profile_set_timezone',
    section: 'profile',
    description: 'Set user IANA timezone; recomputes next_at for every active nag.',
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
  {
    id: 'user_data_get',
    mcpName: '',
    rowTitle: 'user-data',
    section: 'profile',
    description: 'Fetch user + shared_data.',
    method: 'GET',
    path: '/api/user-data?token=YOUR_TOKEN',
    mockResponse: () => ({
      data: {
        email: 'you@example.com',
        verification_token: 'YOUR_TOKEN',
        shared_data: {
          personality: '…',
          soul_file: '…',
        },
      },
    }),
  },
  {
    id: 'cron_nags',
    mcpName: '',
    rowTitle: 'cron/nags',
    section: 'cron',
    description: 'Dispatch nags cron handler.',
    method: 'POST',
    path: '/api/cron/nags',
    sampleBody: null,
    mockResponse: () => ({
      ok: true,
      checked: 3,
      sent: 2,
      failed: 0,
    }),
  },
];
