# Zoro App (web)

Next.js app for **getzoro.com** — forms, API routes, Supabase, email (Resend), and server jobs (e.g. nags). The **iOS/Android client** lives in the sibling folder **`zoro_flutter`** in this monorepo; it uses the same API base URL in production.

---

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Forms and saves go through shared hooks (e.g. `src/hooks/useFormSave.ts`) and `/api/user-data`; see `src/` and `docs/` for specifics.

---

## Deploy (e.g. Vercel)

1. Set **environment variables** in the host (see below).  
2. `npm run build` then start with your host’s process (`npm start` or platform default).  
3. Set **`NEXT_PUBLIC_BASE_URL`** / production origin so magic links and redirects use **https://www.getzoro.com** (or your real host).  
4. Supabase **cron** / server jobs: use **service role** only on the server; see `docs/nag/supabase-cron.md` for nags.

Do **not** commit `.env` or service-role keys.

---

## Environment variables

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — nags, admin routes; never in client bundles |
| `NAG_DISPATCH_KEY` | **Server only** — Bearer for cron nags; match Supabase HTTP job |
| `RESEND_API_KEY` / `RESEND_FROM` | Transactional email |
| `SUBMISSION_NOTIFY_EMAIL` | Where lead/form notifications go |
| `NEXT_PUBLIC_BASE_URL` | Public site URL (default prod: `https://www.getzoro.com`) |
| `GEMINI_API_KEY` | Server: expenses PDF / savings flows that call Gemini |
| `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` | Magic-link and absolute URL resolution |

Schema and migrations live in **Supabase / repo migrations** — treat the database as source of truth, not this README.

---

## Related

- **Mobile:** `../zoro_flutter` — Flutter client, `TASKS.md` there for iOS ship checklist and backlog.  
- **Nags cron:** `docs/nag/supabase-cron.md`
