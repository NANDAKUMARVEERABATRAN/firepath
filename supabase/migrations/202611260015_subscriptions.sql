-- Pro subscriptions. Users can READ their own row; only start_pro_trial() (or the server, later via a
-- Razorpay webhook using the service role) can create or change rows, so nobody can grant themselves Pro.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('trial', 'monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  trial_started_at timestamptz,
  current_period_end timestamptz not null,
  provider text check (provider in ('razorpay')),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.subscriptions to authenticated;

-- One free 14-day trial per account. Dates are set by the database, not the browser.
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
revoke execute on function public.start_pro_trial() from anon;
grant execute on function public.start_pro_trial() to authenticated;
