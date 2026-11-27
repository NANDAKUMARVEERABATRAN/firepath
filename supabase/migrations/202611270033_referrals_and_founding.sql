-- Growth: referrals ("give a friend a month, get a month") and founding-member spots.
-- All writes go through security-definer functions so nobody can award themselves points or spots.

-- New reward reasons for referral and founding rewards.
alter table public.reward_points drop constraint if exists reward_points_reason_check;
alter table public.reward_points add constraint reward_points_reason_check
  check (reason in ('feedback', 'feedback_accepted', 'feedback_shipped', 'redeemed', 'referral_signup', 'referral_paid'));
-- referral rewards are tied to the friend, not to a feedback row: one per friend per reason
alter table public.reward_points add column if not exists referred_id uuid references auth.users(id) on delete set null;
create unique index if not exists reward_points_referral_once on public.reward_points(referred_id, reason) where referred_id is not null;

-- One short code per person, e.g. "K7Q2MX".
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists "Users can read their own referral code" on public.referral_codes;
create policy "Users can read their own referral code" on public.referral_codes for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.referral_codes to authenticated;

-- Who invited whom. A person can be referred once.
create table if not exists public.referrals (
  referred_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
alter table public.referrals enable row level security;
drop policy if exists "Referrers can see who joined" on public.referrals;
create policy "Referrers can see who joined" on public.referrals for select to authenticated using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_id);
grant select on public.referrals to authenticated;

create or replace function public.get_my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; attempt int := 0;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select code into result from public.referral_codes where user_id = uid;
  while result is null and attempt < 10 loop
    attempt := attempt + 1;
    result := '';
    for i in 1..6 loop result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    begin
      insert into public.referral_codes (user_id, code) values (uid, result);
    exception when unique_violation then result := null;
    end;
  end loop;
  return result;
end;
$$;

-- Called by a new person right after sign-in when they arrived through a referral link.
-- Rules: only within 7 days of creating the account, only once, never your own code.
-- The new person's trial becomes 30 days; the referrer gets +100 points now (+990 when the friend first pays).
create or replace function public.claim_referral(referral_code text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); referrer uuid; joined timestamptz;
begin
  if uid is null then return 'not_signed_in'; end if;
  select user_id into referrer from public.referral_codes where code = upper(trim(referral_code));
  if referrer is null then return 'unknown_code'; end if;
  if referrer = uid then return 'own_code'; end if;
  if exists (select 1 from public.referrals where referred_id = uid) then return 'already_claimed'; end if;
  select created_at into joined from auth.users where id = uid;
  if joined < now() - interval '7 days' then return 'too_late'; end if;
  insert into public.referrals (referred_id, referrer_id) values (uid, referrer);
  update public.subscriptions set current_period_end = greatest(current_period_end, coalesce(trial_started_at, now()) + interval '30 days')
    where user_id = uid and plan = 'trial';
  insert into public.reward_points (user_id, points, reason, referred_id) values (referrer, 100, 'referral_signup', uid)
    on conflict do nothing;
  return 'ok';
end;
$$;

-- Founding members: the first 1,000 people who reserve get the founding yearly price, locked for life.
create table if not exists public.founding_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spot integer not null unique,
  created_at timestamptz not null default now()
);
alter table public.founding_members enable row level security;
drop policy if exists "Users can see their own founding spot" on public.founding_members;
create policy "Users can see their own founding spot" on public.founding_members for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.founding_members to authenticated;

create or replace function public.founding_spots_left(total integer default 1000)
returns integer language sql security definer set search_path = public stable as $$
  select greatest(0, total - (select count(*)::int from public.founding_members));
$$;

create or replace function public.reserve_founding_spot(total integer default 1000)
returns integer language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); taken integer; existing integer;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select spot into existing from public.founding_members where user_id = uid;
  if existing is not null then return existing; end if;
  perform pg_advisory_xact_lock(hashtext('founding_members'));
  select count(*) into taken from public.founding_members;
  if taken >= least(total, 1000) then return 0; end if;
  insert into public.founding_members (user_id, spot) values (uid, taken + 1);
  return taken + 1;
end;
$$;

revoke all on function public.get_my_referral_code() from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.reserve_founding_spot(integer) from public, anon;
grant execute on function public.get_my_referral_code() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.reserve_founding_spot(integer) to authenticated;
grant execute on function public.founding_spots_left(integer) to anon, authenticated;
