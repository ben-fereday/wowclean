-- Helper RPC to look up a user's email by their ID (admin-only)
-- Used for sending cancellation emails to logged-in users
-- Run in your Supabase SQL Editor.

create or replace function public.find_user_by_email_id(user_id_input uuid)
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
  where au.id = user_id_input;
end;
$$;
