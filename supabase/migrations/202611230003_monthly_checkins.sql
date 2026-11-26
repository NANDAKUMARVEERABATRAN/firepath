create table if not exists public.monthly_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  income numeric(14, 2) not null default 0 check (income >= 0),
  expenses numeric(14, 2) not null default 0 check (expenses >= 0),
  invested numeric(14, 2) not null default 0 check (invested >= 0),
  debt_paid numeric(14, 2) not null default 0 check (debt_paid >= 0),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

alter table public.monthly_checkins enable row level security;
create policy "Users can read own monthly checkins" on public.monthly_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own monthly checkins" on public.monthly_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own monthly checkins" on public.monthly_checkins
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.monthly_checkins to authenticated;
