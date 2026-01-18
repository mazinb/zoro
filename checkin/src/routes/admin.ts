import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { auditService } from '../services/audit';

dotenv.config();

const router = express.Router();

// Initialize admin client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Admin routes disabled. Missing Service Role Key.');
}

const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Middleware to check if admin client is available
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Admin service unavailable (missing configuration)' });
    }
    next();
};

// GET /api/admin/drafts?status=pending_review
router.get('/drafts', requireAdmin, async (req, res) => {
    try {
        const status = req.query.status || 'pending_review';

        // @ts-ignore
        const { data, error } = await supabase
            .from('ai_drafts')
            .select('*, form_submissions(email, primary_goal)')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, drafts: data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/drafts/:id/approve
router.post('/drafts/:id/approve', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get the draft
        // @ts-ignore
        const { data: draft, error: fetchError } = await supabase
            .from('ai_drafts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (draft.status !== 'pending_review') {
            return res.status(400).json({ error: `Draft is already ${draft.status}` });
        }

        // 2. Update status to approved/sent
        // TODO: Actually send the email here using Resend...
        // For now, we just mark as sent.

        // @ts-ignore
        const { error: updateError } = await supabase
            .from('ai_drafts')
            .update({
                status: 'sent', // Skipping 'approved' intermediate step for simplicity
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        await auditService.log('draft_approved_and_sent', id, 'success');

        res.json({ success: true, message: 'Draft approved and marked as sent.' });
    } catch (error: any) {
        console.error('Approve error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/drafts/:id/reject
router.post('/drafts/:id/reject', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // @ts-ignore
        const { error } = await supabase
            .from('ai_drafts')
            .update({
                status: 'rejected',
                reviewer_notes: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        await auditService.log('draft_rejected', id, 'info', { reason });

        res.json({ success: true, message: 'Draft rejected.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/drafts/:id/edit
router.post('/drafts/:id/edit', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { ai_response } = req.body;

        if (!ai_response) return res.status(400).json({ error: 'Missing ai_response' });

        // @ts-ignore
        const { error } = await supabase
            .from('ai_drafts')
            .update({
                ai_response,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        await auditService.log('draft_edited', id, 'info');

        res.json({ success: true, message: 'Draft updated.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const adminRouter = router;
