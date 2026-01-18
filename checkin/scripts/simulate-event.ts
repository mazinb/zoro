import { workflowService } from '../src/services/workflow';
import { auditService } from '../src/services/audit';

async function runSimulation() {
    console.log('Starting workflow simulation...');

    const mockSubmission = {
        id: 'simulated-' + Date.now(),
        user_id: 'user-sim-123',
        primary_goal: 'Retire by 40',
        additional_info: JSON.stringify({
            age: 30,
            savings: 50000,
            risk_tolerance: 'high'
        }),
        created_at: new Date().toISOString()
    };

    try {
        const result = await workflowService.processSubmission(mockSubmission);
        console.log('Simulation result:', JSON.stringify(result, null, 2));
        console.log('Simulation PASSED');
    } catch (error) {
        console.error('Simulation FAILED:', error);
        process.exit(1);
    }
}

runSimulation();
