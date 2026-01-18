export declare class WorkflowService {
    processSubmission(submission: any): Promise<{
        success: boolean;
        result: {
            summary: string;
            suggested_actions: string[];
            risk_profile: string;
        };
    }>;
    private mockAiAnalysis;
}
export declare const workflowService: WorkflowService;
//# sourceMappingURL=workflow.d.ts.map