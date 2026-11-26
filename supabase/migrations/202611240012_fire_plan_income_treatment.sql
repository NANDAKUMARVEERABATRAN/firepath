alter table public.fire_plans
  add column if not exists investment_income_treatment text not null default 'reinvested'
    check (investment_income_treatment in ('reinvested', 'cash'));

alter table public.fire_plans
  add column if not exists monthly_investment_income numeric(14, 2) not null default 0
    check (monthly_investment_income >= 0);
