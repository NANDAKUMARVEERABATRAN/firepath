create table if not exists public.financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age smallint check (age between 18 and 100),
  monthly_income numeric(14, 2) not null default 0 check (monthly_income >= 0),
  monthly_expenses numeric(14, 2) not null default 0 check (monthly_expenses >= 0),
  assets numeric(16, 2) not null default 0 check (assets >= 0),
  liabilities numeric(16, 2) not null default 0 check (liabilities >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'AED', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_profiles enable row level security;

create policy "Users can read their own financial profile"
  on public.financial_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own financial profile"
  on public.financial_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own financial profile"
  on public.financial_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.financial_profiles to authenticated;
