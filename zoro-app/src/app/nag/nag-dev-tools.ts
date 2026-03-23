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
    description: 'See if an email already has a Zoro account (no email sent).',
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
    description:
      'Email a magic link to open Nags; creates user + user_data when email is new (name required).',
    method: 'POST',
    path: '/api/auth/nag-request-link',
    sampleBody: { email: 'you@example.com', name: 'Alex' },
    mockResponse: () => ({ success: true, created: false }),
  },
  {
    id: 'auth_send_magic_link',
    mcpName: '',
    rowTitle: 'POST /api/auth/send-magic-link',
    section: 'auth',
    description:
      'Shared magic link (used by /nag “Get started” when wired). Body: email, redirectPath (e.g. /nag), optional context "nag", inviteIfUnregistered. Not on the Nags MCP server.',
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
    description:
      'Turn natural language into a schedule draft (OpenAI on the server when configured). Path is /api/nag-parse (not /api/nags/parse).',
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
    description:
      'List nags. Query: token (required), status = active | archived | cancelled | all (default active; all = active + archived, excludes cancelled).',
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
    description:
      'Create a nag. Optional nag_until_done (email): follow-up emails until the user marks done; followup_interval_hours 1–336 or omit for default from frequency.',
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
    description:
      'PATCH: any schedule fields (recomputes next_at when active); status; nag_until_done + followup_interval_hours alone; or task_completed: true alone (marks cycle done, next main occurrence — do not mix with schedule fields).',
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
    description:
      'Same route as PATCH /api/nags/:id — body only { token, task_completed: true } after a reminder cycle (email “until done” nags).',
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
    description: 'Soft-cancel: sets status to cancelled (token as query param).',
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
    description:
      'Reminder send history from user_context.memory_jsonb (outbound rows with nag_id, plus legacy subject Reminder:). Query: token, optional nag_id, limit (1–200, default 50).',
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
    id: 'cron_nags',
    mcpName: '',
    rowTitle: 'POST /api/cron/nags',
    section: 'cron',
    description:
      'GET or POST. Auth: Authorization: Bearer NAG_DISPATCH_KEY only. Logs each run to nag_dispatch_runs. Schedule from Supabase Cron (see docs/nag/supabase-cron.md).',
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
