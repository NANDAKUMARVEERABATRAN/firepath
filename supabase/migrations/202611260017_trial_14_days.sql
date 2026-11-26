-- Shorten the free Pro trial to 14 days for NEW trials.
-- Safe to run whether or not 202611260015 was already applied. Trials that already started keep their end date.
create or replace function public.start_pro_trial()
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Sign in to start your trial';
  end if;
  insert into public.subscriptions (user_id, plan, status, trial_started_at, current_period_end)
  values (auth.uid(), 'trial', 'active', now(), now() + interval '14 days')
  on conflict (user_id) do nothing;
  select * into result from public.subscriptions where user_id = auth.uid();
  return result;
end;
$$;

revoke all on function public.start_pro_trial() from public;
revoke execute on function public.start_pro_trial() from anon; -- Supabase grants anon by default; only signed-in users may call it
grant execute on function public.start_pro_trial() to authenticated;
