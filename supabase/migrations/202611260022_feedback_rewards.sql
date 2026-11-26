-- Feedback with reward points that can be redeemed against a future bill.
-- Users can only INSERT feedback and READ their own feedback/points. Points are written by triggers only,
-- so nobody can award themselves. The team updates feedback.status (new → accepted → shipped) in the
-- Supabase dashboard (service role), which automatically awards bonus points.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('idea', 'bug', 'improve', 'praise')),
  message text not null check (char_length(trim(message)) between 10 and 2000),
  page text check (char_length(page) <= 100),
  status text not null default 'new' check (status in ('new', 'accepted', 'shipped', 'declined')),
  team_reply text check (char_length(team_reply) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_user_idx on public.feedback(user_id, created_at desc);

alter table public.feedback enable row level security;
drop policy if exists "Users can read their own feedback" on public.feedback;
create policy "Users can read their own feedback" on public.feedback for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can send feedback" on public.feedback;
create policy "Users can send feedback" on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new' and team_reply is null);
grant select, insert on public.feedback to authenticated;

create table if not exists public.reward_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null, -- positive = earned, negative = redeemed
  reason text not null check (reason in ('feedback', 'feedback_accepted', 'feedback_shipped', 'redeemed')),
  feedback_id uuid references public.feedback(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (feedback_id, reason)
);
create index if not exists reward_points_user_idx on public.reward_points(user_id, created_at desc);

alter table public.reward_points enable row level security;
drop policy if exists "Users can read their own points" on public.reward_points;
create policy "Users can read their own points" on public.reward_points for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.reward_points to authenticated; -- no insert/update/delete for users

-- +20 for sending feedback, for the first 3 per calendar month (prevents spamming for points).
create or replace function public.award_feedback_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reward_points
       where user_id = new.user_id and reason = 'feedback'
         and created_at >= date_trunc('month', now())) < 3 then
    insert into public.reward_points (user_id, points, reason, feedback_id) values (new.user_id, 20, 'feedback', new.id)
    on conflict (feedback_id, reason) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_award_points on public.feedback;
create trigger feedback_award_points after insert on public.feedback for each row execute function public.award_feedback_points();

-- +200 when the team accepts an idea, +500 when it ships (each at most once per feedback).
create or replace function public.award_feedback_status_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.reward_points (user_id, points, reason, feedback_id) values (new.user_id, 200, 'feedback_accepted', new.id)
    on conflict (feedback_id, reason) do nothing;
  elsif new.status = 'shipped' and old.status is distinct from 'shipped' then
    insert into public.reward_points (user_id, points, reason, feedback_id) values (new.user_id, 500, 'feedback_shipped', new.id)
    on conflict (feedback_id, reason) do nothing;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists feedback_status_points on public.feedback;
create trigger feedback_status_points before update of status on public.feedback for each row execute function public.award_feedback_status_points();

revoke all on function public.award_feedback_points() from public, anon, authenticated;
revoke all on function public.award_feedback_status_points() from public, anon, authenticated;
