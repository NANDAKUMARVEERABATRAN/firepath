-- Pause instead of cancel: 1–3 months off. The paid end date moves out by the same amount, nothing is charged,
-- and Pro features return automatically when the pause ends (or earlier with "resume").
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('active', 'cancelled', 'expired', 'paused'));
alter table public.subscriptions add column if not exists paused_until timestamptz;

create or replace function public.pause_subscription(months integer)
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare result public.subscriptions; m integer := least(greatest(coalesce(months, 1), 1), 3);
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.subscriptions
     set status = 'paused', paused_until = now() + make_interval(months => m),
         current_period_end = current_period_end + make_interval(months => m), updated_at = now()
   where user_id = auth.uid() and status = 'active' and plan in ('monthly', 'yearly');
  select * into result from public.subscriptions where user_id = auth.uid();
  return result;
end;
$$;

-- Resume early: give back the unused part of the pause (a cancelled plan uses resume_subscription()).
create or replace function public.unpause_subscription()
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare result public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.subscriptions
     set status = 'active', current_period_end = current_period_end - greatest(paused_until - now(), interval '0'), paused_until = null, updated_at = now()
   where user_id = auth.uid() and status = 'paused';
  select * into result from public.subscriptions where user_id = auth.uid();
  return result;
end;
$$;

revoke all on function public.pause_subscription(integer) from public, anon;
revoke all on function public.unpause_subscription() from public, anon;
grant execute on function public.pause_subscription(integer) to authenticated;
grant execute on function public.unpause_subscription() to authenticated;
