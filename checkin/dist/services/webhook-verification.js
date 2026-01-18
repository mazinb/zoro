"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
function verifyWebhookSignature(payload, signature, timestamp, secret) {
    // Resend uses Svix format: v1,{signature}
    const [version, ...signatureParts] = signature.split(',');
    if (version !== 'v1') {
        return false;
    }
    const expectedSignature = signatureParts.join(',');
    // Create signed content
    const signedContent = `${timestamp}.${payload}`;
    // Create expected signature
    const hmac = crypto_1.default.createHmac('sha256', secret);
    hmac.update(signedContent);
    const expectedSig = hmac.digest('base64');
    // Use constant-time comparison to prevent timing attacks
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(expectedSig));
    }
    catch (error) {
        return false;
    }
}
//# sourceMappingURL=webhook-verification.js.map