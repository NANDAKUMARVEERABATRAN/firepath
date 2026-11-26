-- Earmark a portfolio item for a life goal (house, kids' education, trip...).
-- Linked items count toward that goal and are kept OUT of the FIRE-accessible portfolio, so nothing is double-counted.
alter table public.financial_accounts
  add column if not exists goal_id uuid references public.financial_goals(id) on delete set null;

create index if not exists financial_accounts_goal_idx on public.financial_accounts(user_id, goal_id);

-- A user may only link their own items to their own goals.
create or replace function public.check_account_goal_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.goal_id is not null and not exists (
    select 1 from public.financial_goals g where g.id = new.goal_id and g.user_id = new.user_id
  ) then
    raise exception 'That goal does not belong to you';
  end if;
  return new;
end;
$$;

drop trigger if exists financial_accounts_goal_owner on public.financial_accounts;
create trigger financial_accounts_goal_owner
  before insert or update of goal_id on public.financial_accounts
  for each row execute function public.check_account_goal_owner();
