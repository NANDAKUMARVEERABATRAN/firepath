-- Optional monthly expenses after you stop working (in today's money). When set, the FIRE target uses this
-- instead of today's spending (e.g. home loan EMIs and school fees often end before financial independence).
alter table public.fire_plans add column if not exists retirement_expenses numeric(14, 2) check (retirement_expenses is null or retirement_expenses >= 0);
