create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('asset', 'liability')),
  category text not null check (category in ('cash', 'investment', 'property', 'vehicle', 'home_loan', 'education_loan', 'personal_loan', 'credit_card', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  current_value numeric(16, 2) not null check (current_value >= 0),
  interest_rate numeric(5, 2) check (interest_rate between 0 and 100),
  monthly_payment numeric(14, 2) not null default 0 check (monthly_payment >= 0),
  is_high_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_accounts_user_kind_idx on public.financial_accounts(user_id, kind);
alter table public.financial_accounts enable row level security;
create policy "Users can read own financial accounts" on public.financial_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own financial accounts" on public.financial_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own financial accounts" on public.financial_accounts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own financial accounts" on public.financial_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.financial_accounts to authenticated;
