-- "Save more" pledge: the spending leaks a user commits to cut and the monthly amount they'll invest instead.
-- Shape: { "items": { "<leak id>": <monthly amount> }, "monthly_total": number, "baseline_expenses": number, "committed_at": timestamptz }
alter table public.financial_profiles add column if not exists cut_plan jsonb;
