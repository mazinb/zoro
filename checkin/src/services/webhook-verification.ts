import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Resend uses Svix format: v1,{signature}
  const [version, ...signatureParts] = signature.split(',');
  
  if (version !== 'v1') {
    return false;
  }
  
  const expectedSignature = signatureParts.join(',');
  
  // Create signed content
  const signedContent = `${timestamp}.${payload}`;
  
  // Create expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedContent);
  const expectedSig = hmac.digest('base64');
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(expectedSig)
    );
  } catch (error) {
    return false;
  }
}

