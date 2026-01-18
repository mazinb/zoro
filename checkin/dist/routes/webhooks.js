"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInboundEmail = handleInboundEmail;
const supabase_1 = require("../services/supabase");
const webhook_verification_1 = require("../services/webhook-verification");
const email_parser_1 = require("../services/email-parser");
async function handleInboundEmail(req) {
    // Verify webhook signature
    const signature = req.headers['svix-signature'];
    const timestamp = req.headers['svix-timestamp'];
    const webhookId = req.headers['svix-id'];
    // For localhost testing, we might skip signature verification if WEBHOOK_SECRET is not set
    // In production, this should always be verified
    if (process.env.WEBHOOK_SECRET) {
        if (!signature || !timestamp) {
            throw new Error('Missing webhook signature headers');
        }
        const payload = JSON.stringify(req.body);
        const isValid = (0, webhook_verification_1.verifyWebhookSignature)(payload, signature, timestamp, process.env.WEBHOOK_SECRET);
        if (!isValid) {
            throw new Error('Invalid webhook signature');
        }
    }
    else {
        console.warn('WEBHOOK_SECRET not set - skipping signature verification (not recommended for production)');
    }
    const webhookData = req.body;
    // Only process email.received events
    if (webhookData.type !== 'email.received') {
        console.log(`Ignoring webhook type: ${webhookData.type}`);
        return;
    }
    const { from, to, text, html, subject } = webhookData.data;
    // Extract sender email
    const senderEmail = extractEmail(from);
    // Find user by email
    const { data: user, error: userError } = await supabase_1.supabase
        .from('users')
        .select('id')
        .eq('email', senderEmail)
        .eq('is_verified', true)
        .single();
    if (userError || !user) {
        console.log(`No verified user found for email: ${senderEmail}`);
        throw new Error('User not found or not verified');
    }
    // Extract email content (prefer text over html)
    const rawContent = text || html || '';
    const strippedContent = (0, email_parser_1.stripEmailContent)(rawContent);
    // Determine campaign_id if possible (from subject or headers)
    // For now, we'll get the most recent active campaign
    const { data: campaign } = await supabase_1.supabase
        .from('campaigns')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    // Store reply
    const { data: reply, error: replyError } = await supabase_1.supabase
        .from('replies')
        .insert({
        user_id: user.id,
        campaign_id: campaign?.id || null,
        email_content_raw: rawContent,
        email_content_stripped: strippedContent,
        received_at: new Date().toISOString()
    })
        .select()
        .single();
    if (replyError) {
        throw replyError;
    }
    console.log(`Reply stored for user ${user.id}, reply ID: ${reply.id}`);
    // Optional: Send confirmation email
    // await sendReplyConfirmation(senderEmail);
    return reply;
}
function extractEmail(emailString) {
    // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
    const match = emailString.match(/<(.+)>/) || [null, emailString];
    return match[1].trim();
}
//# sourceMappingURL=webhooks.js.map