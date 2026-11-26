-- Retirement savings deducted straight from salary (they never reach the bank account).
-- India: salary_pf = EPF/VPF (employee + employer), salary_pension = NPS (employee + employer).
-- UAE:   salary_pf = workplace savings (e.g. DEWS), salary_pension = pension (e.g. GPSSA).
-- Counted in income and savings rate; NOT in the FIRE-accessible monthly investment (access comes later).
alter table public.monthly_checkins add column if not exists salary_pf numeric(14, 2) not null default 0 check (salary_pf >= 0);
alter table public.monthly_checkins add column if not exists salary_pension numeric(14, 2) not null default 0 check (salary_pension >= 0);
alter table public.financial_profiles add column if not exists monthly_salary_pf numeric(14, 2) not null default 0 check (monthly_salary_pf >= 0);
alter table public.financial_profiles add column if not exists monthly_salary_pension numeric(14, 2) not null default 0 check (monthly_salary_pension >= 0);
