-- Personal financial goals (home, education, wedding, travel, ...) tracked alongside FIRE.
create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  category text not null default 'other' check (category in ('emergency', 'home', 'education', 'wedding', 'vehicle', 'travel', 'parents', 'retirement', 'gadget', 'other')),
  target_amount numeric(16, 2) not null check (target_amount > 0),
  target_date date not null,
  saved_amount numeric(16, 2) not null default 0 check (saved_amount >= 0),
  monthly_contribution numeric(14, 2) not null default 0 check (monthly_contribution >= 0),
  expected_return numeric(5, 2) not null default 8 check (expected_return between 0 and 30),
  inflation_rate numeric(5, 2) not null default 6 check (inflation_rate between 0 and 20),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_goals_user_idx on public.financial_goals(user_id, target_date);
alter table public.financial_goals enable row level security;
drop policy if exists "Users can manage their own goals" on public.financial_goals;
create policy "Users can manage their own goals"
  on public.financial_goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.financial_goals to authenticated;

-- Completed daily book lessons, used for XP and to avoid repeating lessons.
create table if not exists public.lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 60),
  answered_correctly boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_completions enable row level security;
drop policy if exists "Users can manage their own lesson completions" on public.lesson_completions;
create policy "Users can manage their own lesson completions"
  on public.lesson_completions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.lesson_completions to authenticated;
