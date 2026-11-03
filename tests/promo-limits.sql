-- Run inside a transaction and roll back. These SQL-only tests send no email.
begin;
insert into public.promo_codes(code,discount_pct,scope,usage_limit)
values ('QA_EMAIL_20261103',5,'booking','once_per_email'),
       ('QA_SINGLE_20261103',5,'booking','single_use'),
       ('QA_UNLIMITED_20261103',5,'booking','unlimited');
do $$
declare code text; n integer;
begin
  insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
  values('QA_EMAIL_FIRST','small','interior','standard',95,'2026-01-01','8:00 AM','mobile','cancelled','  Test@Example.invalid  ','QA_EMAIL_20261103',5);
  if (public.preview_booking_promo('qa_email_20261103','test@example.invalid')->>'valid')::boolean then
    raise exception 'Email normalization or cancelled-booking accounting failed';
  end if;
  if not (public.preview_booking_promo('QA_EMAIL_20261103','another@example.invalid')->>'valid')::boolean then
    raise exception 'Different email was incorrectly rejected';
  end if;
  begin
    insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
    values('QA_EMAIL_REPEAT','small','interior','standard',95,'2026-01-01','8:00 AM','mobile','cancelled','test@example.invalid','QA_EMAIL_20261103',5);
    raise exception 'Repeated email was allowed' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'PROMO: This email address has already used this code.' then raise; end if;
  end;
  insert into public.booking_admin_archives(booking_id) select id from public.bookings where reference_code='QA_EMAIL_FIRST';
  if (public.preview_booking_promo('QA_EMAIL_20261103','TEST@example.invalid')->>'valid')::boolean then
    raise exception 'Archiving incorrectly reset promo use';
  end if;
  begin
    insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
    values('QA_WRONG_DISCOUNT','small','interior','standard',0,'2026-01-01','8:00 AM','mobile','cancelled','one@example.invalid','QA_SINGLE_20261103',100);
    raise exception 'Wrong discount was accepted' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'PROMO: This offer changed. Please apply the code again.' then raise; end if;
  end;
  if not (public.preview_booking_promo('QA_SINGLE_20261103','one@example.invalid')->>'valid')::boolean then
    raise exception 'Failed booking consumed single-use code';
  end if;
  insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
  values('QA_SINGLE_FIRST','small','interior','standard',95,'2026-01-01','8:00 AM','mobile','cancelled','one@example.invalid','QA_SINGLE_20261103',5);
  if (public.preview_booking_promo('QA_SINGLE_20261103','two@example.invalid')->>'valid')::boolean then
    raise exception 'Single-use code was allowed for a second email';
  end if;
  for n in 1..2 loop
    insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
    values('QA_UNLIMITED_'||n,'small','interior','standard',95,'2026-01-01','8:00 AM','mobile','cancelled','same@example.invalid','QA_UNLIMITED_20261103',5);
  end loop;
end $$;
-- Exercise the trigger under the real unauthenticated booking role.
set local role anon;
insert into public.bookings(reference_code,vehicle_size,service_type,package,total_estimate,booking_date,booking_time,location,status,guest_email,promo_code,promo_discount_pct)
values('QA_ANON_PROMO','small','interior','standard',95,'2026-01-01','8:00 AM','mobile','cancelled','guest@example.invalid','QA_EMAIL_20261103',5);
reset role;
do $$ begin
  if (public.preview_booking_promo('QA_EMAIL_20261103','guest@example.invalid')->>'valid')::boolean then
    raise exception 'Guest redemption was not recorded';
  end if;
end $$;
rollback;
