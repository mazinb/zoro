"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowService = exports.WorkflowService = void 0;
const audit_1 = require("./audit");
class WorkflowService {
    async processSubmission(submission) {
        const submissionId = submission.id;
        const userId = submission.user_id;
        await audit_1.auditService.log('workflow_start', submissionId, 'info', { userId });
        try {
            // 1. Analyze Submission
            const { primary_goal, additional_info, goal_details } = submission;
            // Parse additional info if string
            let parsedInfo = additional_info;
            if (typeof additional_info === 'string') {
                try {
                    parsedInfo = JSON.parse(additional_info);
                }
                catch (e) {
                    // ignore
                }
            }
            console.log(`Processing workflow for submission ${submissionId}`);
            // 2. AI Processing (Placeholder)
            const aiResult = await this.mockAiAnalysis(primary_goal, parsedInfo);
            // 3. Act on Result (e.g. update user profile, send email, etc.)
            // For now, just log the result
            await audit_1.auditService.log('ai_analysis_complete', submissionId, 'success', { result: aiResult });
            // TODO: Here you would trigger the next step (e.g. send an email via Resend)
            // await sendWelcomeEmail(userId, aiResult);
            await audit_1.auditService.log('workflow_complete', submissionId, 'success');
            return { success: true, result: aiResult };
        }
        catch (error) {
            console.error('Workflow error:', error);
            await audit_1.auditService.log('workflow_failed', submissionId, 'failure', { error: error.message });
            throw error;
        }
    }
    async mockAiAnalysis(goal, info) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
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
exports.WorkflowService = WorkflowService;
exports.workflowService = new WorkflowService();
//# sourceMappingURL=workflow.js.map