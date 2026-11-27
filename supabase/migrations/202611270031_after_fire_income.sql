-- Income after you stop working (today's money, per month) and for how many years: part-time, freelance, business,
-- rent or pension. Reduces withdrawals in those years in the "After you're free" simulation (Barista FIRE).
alter table public.fire_plans add column if not exists after_fire_income numeric(14, 2) check (after_fire_income is null or after_fire_income >= 0);
alter table public.fire_plans add column if not exists after_fire_income_years integer check (after_fire_income_years is null or after_fire_income_years between 0 and 60);
alter table public.fire_plans add column if not exists after_fire_income_kind text check (char_length(after_fire_income_kind) <= 20);
