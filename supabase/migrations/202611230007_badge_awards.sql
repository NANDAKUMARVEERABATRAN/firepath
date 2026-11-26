create table if not exists public.badge_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null check (char_length(badge_key) between 1 and 80),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table public.badge_awards enable row level security;
create policy "Users can read own badge awards" on public.badge_awards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own badge awards" on public.badge_awards
  for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.badge_awards to authenticated;
