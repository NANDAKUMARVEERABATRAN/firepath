-- Annual step-up: raise the monthly investment by a % once a year, in a month the user picks (e.g. April, after appraisals).
alter table public.fire_plans
  add column if not exists step_up_percent numeric(5, 2) not null default 0 check (step_up_percent between 0 and 50),
  add column if not exists step_up_month smallint check (step_up_month between 1 and 12),
  add column if not exists step_up_done_year smallint; -- last year the user confirmed their step-up
