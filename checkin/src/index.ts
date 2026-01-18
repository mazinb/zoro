import express from 'express';
import dotenv from 'dotenv';
import { startScheduler } from './services/scheduler';
import { verifyEmail } from './routes/verify';
import { registerUser } from './services/verification';
import { handleInboundEmail } from './routes/webhooks';
import { realtimeService } from './services/realtime';
import { adminRouter } from './routes/admin';

dotenv.config();

const app = express();
app.use(express.json());

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

    const user = await registerUser(email, checkin_frequency || 'weekly');
    res.json({ success: true, user });
  } catch (error: any) {
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
    const result = await verifyEmail(token);
    res.json(result);
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
});

// Inbound email webhook (Phase 4)
app.post('/webhooks/email', async (req, res) => {
  try {
    const result = await handleInboundEmail(req);
    res.status(200).json({ received: true, reply: result });
  } catch (error: any) {
    console.error('Webhook error:', error);
  }
});

// Admin Routes for Human Review
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Health check: http://localhost:${PORT}/health`);
  startScheduler();

  // Initialize Realtime Listener
  try {
    realtimeService.initialize();
  } catch (error) {
    console.error('Failed to initialize Realtime Service:', error);
  }
});

