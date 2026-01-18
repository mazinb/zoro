"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmail = verifyEmail;
const supabase_1 = require("../services/supabase");
async function verifyEmail(token) {
    // Find user by token
    const { data: user, error: findError } = await supabase_1.supabase
        .from('users')
        .select('id, is_verified')
        .eq('verification_token', token)
        .single();
    if (findError || !user) {
        throw new Error('Invalid or expired verification token');
    }
    if (user.is_verified) {
        return { message: 'Email already verified' };
    }
    // Update user
    const { error: updateError } = await supabase_1.supabase
        .from('users')
        .update({
        is_verified: true,
        verification_token: null,
        updated_at: new Date().toISOString()
    })
        .eq('id', user.id);
    if (updateError)
        throw updateError;
    return { message: 'Email verified successfully' };
}
//# sourceMappingURL=verify.js.map