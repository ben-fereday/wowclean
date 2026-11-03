alter table public.promo_codes add column usage_limit text not null default 'unlimited'
  check (usage_limit in ('unlimited', 'once_per_email', 'single_use'));
update public.promo_codes
set usage_limit = case when max_uses_per_user is null then 'unlimited' else 'once_per_email' end,
    max_uses_per_user = null
where scope = 'booking';

create index bookings_promo_email_lookup on public.bookings
  ((upper(btrim(promo_code))), (lower(btrim(guest_email))))
  where promo_code is not null;

-- Private trigger: enforced in the same transaction as the booking INSERT.
-- No customer data or privileged helper is exposed through a public RPC.
create schema if not exists wowclean_private;
revoke all on schema wowclean_private from public, anon, authenticated;
create function wowclean_private.enforce_booking_promo()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare offer public.promo_codes%rowtype; email_key text;
begin
  if new.promo_code is null or btrim(new.promo_code) = '' then
    if new.promo_discount_pct is not null then raise exception 'PROMO: Reapply your promo code.'; end if;
    return new;
  end if;
  new.promo_code := upper(btrim(new.promo_code));
  email_key := lower(btrim(coalesce(new.guest_email, '')));
  -- A common row lock serializes all booking submissions for this code.
  select * into offer from public.promo_codes
    where code = new.promo_code and scope = 'booking' for update;
  if not found or not offer.active then
    raise exception 'PROMO: This promo code is invalid or inactive.';
  end if;
  if new.promo_discount_pct is distinct from offer.discount_pct then
    raise exception 'PROMO: This offer changed. Please apply the code again.';
  end if;
  if offer.usage_limit = 'once_per_email' then
    if length(email_key) > 254 or email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'PROMO: Enter a valid booking email to use this code.';
    end if;
    if exists(select 1 from public.bookings b where upper(btrim(b.promo_code)) = offer.code
        and lower(btrim(b.guest_email)) = email_key) then
      raise exception 'PROMO: This email address has already used this code.';
    end if;
  elsif offer.usage_limit = 'single_use' then
    if exists(select 1 from public.bookings b where upper(btrim(b.promo_code)) = offer.code) then
      raise exception 'PROMO: This single-use code has already been used.';
    end if;
  end if;
  return new;
end $$;
revoke all on function wowclean_private.enforce_booking_promo() from public, anon, authenticated;
create trigger enforce_booking_promo before insert on public.bookings
for each row execute function wowclean_private.enforce_booking_promo();

-- Server-only preview; it never consumes a use. The trigger rechecks at save.
create function public.preview_booking_promo(p_code text, p_email text default '')
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare offer public.promo_codes%rowtype; email_key text := lower(btrim(coalesce(p_email, '')));
begin
  select * into offer from public.promo_codes where code = upper(btrim(p_code)) and scope = 'booking';
  if not found or not offer.active then
    return jsonb_build_object('valid', false, 'error', 'This promo code is invalid or inactive.');
  end if;
  if offer.usage_limit = 'once_per_email' then
    if length(email_key) > 254 or email_key !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      return jsonb_build_object('valid', false, 'error', 'Enter your booking email before applying this code.');
    end if;
    if exists(select 1 from public.bookings b where upper(btrim(b.promo_code)) = offer.code
        and lower(btrim(b.guest_email)) = email_key) then
      return jsonb_build_object('valid', false, 'error', 'This email address has already used this code.');
    end if;
  elsif offer.usage_limit = 'single_use' then
    if exists(select 1 from public.bookings b where upper(btrim(b.promo_code)) = offer.code) then
      return jsonb_build_object('valid', false, 'error', 'This single-use code has already been used.');
    end if;
  end if;
  return jsonb_build_object('valid', true, 'code_id', offer.id, 'code_text', offer.code, 'discount_pct', offer.discount_pct);
end $$;
revoke all on function public.preview_booking_promo(text,text) from public, anon, authenticated;
grant execute on function public.preview_booking_promo(text,text) to service_role;

-- Keep an already-open older admin form compatible during the rollout.
create function wowclean_private.normalize_legacy_booking_promo()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.scope = 'booking' and new.max_uses_per_user is not null then
    new.usage_limit := 'once_per_email';
    new.max_uses_per_user := null;
  end if;
  return new;
end $$;
revoke all on function wowclean_private.normalize_legacy_booking_promo() from public, anon, authenticated;
create trigger normalize_legacy_booking_promo before insert or update of max_uses_per_user on public.promo_codes
for each row execute function wowclean_private.normalize_legacy_booking_promo();
