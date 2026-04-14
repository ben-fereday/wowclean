-- Helper RPC to get customer emails for admin display
-- Run in your Supabase SQL Editor.

create or replace function public.get_customer_emails()
returns table(id uuid, email text)
language plpgsql
security definer
as $$
begin
  if not public.is_admin_or_owner() then
    raise exception 'Unauthorized';
  end if;

  return query
  select au.id, au.email::text
  from auth.users au
  inner join public.profiles p on p.id = au.id
  where p.role = 'customer';
end;
$$;
