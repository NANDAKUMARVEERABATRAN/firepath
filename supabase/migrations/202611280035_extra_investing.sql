-- Investing from bonuses and other extra earnings.
--  financial_profiles.yearly_extra_investment: how much of bonus/incentives/gifts the person usually invests in a year.
--  monthly_checkins.extra_invested: a one-off investment logged in a month (e.g. bonus invested). Kept apart from
--  the regular "invested" so a bonus month doesn't inflate the usual monthly numbers.
alter table public.financial_profiles add column if not exists yearly_extra_investment numeric not null default 0 check (yearly_extra_investment >= 0);
alter table public.monthly_checkins add column if not exists extra_invested numeric not null default 0 check (extra_invested >= 0);
