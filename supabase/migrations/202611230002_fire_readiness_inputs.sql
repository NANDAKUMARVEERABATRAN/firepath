alter table public.financial_profiles
  add column if not exists emergency_fund numeric(16, 2) not null default 0 check (emergency_fund >= 0),
  add column if not exists monthly_investment numeric(14, 2) not null default 0 check (monthly_investment >= 0),
  add column if not exists has_health_insurance boolean not null default false,
  add column if not exists has_term_insurance boolean not null default false;
