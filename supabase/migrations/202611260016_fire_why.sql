-- Why the user wants financial independence: reasons, a one-line personal "why", and a dream freedom age.
alter table public.financial_profiles
  add column if not exists fire_reasons text[] not null default '{}',
  add column if not exists fire_why_note text not null default '' check (char_length(fire_why_note) <= 280),
  add column if not exists dream_age smallint check (dream_age between 18 and 100);
