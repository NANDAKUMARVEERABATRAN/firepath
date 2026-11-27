-- Does this person track spending by category (a budget)? null = not chosen yet (the app decides from their data).
-- When false, This month asks for one spending total and budget charts are hidden.
alter table public.financial_profiles add column if not exists track_budget boolean;
