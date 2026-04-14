-- Referral system migration
-- Adds referral_code + referral_credits to profiles, creates referrals table,
-- backfills existing accounts with unique 8-char codes, and updates the
-- new-user trigger to auto-generate codes on signup.
-- Run in your Supabase SQL Editor.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Add columns to profiles
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referral_credits integer not null default 0;

-- ─────────────────────────────────────────────────────────────
-- 2. Helper function to generate a random 8-char alphanumeric code
--    Uses A-Z, 2-9 (excludes 0/O/1/I/L for readability)
-- ─────────────────────────────────────────────────────────────
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill existing profiles that have no referral code
-- ─────────────────────────────────────────────────────────────
do $$
declare
  rec record;
  new_code text;
  attempts integer;
begin
  for rec in select id from public.profiles where referral_code is null loop
    attempts := 0;
    loop
      new_code := public.generate_referral_code();
      -- Check uniqueness
      if not exists (select 1 from public.profiles where referral_code = new_code) then
        update public.profiles set referral_code = new_code where id = rec.id;
        exit;
      end if;
      attempts := attempts + 1;
      if attempts > 20 then
        raise exception 'Could not generate unique referral code after 20 attempts';
      end if;
    end loop;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Update the new-user trigger to auto-generate a referral code
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_code text;
  attempts integer := 0;
begin
  -- Generate a unique referral code
  loop
    new_code := public.generate_referral_code();
    if not exists (select 1 from public.profiles where referral_code = new_code) then
      exit;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      new_code := null; -- Fallback: admin can assign later
      exit;
    end if;
  end loop;

  insert into public.profiles (id, first_name, last_name, phone, referral_code)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new_code
  );
  return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 5. Referrals tracking table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid references auth.users(id) on delete cascade not null,
  referred_id uuid references auth.users(id) on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz default now(),
  -- Each user can only be referred once
  unique (referred_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

create policy "Users see own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

create policy "Users insert referrals"
  on public.referrals for insert
  with check (auth.uid() = referred_id);

create policy "Admins see all referrals"
  on public.referrals for select
  using (public.is_admin_or_owner());

-- ─────────────────────────────────────────────────────────────
-- 6. RPC to atomically increment referral credits
-- ─────────────────────────────────────────────────────────────
create or replace function public.increment_referral_credits(user_id_input uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set referral_credits = referral_credits + 1
  where id = user_id_input;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC to deduct 3 credits (admin redeem free detail)
-- ─────────────────────────────────────────────────────────────
create or replace function public.redeem_referral_credits(user_id_input uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Allow admin/owner to redeem for anyone, or user to redeem their own
  if not (public.is_admin_or_owner() or auth.uid() = user_id_input) then
    raise exception 'Unauthorized';
  end if;

  if (select referral_credits from public.profiles where id = user_id_input) < 3 then
    raise exception 'Not enough credits';
  end if;

  update public.profiles
  set referral_credits = referral_credits - 3
  where id = user_id_input;
end;
$$;

commit;
