import { NextRequest } from 'next/server';

import {
  MailboxError,
  inboundDomain,
  isLocalPartAvailable,
  mailboxAddressFor,
  validateLocalPart,
} from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

/** GET ?username= — check whether a mailbox username is available. */
export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username')?.trim() ?? '';
    const deviceId = request.nextUrl.searchParams.get('deviceId')?.trim() || undefined;
    const checked = validateLocalPart(username);
    if (!checked.ok) {
      return mailboxJson({
        available: false,
        reason: checked.error,
        domain: inboundDomain(),
      });
    }
    const supabase = getSupabaseServiceRole();
    const available = await isLocalPartAvailable(supabase, checked.localPart, {
      excludeDeviceId: deviceId,
    });
    return mailboxJson({
      available,
      username: checked.localPart,
      address: mailboxAddressFor(checked.localPart),
      domain: inboundDomain(),
      reason: available ? null : 'That username is taken',
    });
  } catch (e) {
    return mailboxErrorResponse(e instanceof MailboxError ? e : e);
  }
}
