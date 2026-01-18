import { auditService } from './audit';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export class WorkflowService {
    private supabase: SupabaseClient;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('WorkflowService: Missing Supabase credentials');
            // Throwing might break the app startup if strict, but better to warn
        }

        // @ts-ignore - We checked above, or let it throw if completely missing
        this.supabase = createClient(supabaseUrl!, supabaseKey!);
    }

    async processSubmission(submission: any) {
        const submissionId = submission.id;
        const userId = submission.user_id;

        await auditService.log('workflow_start', submissionId, 'info', { userId });

        try {
            // 1. Analyze Submission
            const { primary_goal, additional_info } = submission;

            // Parse additional info if string
            let parsedInfo = additional_info;
            if (typeof additional_info === 'string') {
                try {
                    parsedInfo = JSON.parse(additional_info);
                } catch (e) {
                    // ignore
                }
            }

            console.log(`Processing workflow for submission ${submissionId}`);

            // 2. AI Processing (Placeholder)
            const aiResult = await this.mockAiAnalysis(primary_goal, parsedInfo);

            // 3. Save Draft for Review (instead of sending immediately)
            // Check if ai_drafts table exists by trying to insert
            const { data, error } = await this.supabase
                .from('ai_drafts')
                .insert({
                    submission_id: submissionId,
                    ai_response: aiResult,
                    status: 'pending_review'
                })
                .select()
                .single();

            if (error) {
                console.error('Failed to save draft:', error);
                await auditService.log('draft_save_failed', submissionId, 'failure', { error: error.message });
                throw new Error(`Failed to save draft: ${error.message}`);
            }

            console.log(`Draft saved for review: ${data.id}`);
            await auditService.log('draft_created', data.id, 'success', { submissionId, status: 'pending_review' });

            return { success: true, draftId: data.id, status: 'pending_review' };

        } catch (error: any) {
            console.error('Workflow error:', error);
            await auditService.log('workflow_failed', submissionId, 'failure', { error: error.message });
            throw error;
        }
    }

    private async mockAiAnalysis(goal: string, info: any) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            summary: `User wants to achieve ${goal}`,
            suggested_actions: [
                'Review current savings',
                'Set up detailed budget',
                'Schedule advisor meeting'
            ],
            risk_profile: 'moderate' // mocked
        };
    }
}

export const workflowService = new WorkflowService();
