# Mobile Cloud AI — Qwen on DGX Spark

App Store builds keep calling **getzoro** Cloud AI:

`Flutter → POST /api/mobile/assistant → (Qwen if configured, else Gemini)`

No Spark hostname or `127.0.0.1` belongs in the Flutter binary.

## Environment variables

Set on the Next.js host (`.env.local` for local; Vercel for production):

| Variable | Required | Notes |
|----------|----------|--------|
| `QWEN_BASE_URL` | For Qwen path | OpenAI-compatible base ending in `/v1` (or without — `/v1` is appended). Example local LAN: `http://192.168.1.112:8000/v1`. Production: HTTPS tunnel URL to the Spark. |
| `QWEN_API_KEY` | Recommended | Sent as `Authorization: Bearer …`. Use a shared secret in front of the tunnel; for unauthenticated vLLM any non-empty placeholder (e.g. `vllm`) works. |
| `QWEN_MODEL` | Optional | Defaults to `nvidia/Qwen3.6-35B-A3B-NVFP4` (agent-ready Spark recipe). Must match `GET {QWEN_BASE_URL}/models`. |
| `GEMINI_API_KEY` | Fallback | Used when `QWEN_BASE_URL` is **unset**. Also used by ledger import and other Gemini routes. |

**Selection rule:** if `QWEN_BASE_URL` is set → assistants use Qwen/vLLM; otherwise → Gemini (previous behavior).

Aliases: you may also think of these as “VLLM_*”; the code reads **`QWEN_*` only**.

## Reachability

### Local `npm run dev` (same LAN as Spark)

1. NVIDIA Sync / SSH: host alias `msi` (home `/home/mazin`).
2. vLLM listening on Spark `:8000` (confirm: `ssh msi 'curl -s http://127.0.0.1:8000/v1/models'`).
3. From the Mac: `curl -s http://<spark-lan-ip>:8000/v1/models`.
4. Set `QWEN_BASE_URL=http://<spark-lan-ip>:8000/v1` in `.env.local`.

### Production (Vercel → Spark)

Vercel cannot use your home LAN IP. Put an HTTPS front door in front of Spark `:8000`:

1. Prefer **Cloudflare Tunnel** (or Tailscale Funnel / similar) from the Spark to a hostname you control.
2. Restrict access with Cloudflare Access, a tunnel secret, or a reverse proxy that checks `Authorization` against `QWEN_API_KEY`.
3. Set Vercel env: `QWEN_BASE_URL=https://your-tunnel.example/v1`, `QWEN_API_KEY=…`, `QWEN_MODEL=…`.
4. Do **not** leave vLLM on `0.0.0.0` exposed to the public internet without auth.

### Health probe

`GET /api/mobile/health` returns booleans only:

- `env.qwenBaseUrl` — whether `QWEN_BASE_URL` is set
- `env.qwenApiKey` — whether `QWEN_API_KEY` is set
- `env.geminiApiKey` — Gemini fallback available

## Smoke test

```bash
# Direct to Spark (LAN)
curl -s http://<spark-lan-ip>:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"nvidia/Qwen3.6-35B-A3B-NVFP4","messages":[{"role":"user","content":"Say ok"}],"max_tokens":16}'

# Via local getzoro (after npm run dev + QWEN_* in .env.local)
curl -s http://localhost:3000/api/mobile/assistant \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"smoke-test","system":"You are terse.","user":"Reply with exactly: ok","maxOutputTokens":32}'
```

In the iOS/Android app: enable **Settings → Usage → Cloud AI**, then run any ✨ helper.

## Code

- [`src/lib/mobile-assistant-llm.ts`](../src/lib/mobile-assistant-llm.ts) — Qwen + Gemini backends
- [`src/app/api/mobile/assistant/route.ts`](../src/app/api/mobile/assistant/route.ts) — mobile Cloud AI entry
