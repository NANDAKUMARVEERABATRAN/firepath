-- A month the person didn't log, filled in with their usual numbers (last logged month, else the profile).
-- Shown as "auto-filled", earns no XP, and becomes a normal check-in once they save it.
alter table public.monthly_checkins add column if not exists auto_filled boolean not null default false;
