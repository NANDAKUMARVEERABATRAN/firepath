-- Adds "gold_loan" as a loan type in the portfolio.
alter table public.financial_accounts drop constraint if exists financial_accounts_category_check;
alter table public.financial_accounts add constraint financial_accounts_category_check
  check (category in ('cash', 'investment', 'property', 'vehicle', 'home_loan', 'vehicle_loan', 'education_loan', 'personal_loan', 'gold_loan', 'credit_card', 'other'));
