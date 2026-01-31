# Zoro App

Financial planning application built with Next.js.

## Architecture

### Form System

All forms use a shared `useFormSave` hook located at `src/hooks/useFormSave.ts` that handles:
- Email initialization from loaded data
- Token management (uses `users.verification_token`)
- Auto-saving form progress
- Email validation
- URL token updates

**Forms:**
- Save More (`/save`)
- Big Purchase (`/home`)
- Invest Smarter (`/invest`)
- Insurance (`/insurance`)
- Tax (`/tax`)
- Retirement (`/retire`)

### Database Schema

**Users Table:**
- `id` (UUID, primary key)
- `email` (unique)
- `verification_token` (unique, used for all forms)
- `checkin_frequency`
- `next_checkin_due`
- `is_verified`

**User Data Table:**
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → `users.id`)
- `email` (denormalized)
- `name`
- Form-specific answer columns: `save_more_answers`, `invest_answers`, `insurance_answers`, `tax_answers`, `big_purchase_answers`, `retirement_answers`
- `retirement_expense_buckets` (JSONB)
- `shared_data` (JSONB)
- `updated_at`

**Form Submissions Table:**
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → `users.id`)
- `email`
- `name`
- `goals` (array)
- `net_worth`
- `contact_method`
- `phone`
- `additional_info` (JSONB)
- `conversation_state`
- `selected_option`
- `current_goal_index`
- `call_scheduled_at`

### User Identification Strategy

1. **Token from URL** → Lookup in `users.verification_token`
2. **Email from form** → Lookup in `users.email`
3. **If not found** → Create new user in `users` table with `verification_token`
4. **Save form data** → Save to `user_data` linked to `users.id` via `user_id`

All form responses for a user are grouped by `users.id`.

## Required Database Migration

```sql
-- Add user_id column to user_data table
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- Clean up old data without user_id (optional - delete after migration)
DELETE FROM user_data WHERE user_id IS NULL;
```

## API Endpoints

- `GET /api/user-data?token=...` - Load user data by verification_token
- `POST /api/user-data` - Save form data (creates/updates user and user_data)
- `POST /api/submit` - Handle form submissions (creates user, sends email)

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM` (default: `Zoro <admin@getzoro.com>`)
- `SUBMISSION_NOTIFY_EMAIL`
- `NEXT_PUBLIC_BASE_URL` (default: `https://www.getzoro.com`)

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
