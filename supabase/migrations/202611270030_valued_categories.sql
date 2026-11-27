-- Spending categories the person values ("I value this"): the monthly spending check-up never flags them.
alter table public.financial_profiles add column if not exists valued_categories text[] not null default '{}';
