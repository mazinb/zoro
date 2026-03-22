# `nags` table

Applied via Supabase migration **`create_nags_table`** (`apply_migration`). Includes `set_nags_updated_at` trigger for `updated_at`.

## Columns

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | `REFERENCES users(id) ON DELETE CASCADE` |
| `message` | text | |
| `channel` | text | `email` \| `whatsapp` |
| `frequency` | text | `daily` \| `weekly` \| `monthly` \| `once` |
| `time_hhmm` | text | `HH:MM` (24h), interpreted in **UTC** for MVP |
| `day_of_week` | smallint | 0–6, **0 = Monday … 6 = Sunday**; null if N/A |
| `day_of_month` | smallint | 1–31; null if N/A |
| `end_type` | text | `forever` \| `until_date` \| `occurrences` |
| `until_date` | date | |
| `occurrences_max` | int | |
| `occurrences_remaining` | int | Decremented after each send when `end_type = occurrences` |
| `status` | text | `active` \| `archived` \| `cancelled` |
| `next_at` | timestamptz | Next scheduled send (email cron) |
| `last_sent_at` | timestamptz | |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

## Indexes

- `(user_id, status)`
- Partial on `next_at` where `status = 'active' AND channel = 'email'`

## RLS

`ENABLE ROW LEVEL SECURITY` with **no** policies for `anon` / `authenticated`. Application code uses the **service role** client only after validating the user token in Next.js API routes.
