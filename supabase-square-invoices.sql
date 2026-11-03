create table public.booking_square_invoices (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  attempt_id uuid not null default gen_random_uuid() unique,
  snapshot jsonb not null,
  customer_id text,
  order_id text unique,
  invoice_id text unique,
  status text not null default 'CREATING',
  version integer not null default -1,
  public_url text,
  total_cents bigint not null check (total_cents > 0 and total_cents <= 99999999),
  recipient_email text not null,
  updated_at timestamptz not null default now()
);
alter table public.booking_square_invoices enable row level security;
revoke all on public.booking_square_invoices from public, anon, authenticated;
grant select on public.booking_square_invoices to authenticated;
grant all on public.booking_square_invoices to service_role;
create policy "Admins read Square invoice tracking" on public.booking_square_invoices
  for select to authenticated using ((select public.is_admin_or_owner()));

alter table public.booking_admin_details drop constraint booking_admin_details_payment_method_check;
alter table public.booking_admin_details add constraint booking_admin_details_payment_method_check
  check (payment_method in ('credit','debit','cash','e_transfer','square'));

create function public.reconcile_square_invoice(p_booking uuid,p_invoice text,p_version integer,p_status text,p_total bigint,p_url text,p_email text)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_version integer;
begin
  select version into current_version from public.booking_square_invoices
    where booking_id=p_booking and invoice_id=p_invoice for update;
  if not found then raise exception 'Invoice identity mismatch'; end if;
  if p_version < current_version then return; end if;
  if p_total <= 0 or p_total > 99999999 then raise exception 'Invalid invoice total'; end if;
  update public.booking_square_invoices set version=p_version,status=p_status,total_cents=p_total,
    public_url=p_url,recipient_email=p_email,updated_at=now()
    where booking_id=p_booking;
  if p_status='PAID' then
    insert into public.booking_admin_details(booking_id,payment_status,payment_method,final_amount)
      values(p_booking,'paid','square',p_total::numeric/100)
      on conflict(booking_id) do update set payment_status='paid',payment_method='square',
        final_amount=excluded.final_amount,updated_at=now();
  elsif p_status='REFUNDED' then
    update public.booking_admin_details set payment_status='unpaid',updated_at=now()
      where booking_id=p_booking and payment_method='square';
  end if;
end;
$$;
revoke all on function public.reconcile_square_invoice(uuid,text,integer,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.reconcile_square_invoice(uuid,text,integer,text,bigint,text,text) to service_role;
