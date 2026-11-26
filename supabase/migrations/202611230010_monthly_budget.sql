create table if not exists public.monthly_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  category text not null check (category in ('housing', 'utilities', 'groceries', 'dining', 'transport', 'healthcare', 'insurance', 'education', 'family', 'debt_repayment', 'personal', 'savings', 'other')),
  target_amount numeric(14, 2) not null default 0 check (target_amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start, category)
);

alter table public.monthly_budgets enable row level security;
drop policy if exists "Users can manage their own monthly budgets" on public.monthly_budgets;
create policy "Users can manage their own monthly budgets"
  on public.monthly_budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.monthly_budgets to authenticated;

create table if not exists public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spent_on date not null default current_date,
  month_start date not null,
  category text not null check (category in ('housing', 'utilities', 'groceries', 'dining', 'transport', 'healthcare', 'insurance', 'education', 'family', 'debt_repayment', 'personal', 'savings', 'other')),
  amount numeric(14, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (month_start = date_trunc('month', spent_on)::date)
);

alter table public.budget_transactions enable row level security;
drop policy if exists "Users can manage their own budget transactions" on public.budget_transactions;
create policy "Users can manage their own budget transactions"
  on public.budget_transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.budget_transactions to authenticated;
create index if not exists budget_transactions_user_month_idx
  on public.budget_transactions(user_id, month_start, spent_on desc);
