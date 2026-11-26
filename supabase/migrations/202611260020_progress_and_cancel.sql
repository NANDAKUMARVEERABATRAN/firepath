-- 1) Monthly progress snapshots: one row per user per month, updated whenever they open Home.
--    Powers the "your progress over time" chart and the "look how far you've come" screen.
create table if not exists public.progress_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  net_worth numeric(16, 2) not null default 0,
  fire_portfolio numeric(16, 2) not null default 0,
  fire_target numeric(16, 2) not null default 0,
  fire_progress numeric(6, 2) not null default 0,
  fire_score smallint not null default 0 check (fire_score between 0 and 100),
  currency text not null default 'INR' check (currency in ('INR', 'AED', 'USD')),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

alter table public.progress_snapshots enable row level security;
drop policy if exists "Users can manage their own progress snapshots" on public.progress_snapshots;
create policy "Users can manage their own progress snapshots"
  on public.progress_snapshots for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.progress_snapshots to authenticated;

-- 2) Cancellation: keep access until the period ends, remember why (to improve the product), allow undo.
alter table public.subscriptions
  add column if not exists cancel_reason text check (char_length(cancel_reason) <= 500),
  add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_subscription(reason text default null)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.subscriptions
     set status = 'cancelled', cancel_reason = left(coalesce(reason, ''), 500), cancelled_at = now(), updated_at = now()
   where user_id = auth.uid() and status = 'active';
  select * into result from public.subscriptions where user_id = auth.uid();
  return result;
end;
$$;

create or replace function public.resume_subscription()
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.subscriptions
     set status = 'active', cancelled_at = null, updated_at = now()
   where user_id = auth.uid() and status = 'cancelled' and current_period_end > now();
  select * into result from public.subscriptions where user_id = auth.uid();
  return result;
end;
$$;

revoke all on function public.cancel_subscription(text) from public;
revoke execute on function public.cancel_subscription(text) from anon;
grant execute on function public.cancel_subscription(text) to authenticated;
revoke all on function public.resume_subscription() from public;
revoke execute on function public.resume_subscription() from anon;
grant execute on function public.resume_subscription() to authenticated;
