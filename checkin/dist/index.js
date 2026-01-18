"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const scheduler_1 = require("./services/scheduler");
const verify_1 = require("./routes/verify");
const verification_1 = require("./services/verification");
const webhooks_1 = require("./routes/webhooks");
const realtime_1 = require("./services/realtime");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Health check 
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// User registration
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, checkin_frequency } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const user = await (0, verification_1.registerUser)(email, checkin_frequency || 'weekly');
        res.json({ success: true, user });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});
// Email verification
app.get('/api/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token required' });
        }
        const result = await (0, verify_1.verifyEmail)(token);
        res.json(result);
    }
    catch (error) {
        console.error('Verification error:', error);
        res.status(400).json({ error: error.message || 'Verification failed' });
    }
});
// Inbound email webhook (Phase 4)
app.post('/webhooks/email', async (req, res) => {
    try {
        const result = await (0, webhooks_1.handleInboundEmail)(req);
        res.status(200).json({ received: true, reply: result });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: error.message || 'Webhook processing failed' });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Health check: http://localhost:${PORT}/health`);
    (0, scheduler_1.startScheduler)();
    // Initialize Realtime Listener
    try {
        realtime_1.realtimeService.initialize();
    }
    catch (error) {
        console.error('Failed to initialize Realtime Service:', error);
    }
});
//# sourceMappingURL=index.js.map