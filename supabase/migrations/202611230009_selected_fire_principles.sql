alter table public.financial_profiles
  add column if not exists selected_fire_principles text[] not null default '{}';

alter table public.financial_profiles
  drop constraint if exists financial_profiles_selected_fire_principles_check;

alter table public.financial_profiles
  add constraint financial_profiles_selected_fire_principles_check
  check (selected_fire_principles <@ array[
    'psychology-enough',
    'psychology-sustainable',
    'psychology-buffer',
    'intelligent-downside',
    'intelligent-discipline',
    'intelligent-understanding',
    'richdad-cashflow',
    'richdad-purpose',
    'richdad-debt'
  ]::text[]);
