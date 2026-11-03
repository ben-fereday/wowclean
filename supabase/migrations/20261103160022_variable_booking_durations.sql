create function public.booking_duration_minutes(p_package text,p_vehicle text,p_addons jsonb)
returns integer language sql immutable set search_path='' as $$
select (case when p_package='premium' or p_vehicle='large' then 150 else 120 end)
+ 30 * (select count(distinct item->>'id')::integer from jsonb_array_elements(case when jsonb_typeof(p_addons)='array' then p_addons else '[]'::jsonb end) item where item->>'id' in ('seat_shamp','carpet_shamp','salt'));
$$;
revoke all on function public.booking_duration_minutes(text,text,jsonb) from public,anon,authenticated;
create function public.booking_duration_conflicts(p_date date, p_time time, p_exclude uuid default null, p_duration integer default 120)
returns boolean language sql volatile security definer set search_path = '' as $$
  select
    exists(select 1 from public.bookings b where b.booking_date=p_date and b.status='confirmed'
      and (p_exclude is null or b.id<>p_exclude)
      and p_date+p_time < p_date+b.booking_time::time+make_interval(mins => public.booking_duration_minutes(b.package,b.vehicle_size,b.addons))
      and p_date+p_time+make_interval(mins => p_duration) > p_date+b.booking_time::time)
    or exists(select 1 from public.blocked_slots bl where bl.blocked_date=p_date and (
      (bl.start_time is null and bl.blocked_time is null) or
      (bl.start_time is not null and p_date+p_time < p_date+bl.end_time
        and p_date+p_time+make_interval(mins => p_duration) > p_date+bl.start_time) or
      (bl.start_time is null and bl.blocked_time is not null
        and p_date+p_time < p_date+bl.blocked_time::time+interval '2 hours'
        and p_date+p_time+make_interval(mins => p_duration) > p_date+bl.blocked_time::time)))
    or exists(select 1 from public.subscriptions s where s.status='active' and s.next_service_date is not null
      and p_date>=s.next_service_date
      and (p_date-s.next_service_date) % (case s.plan when 'weekly' then 7 when 'biweekly' then 14 else 28 end)=0
      and p_date+p_time < p_date+s.recurring_time::time+interval '2 hours'
      and p_date+p_time+make_interval(mins => p_duration) > p_date+s.recurring_time::time);
$$;
revoke all on function public.booking_duration_conflicts(date,time,uuid,integer) from public, anon, authenticated;
create function public.booking_busy_times_for_duration(p_date date, p_exclude uuid default null, p_duration integer default 120)
returns text[] language plpgsql volatile security definer set search_path = '' as $$
declare result text[];
begin
  if p_duration is null or p_duration not in (120,150,180,210,240) then raise exception 'Invalid appointment duration.'; end if;
  if p_exclude is not null and not coalesce(public.is_admin_or_owner(),false) then
    raise exception 'Only admins can exclude a booking from availability.' using errcode='42501';
  end if;
  select coalesce(array_agg(to_char(p_date + make_interval(mins => minute),'FMHH12:MI AM') order by minute),array[]::text[])
    into result from generate_series(0,1410,30) minute
    where public.booking_duration_conflicts(p_date,(time '00:00'+make_interval(mins => minute))::time,p_exclude,p_duration);
  return result;
end; $$;
revoke all on function public.booking_busy_times_for_duration(date,uuid,integer) from public;
grant execute on function public.booking_busy_times_for_duration(date,uuid,integer) to anon, authenticated;

create or replace function public.guard_booking_interval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status<>'confirmed' then return new; end if;
  if tg_op='UPDATE' and new.booking_date=old.booking_date and new.booking_time=old.booking_time and old.status='confirmed' and new.package=old.package and new.vehicle_size=old.vehicle_size and new.addons is not distinct from old.addons then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('wowclean:availability:'||new.booking_date::text,0));
  if public.booking_duration_conflicts(new.booking_date,new.booking_time::time,new.id,public.booking_duration_minutes(new.package,new.vehicle_size,new.addons)) then
    raise exception 'This appointment overlaps an existing booking or blocked time. Please choose another time.' using errcode='23514';
  end if;
  return new;
end; $$;
create or replace function public.guard_blocked_interval() returns trigger
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
    and b.booking_date+b.booking_time::time+make_interval(mins => public.booking_duration_minutes(b.package,b.vehicle_size,b.addons))>block_start)
    or exists(select 1 from public.subscriptions s where s.status='active' and s.next_service_date is not null
      and new.blocked_date>=s.next_service_date
      and (new.blocked_date-s.next_service_date) % (case s.plan when 'weekly' then 7 when 'biweekly' then 14 else 28 end)=0
      and new.blocked_date+s.recurring_time::time<block_end
      and new.blocked_date+s.recurring_time::time+interval '2 hours'>block_start) then
    raise exception 'This block overlaps an existing appointment. Reschedule or cancel that appointment first.' using errcode='23514';
  end if;
  return new;
end; $$;

create or replace function public.booking_slot_conflicts(p_date date,p_time time,p_exclude uuid default null)
returns boolean language sql volatile security definer set search_path='' as $$
select public.booking_duration_conflicts(p_date,p_time,p_exclude,120);
$$;
drop trigger check_booking_interval on public.bookings;
create trigger check_booking_interval before insert or update of booking_date,booking_time,status,package,vehicle_size,addons on public.bookings for each row execute function public.guard_booking_interval();
