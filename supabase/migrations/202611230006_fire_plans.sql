create table if not exists public.fire_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  retirement_age smallint not null default 60 check (retirement_age between 30 and 85),
  inflation_rate numeric(4, 2) not null default 6 check (inflation_rate between 0 and 20),
  expected_return numeric(4, 2) not null default 8 check (expected_return between 0 and 30),
  withdrawal_rate numeric(4, 2) not null default 3.5 check (withdrawal_rate between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fire_plans enable row level security;
create policy "Users can read own FIRE plan" on public.fire_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own FIRE plan" on public.fire_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own FIRE plan" on public.fire_plans
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.fire_plans to authenticated;
