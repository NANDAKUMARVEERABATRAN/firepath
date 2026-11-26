alter table public.financial_profiles
  drop constraint if exists financial_profiles_fire_assets_within_total_check;

alter table public.financial_profiles
  add column if not exists fire_accessible_assets numeric(16, 2) check (fire_accessible_assets >= 0),
  add column if not exists later_retirement_assets numeric(16, 2) check (later_retirement_assets >= 0);

alter table public.financial_profiles
  add constraint financial_profiles_fire_assets_within_total_check
  check (
    fire_accessible_assets is null
    or later_retirement_assets is null
    or fire_accessible_assets + later_retirement_assets <= assets
  );

alter table public.financial_accounts
  drop constraint if exists financial_accounts_category_check;

alter table public.financial_accounts
  add constraint financial_accounts_category_check
  check (category in ('cash', 'investment', 'property', 'vehicle', 'home_loan', 'vehicle_loan', 'education_loan', 'personal_loan', 'credit_card', 'other'));

alter table public.financial_accounts
  add column if not exists investment_type text check (
    investment_type in ('mutual_fund', 'stocks', 'bonds', 'fixed_deposit', 'nps_tier_1', 'nps_tier_2', 'provident_fund', 'ppf', 'gold', 'crypto', 'other')
  ),
  add column if not exists fire_treatment text not null default 'available' check (
    fire_treatment in ('available', 'later', 'excluded')
  ),
  add column if not exists available_from_age smallint check (available_from_age between 18 and 100);

update public.financial_accounts
set fire_treatment = 'excluded'
where kind = 'asset' and category in ('property', 'vehicle');

update public.financial_accounts
set fire_treatment = 'later'
where kind = 'asset' and category = 'investment' and investment_type in ('nps_tier_1', 'provident_fund', 'ppf');

create index if not exists financial_accounts_user_fire_treatment_idx
  on public.financial_accounts(user_id, kind, fire_treatment);
