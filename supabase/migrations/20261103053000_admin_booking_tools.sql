
alter table public.blocked_slots
  add column start_time time,
  add column end_time time,
  add constraint blocked_slots_valid_range check (
    (start_time is null and end_time is null) or
    (start_time is not null and end_time is not null and end_time > start_time)
  );

create table public.booking_admin_details (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  payment_method text check (payment_method in ('credit','debit','cash','e_transfer')),
  final_amount numeric(12,2) check (final_amount >= 0 and final_amount <= 999999.99),
  internal_notes text not null default '' check (length(internal_notes) <= 5000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint paid_details_required check (payment_status <> 'paid' or (payment_method is not null and final_amount is not null))
);
alter table public.booking_admin_details enable row level security;
revoke all on public.booking_admin_details from anon;
grant select, insert, update, delete on public.booking_admin_details to authenticated;
create policy "Admins manage private booking details" on public.booking_admin_details
  for all to authenticated using ((select public.is_admin_or_owner()))
  with check ((select public.is_admin_or_owner()));

-- Protect the role used by admin-only policies from self-service profile edits.
create function public.guard_profile_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and
     (new.role is distinct from old.role or new.is_admin is distinct from old.is_admin) and
     not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='owner') then
    raise exception 'Only the owner can change account roles.' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function public.guard_profile_role_change() from public, anon, authenticated;
create trigger protect_profile_role before update of role, is_admin on public.profiles
for each row execute function public.guard_profile_role_change();

-- Internal interval check: no customer names, addresses, or notes leave this function.
create function public.booking_slot_conflicts(p_date date, p_time time, p_exclude uuid default null)
returns boolean language sql volatile security definer set search_path = '' as $$
  select
    exists(select 1 from public.bookings b where b.booking_date=p_date and b.status='confirmed'
      and (p_exclude is null or b.id<>p_exclude)
      and p_date+p_time < p_date+b.booking_time::time+interval '2 hours'
      and p_date+p_time+interval '2 hours' > p_date+b.booking_time::time)
    or exists(select 1 from public.blocked_slots bl where bl.blocked_date=p_date and (
      (bl.start_time is null and bl.blocked_time is null) or
      (bl.start_time is not null and p_date+p_time < p_date+bl.end_time
        and p_date+p_time+interval '2 hours' > p_date+bl.start_time) or
      (bl.start_time is null and bl.blocked_time is not null
        and p_date+p_time < p_date+bl.blocked_time::time+interval '2 hours'
        and p_date+p_time+interval '2 hours' > p_date+bl.blocked_time::time)))
    or exists(select 1 from public.subscriptions s where s.status='active' and s.next_service_date is not null
      and p_date>=s.next_service_date
      and (p_date-s.next_service_date) % (case s.plan when 'weekly' then 7 when 'biweekly' then 14 else 28 end)=0
      and p_date+p_time < p_date+s.recurring_time::time+interval '2 hours'
      and p_date+p_time+interval '2 hours' > p_date+s.recurring_time::time);
$$;
revoke all on function public.booking_slot_conflicts(date,time,uuid) from public, anon, authenticated;

-- Public availability contains only unavailable appointment start times.
create function public.booking_busy_times(p_date date, p_exclude uuid default null)
returns text[] language plpgsql volatile security definer set search_path = '' as $$
declare result text[];
begin
  if p_exclude is not null and not coalesce(public.is_admin_or_owner(),false) then
    raise exception 'Only admins can exclude a booking from availability.' using errcode='42501';
  end if;
  select coalesce(array_agg(to_char(p_date + make_interval(mins => minute),'FMHH12:MI AM') order by minute),array[]::text[])
    into result from generate_series(0,1410,30) minute
    where public.booking_slot_conflicts(p_date,(time '00:00'+make_interval(mins => minute))::time,p_exclude);
  return result;
end; $$;
revoke all on function public.booking_busy_times(date,uuid) from public;
grant execute on function public.booking_busy_times(date,uuid) to anon, authenticated;

create function public.guard_booking_interval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status<>'confirmed' then return new; end if;
  if tg_op='UPDATE' and new.booking_date=old.booking_date and new.booking_time=old.booking_time and old.status='confirmed' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('wowclean:availability:'||new.booking_date::text,0));
  if public.booking_slot_conflicts(new.booking_date,new.booking_time::time,new.id) then
    raise exception 'This appointment overlaps an existing booking or blocked time. Please choose another time.' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function public.guard_booking_interval() from public, anon, authenticated;
create trigger check_booking_interval before insert or update of booking_date,booking_time,status on public.bookings
for each row execute function public.guard_booking_interval();

create function public.guard_blocked_interval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare block_start timestamp; block_end timestamp;
begin
  perform pg_advisory_xact_lock(hashtextextended('wowclean:availability:'||new.blocked_date::text,0));
  if new.start_time is not null then
    block_start:=new.blocked_date+new.start_time; block_end:=new.blocked_date+new.end_time;
  elsif new.blocked_time is not null then
    block_start:=new.blocked_date+new.blocked_time::time; block_end:=block_start+interval '2 hours';
  else
    block_start:=new.blocked_date::timestamp; block_end:=block_start+interval '1 day';
  end if;
  if exists(select 1 from public.bookings b where b.status='confirmed' and b.booking_date=new.blocked_date
    and b.booking_date+b.booking_time::time<block_end
    and b.booking_date+b.booking_time::time+interval '2 hours'>block_start)
    or exists(select 1 from public.subscriptions s where s.status='active' and s.next_service_date is not null
      and new.blocked_date>=s.next_service_date
      and (new.blocked_date-s.next_service_date) % (case s.plan when 'weekly' then 7 when 'biweekly' then 14 else 28 end)=0
      and new.blocked_date+s.recurring_time::time<block_end
      and new.blocked_date+s.recurring_time::time+interval '2 hours'>block_start) then
    raise exception 'This block overlaps an existing appointment. Reschedule or cancel that appointment first.' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function public.guard_blocked_interval() from public, anon, authenticated;
create trigger check_blocked_interval before insert or update of blocked_date,blocked_time,start_time,end_time on public.blocked_slots
for each row execute function public.guard_blocked_interval();
