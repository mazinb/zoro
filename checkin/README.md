# Weekly Check-In System

A Node.js application for managing weekly check-in emails using Resend API and Supabase.

## Overview

This system handles:
- User email verification
- Scheduled check-in email delivery
- Processing user replies via inbound email webhooks

## Check-in flows (Zoro app)

The Zoro app exposes token-gated forms that sync to `user_data` and support reminders:

- **Income** — Dashboard by year; yearly summary; AI import from comp statement/offer letter (PDF) to prefill by year for review/edit. Option to add reminders.
- **Assets** — Snapshot per quarter; history per account from snapshots; minimal summary view. Option to add reminders.
- **Expenses** — Monthly estimates and statement import; responsive layout. Option to add reminders.

Reminders use the existing `reminders` table only (no new tables). An external cron/follow-up service is responsible for sending reminders; see `CRON_SERVICE_REFERENCE.md` for DB field details and how to poll or consume reminders.

## Prerequisites

- Node.js 18+ 
- Supabase project
- Resend API key

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```
   RESEND_API_KEY=re_xxxxxxxxx
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   VERIFICATION_BASE_URL=http://localhost:3000
   WEBHOOK_SECRET=your-webhook-signing-secret
   PORT=3000
   ```

   **Note**: For localhost testing, `VERIFICATION_BASE_URL` is set to `http://localhost:3000`. Domain setup (Phase 1) will be done later.

3. **Set up database**:
   - Run the SQL migrations from `IMPLEMENTATION_PLAN.md` in your Supabase SQL editor
   - Or use the Supabase MCP to apply migrations

4. **Run the application**:
   ```bash
   npm run dev
   ```
   
   This will start the server on `http://localhost:3000` with nodemon for auto-reloading during development.

## Implementation Status

- ✅ Phase 2: Database Schema (planned)
- ✅ Phase 3: Outbound Logic (planned)
- ✅ Phase 4: Inbound Logic (planned)
- ⏳ Phase 1: Infrastructure & Accounts (later)
- ⏳ Phase 5: Processing (later)

## API Endpoints

- `POST /api/users/register` - Register a new user
- `GET /api/verify?token=...` - Verify user email
- `POST /webhooks/email` - Receive inbound email webhooks
- `GET /health` - Health check

## Documentation

- See `IMPLEMENTATION_PLAN.md` for detailed implementation guide.
- See `CRON_SERVICE_REFERENCE.md` for how an external cron/follow-up service should use the `reminders` table (fields, `user_key`, scheduling, context).

