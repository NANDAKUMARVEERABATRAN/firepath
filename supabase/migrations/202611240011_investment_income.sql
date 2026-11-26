alter table public.financial_profiles
  add column if not exists monthly_investment_income numeric(14, 2) not null default 0
    check (monthly_investment_income >= 0);

alter table public.financial_profiles
  drop constraint if exists financial_profiles_investment_income_within_income_check;
alter table public.financial_profiles
  add constraint financial_profiles_investment_income_within_income_check
  check (monthly_investment_income <= monthly_income);

alter table public.monthly_checkins
  add column if not exists investment_income numeric(14, 2) not null default 0
    check (investment_income >= 0);

alter table public.monthly_checkins
  drop constraint if exists monthly_checkins_investment_income_within_income_check;
alter table public.monthly_checkins
  add constraint monthly_checkins_investment_income_within_income_check
  check (investment_income <= income);
