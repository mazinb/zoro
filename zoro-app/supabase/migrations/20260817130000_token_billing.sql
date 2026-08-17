-- Token billing: Pro = unlimited Cloud AI. Free spends token_balance.
-- Existing credits_balance is migrated (1 credit = 100_000 tokens). IAP credit_1 still grants one pack.

ALTER TABLE public.mobile_entitlements
  ADD COLUMN IF NOT EXISTS token_balance bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_used_total bigint NOT NULL DEFAULT 0;

UPDATE public.mobile_entitlements
SET token_balance = GREATEST(token_balance, COALESCE(credits_balance, 0) * 100000)
WHERE COALESCE(credits_balance, 0) > 0;

-- One-time monthly grant for Free accounts that had no leftover credits.
UPDATE public.mobile_entitlements me
SET token_balance = 100000
WHERE COALESCE(me.token_balance, 0) = 0
  AND NOT public.mobile_effective_is_pro(me.is_pro, me.pro_expires_at);

CREATE OR REPLACE FUNCTION public.mobile_apply_product(
  device_id_in text,
  product_id_in text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pack constant bigint := 100000;
BEGIN
  INSERT INTO public.mobile_devices (device_id) VALUES (device_id_in)
  ON CONFLICT (device_id) DO UPDATE SET last_seen_at = now();

  INSERT INTO public.mobile_entitlements (device_id)
  VALUES (device_id_in)
  ON CONFLICT (device_id) DO NOTHING;

  IF product_id_in LIKE '%pro_monthly%' THEN
    UPDATE public.mobile_entitlements
    SET is_pro = true,
        pro_expires_at = now() + interval '32 days',
        updated_at = now()
    WHERE device_id = device_id_in;
  ELSIF product_id_in LIKE '%credit_1%' THEN
    UPDATE public.mobile_entitlements
    SET token_balance = COALESCE(token_balance, 0) + pack,
        credits_balance = COALESCE(credits_balance, 0) + 1,
        updated_at = now()
    WHERE device_id = device_id_in;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.mobile_consume_import(text, text, boolean);
DROP FUNCTION IF EXISTS public.mobile_consume_import(text, text);
DROP FUNCTION IF EXISTS public.mobile_consume_tokens(text, bigint, boolean, boolean);
DROP FUNCTION IF EXISTS public.mobile_consume_tokens(text, bigint, boolean);
DROP FUNCTION IF EXISTS public.mobile_consume_tokens(text, bigint);

CREATE OR REPLACE FUNCTION public.mobile_consume_tokens(
  device_id_in text,
  tokens_in bigint,
  onboarding_phase_in boolean DEFAULT false,
  grant_only_in boolean DEFAULT false
) RETURNS TABLE(
  device_id_out text,
  is_pro boolean,
  pro_expires_at timestamp with time zone,
  credits_balance integer,
  token_balance bigint,
  tokens_used_total bigint,
  free_ai_month_key text,
  free_ai_used boolean,
  onboarding_imports_used integer,
  onboarding_imports_eligible boolean,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
DECLARE
  ent public.mobile_entitlements%rowtype;
  month_key text;
  now_utc timestamptz := now();
  need bigint := GREATEST(COALESCE(tokens_in, 0), 0);
  monthly_grant constant bigint := 100000;
  pack constant bigint := 100000;
BEGIN
  month_key := to_char((now_utc at time zone 'utc')::date, 'YYYY-MM');

  INSERT INTO public.mobile_devices (device_id) VALUES (device_id_in)
  ON CONFLICT (device_id) DO UPDATE SET last_seen_at = now_utc;

  INSERT INTO public.mobile_entitlements (device_id, free_ai_month_key, free_ai_used, token_balance)
  VALUES (device_id_in, month_key, false, monthly_grant)
  ON CONFLICT (device_id) DO NOTHING;

  SELECT me.* INTO ent
  FROM public.mobile_entitlements me
  WHERE me.device_id = device_id_in;

  IF COALESCE(ent.free_ai_month_key, '') <> month_key THEN
    UPDATE public.mobile_entitlements me
    SET free_ai_month_key = month_key,
        free_ai_used = false,
        token_balance = COALESCE(me.token_balance, 0) +
          CASE WHEN public.mobile_effective_is_pro(me.is_pro, me.pro_expires_at) THEN 0 ELSE monthly_grant END,
        updated_at = now_utc
    WHERE me.device_id = device_id_in;
    SELECT me.* INTO ent FROM public.mobile_entitlements me WHERE me.device_id = device_id_in;
  END IF;

  IF grant_only_in THEN
    RETURN QUERY
      SELECT ent.device_id, ent.is_pro, ent.pro_expires_at, ent.credits_balance,
             COALESCE(ent.token_balance, 0), COALESCE(ent.tokens_used_total, 0),
             ent.free_ai_month_key, ent.free_ai_used,
             COALESCE(ent.onboarding_imports_used, 0),
             COALESCE(ent.onboarding_imports_eligible, true),
             ent.updated_at;
    RETURN;
  END IF;

  IF public.mobile_effective_is_pro(ent.is_pro, ent.pro_expires_at) THEN
    UPDATE public.mobile_entitlements me
    SET tokens_used_total = COALESCE(me.tokens_used_total, 0) + need,
        updated_at = now_utc
    WHERE me.device_id = device_id_in;
  ELSIF onboarding_phase_in AND COALESCE(ent.onboarding_imports_eligible, true)
        AND COALESCE(ent.onboarding_imports_used, 0) < 20 THEN
    IF need > 0 THEN
      UPDATE public.mobile_entitlements me
      SET onboarding_imports_used = COALESCE(me.onboarding_imports_used, 0) + 1,
          tokens_used_total = COALESCE(me.tokens_used_total, 0) + need,
          updated_at = now_utc
      WHERE me.device_id = device_id_in;
    END IF;
  ELSE
    IF COALESCE(ent.token_balance, 0) < GREATEST(need, 1) THEN
      RAISE EXCEPTION 'Not enough tokens';
    END IF;
    IF need > 0 THEN
      UPDATE public.mobile_entitlements me
      SET token_balance = COALESCE(me.token_balance, 0) - need,
          credits_balance = GREATEST(
            0,
            FLOOR((COALESCE(me.token_balance, 0) - need)::numeric / pack)
          )::integer,
          tokens_used_total = COALESCE(me.tokens_used_total, 0) + need,
          free_ai_used = true,
          updated_at = now_utc
      WHERE me.device_id = device_id_in;
    END IF;
  END IF;

  SELECT me.* INTO ent FROM public.mobile_entitlements me WHERE me.device_id = device_id_in;

  RETURN QUERY
    SELECT ent.device_id, ent.is_pro, ent.pro_expires_at, ent.credits_balance,
           COALESCE(ent.token_balance, 0), COALESCE(ent.tokens_used_total, 0),
           ent.free_ai_month_key, ent.free_ai_used,
           COALESCE(ent.onboarding_imports_used, 0),
           COALESCE(ent.onboarding_imports_eligible, true),
           ent.updated_at;
END;
$$;

-- Preflight: month grant + reject if Free has a zero balance. Does not deduct.
CREATE OR REPLACE FUNCTION public.mobile_consume_import(
  device_id_in text,
  kind_in text,
  onboarding_phase_in boolean DEFAULT false
) RETURNS TABLE(
  device_id_out text,
  is_pro boolean,
  pro_expires_at timestamp with time zone,
  credits_balance integer,
  token_balance bigint,
  tokens_used_total bigint,
  free_ai_month_key text,
  free_ai_used boolean,
  onboarding_imports_used integer,
  onboarding_imports_eligible boolean,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF kind_in NOT IN ('asset', 'liability', 'cashflow') THEN
    RAISE EXCEPTION 'Unknown import kind';
  END IF;
  RETURN QUERY
    SELECT * FROM public.mobile_consume_tokens(device_id_in, 0, onboarding_phase_in);
END;
$$;
