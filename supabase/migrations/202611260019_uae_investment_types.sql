-- UAE support: end-of-service gratuity, workplace savings plans (e.g. DEWS) and pensions (e.g. GPSSA for UAE nationals).
alter table public.financial_accounts drop constraint if exists financial_accounts_investment_type_check;
alter table public.financial_accounts add constraint financial_accounts_investment_type_check check (
  investment_type in (
    'mutual_fund', 'stocks', 'bonds', 'fixed_deposit', 'nps_tier_1', 'nps_tier_2', 'provident_fund', 'ppf', 'gold', 'crypto', 'other',
    'gratuity', 'workplace_savings', 'pension'
  )
);
