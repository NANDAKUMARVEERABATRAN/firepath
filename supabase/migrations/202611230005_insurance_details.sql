alter table public.financial_profiles
  add column if not exists has_dependents boolean not null default false,
  add column if not exists health_cover_amount numeric(16, 2) not null default 0 check (health_cover_amount >= 0),
  add column if not exists term_cover_amount numeric(16, 2) not null default 0 check (term_cover_amount >= 0);

