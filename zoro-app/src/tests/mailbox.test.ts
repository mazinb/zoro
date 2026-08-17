import { createHmac } from 'crypto';

import {
  emailClaimBlocked,
  extractEmailAddress,
  hashSecret,
  looksLikePdf,
  parseRecipientList,
  parseResendInbound,
} from '@/lib/mobile-mailbox';
import { verifySvixSignature } from '@/lib/svix-webhook';

describe('mailbox helpers', () => {
  it('normalizes From headers', () => {
    expect(extractEmailAddress('Ada <ada@example.com>')).toBe('ada@example.com');
    expect(extractEmailAddress('ADA@Example.COM')).toBe('ada@example.com');
  });

  it('parses recipient lists', () => {
    expect(parseRecipientList(['zoro-abc@getzoro.com', 'Name <other@x.com>'])).toEqual([
      'zoro-abc@getzoro.com',
      'other@x.com',
    ]);
  });

  it('blocks a second device from the same email', () => {
    expect(emailClaimBlocked({ device_id: 'a' }, 'a')).toBe(false);
    expect(emailClaimBlocked({ device_id: 'a' }, 'b')).toBe(true);
    expect(emailClaimBlocked(null, 'b')).toBe(false);
  });

  it('accepts PDF magic bytes only', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const txt = new Uint8Array([0x68, 0x69, 0x0a, 0x21, 0x21]);
    expect(looksLikePdf(pdf, 'stmt.pdf', 'application/pdf')).toBe(true);
    expect(looksLikePdf(txt, 'stmt.pdf', 'application/pdf')).toBe(false);
    expect(looksLikePdf(pdf, 'stmt.bin', 'application/octet-stream')).toBe(false);
  });

  it('parses Resend inbound payloads', () => {
    const parsed = parseResendInbound({
      type: 'email.received',
      data: {
        id: 'evt_1',
        from: 'Ada <ada@example.com>',
        to: ['zoro-abc@getzoro.com'],
        subject: 'Statement',
        attachments: [
          {
            id: 'att_1',
            filename: 'ibkr.pdf',
            content_type: 'application/pdf',
          },
        ],
      },
    });
    expect(parsed?.from).toBe('ada@example.com');
    expect(parsed?.to).toEqual(['zoro-abc@getzoro.com']);
    expect(parsed?.emailId).toBe('evt_1');
    expect(parsed?.attachments[0].attachmentId).toBe('att_1');
    expect(parsed?.attachments[0].fileName).toBe('ibkr.pdf');
  });

  it('hashes tokens stably', () => {
    expect(hashSecret('zmb_abc')).toHaveLength(64);
    expect(hashSecret('zmb_abc')).toBe(hashSecret('zmb_abc'));
  });
});

describe('svix webhook signatures', () => {
  const secret = `whsec_${Buffer.from('test-secret-bytes-ok').toString('base64')}`;
  const rawBody = '{"type":"email.received"}';
  const svixId = 'msg_1';
  const svixTimestamp = String(Math.floor(Date.now() / 1000));

  function sign(): string {
    const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
    const expected = createHmac('sha256', key).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest('base64');
    return `v1,${expected}`;
  }

  it('accepts a valid signature', () => {
    expect(
      verifySvixSignature({
        rawBody,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: sign(),
      }),
    ).toBe(true);
  });

  it('rejects a bad signature', () => {
    expect(
      verifySvixSignature({
        rawBody,
        secret,
        svixId,
        svixTimestamp,
        svixSignature: 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      }),
    ).toBe(false);
  });
});
