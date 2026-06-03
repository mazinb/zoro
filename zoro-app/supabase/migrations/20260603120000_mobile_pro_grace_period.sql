-- Pro access until pro_expires_at + 3 days (billing grace).
CREATE OR REPLACE FUNCTION public.mobile_effective_is_pro(
  is_pro_in boolean,
  pro_expires_at_in timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN pro_expires_at_in IS NULL THEN COALESCE(is_pro_in, false)
    ELSE (now() < pro_expires_at_in + interval '3 days')
  END;
$$;

CREATE OR REPLACE FUNCTION public.mobile_reconcile_pro_status()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.mobile_entitlements
  SET is_pro = false
  WHERE is_pro = true
    AND pro_expires_at IS NOT NULL
    AND now() > pro_expires_at + interval '3 days';
$$;

-- Import credits skip when effective Pro (paid period + grace).
CREATE OR REPLACE FUNCTION public.mobile_consume_import(device_id_in text, kind_in text)
 RETURNS TABLE(
   device_id_out text,
   is_pro boolean,
   pro_expires_at timestamp with time zone,
   credits_balance integer,
   free_ai_month_key text,
   free_ai_used boolean,
   updated_at timestamp with time zone
 )
 LANGUAGE plpgsql
AS $function$
declare
  required_credits integer := 0;
  ent public.mobile_entitlements%rowtype;
  month_key text;
  now_utc timestamptz := now();
begin
  month_key := to_char((now_utc at time zone 'utc')::date, 'YYYY-MM');

  insert into public.mobile_devices (device_id) values (device_id_in)
  on conflict (device_id) do update set last_seen_at = now_utc;

  insert into public.mobile_entitlements (device_id, free_ai_month_key, free_ai_used)
  values (device_id_in, month_key, false)
  on conflict (device_id) do nothing;

  select me.* into ent
  from public.mobile_entitlements me
  where me.device_id = device_id_in;

  if coalesce(ent.free_ai_month_key, '') <> month_key then
    update public.mobile_entitlements me
      set free_ai_month_key = month_key,
          free_ai_used = false
      where me.device_id = device_id_in;

    select me.* into ent
    from public.mobile_entitlements me
    where me.device_id = device_id_in;
  end if;

  if mobile_effective_is_pro(ent.is_pro, ent.pro_expires_at) then
    return query
      select ent.device_id, ent.is_pro, ent.pro_expires_at, ent.credits_balance,
             ent.free_ai_month_key, ent.free_ai_used, ent.updated_at;
    return;
  end if;

  if kind_in = 'asset' then
    required_credits := 2;
  elsif kind_in = 'liability' then
    required_credits := 1;
  elsif kind_in = 'cashflow' then
    required_credits := 1;
  else
    raise exception 'Unknown import kind';
  end if;

  if ent.free_ai_used = false then
    update public.mobile_entitlements me
      set free_ai_used = true
      where me.device_id = device_id_in;

    select me.* into ent
    from public.mobile_entitlements me
    where me.device_id = device_id_in;

    return query
      select ent.device_id, ent.is_pro, ent.pro_expires_at, ent.credits_balance,
             ent.free_ai_month_key, ent.free_ai_used, ent.updated_at;
    return;
  end if;

  if ent.credits_balance < required_credits then
    raise exception 'Not enough credits';
  end if;

  update public.mobile_entitlements me
    set credits_balance = me.credits_balance - required_credits
    where me.device_id = device_id_in;

  select me.* into ent
  from public.mobile_entitlements me
  where me.device_id = device_id_in;

  return query
    select ent.device_id, ent.is_pro, ent.pro_expires_at, ent.credits_balance,
           ent.free_ai_month_key, ent.free_ai_used, ent.updated_at;
end;
$function$;
