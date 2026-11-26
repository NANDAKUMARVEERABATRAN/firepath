-- 1) Self-service account deletion (required by Google Play and good practice under India's DPDP Act).
--    Deleting the auth user cascades to every FIREpath table (all user_id columns use ON DELETE CASCADE).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2) Daily limit for AI budget suggestions (protects the OpenAI bill). Users can't read or write this
--    table directly; the server route calls use_ai_credit(), which checks and records usage atomically.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage(user_id, feature, created_at desc);
alter table public.ai_usage enable row level security; -- no policies: no direct access

create or replace function public.use_ai_credit(feature text, daily_limit integer default 10)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text || feature));
  if (select count(*) from public.ai_usage u
       where u.user_id = uid and u.feature = use_ai_credit.feature
         and u.created_at > now() - interval '24 hours') >= least(greatest(daily_limit, 1), 50) then
    return false;
  end if;
  insert into public.ai_usage (user_id, feature) values (uid, use_ai_credit.feature);
  return true;
end;
$$;
revoke all on function public.use_ai_credit(text, integer) from public, anon;
grant execute on function public.use_ai_credit(text, integer) to authenticated;
