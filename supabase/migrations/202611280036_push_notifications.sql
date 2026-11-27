-- Phone notifications (web push; also works inside the Google Play app).
-- push_subscriptions: one row per device that turned reminders on. People manage only their own.
-- notification_log: what was sent, so each reminder goes out once per period. Written by the daily job (service role).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions read" on public.push_subscriptions;
create policy "own push subscriptions read" on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "own push subscriptions insert" on public.push_subscriptions;
create policy "own push subscriptions insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "own push subscriptions update" on public.push_subscriptions;
create policy "own push subscriptions update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own push subscriptions delete" on public.push_subscriptions;
create policy "own push subscriptions delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  period text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, period)
);
alter table public.notification_log enable row level security;
drop policy if exists "own notification log read" on public.notification_log;
create policy "own notification log read" on public.notification_log for select using (auth.uid() = user_id);
