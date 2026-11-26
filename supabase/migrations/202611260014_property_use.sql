-- Distinguish a home you live in (outside FIRE) from rented or investment property (counts toward FIRE).
alter table public.financial_accounts
  add column if not exists property_use text check (property_use in ('self_occupied', 'rented', 'investment'));

-- Existing property records were excluded from FIRE; treat them as the home you live in until edited.
update public.financial_accounts
set property_use = 'self_occupied'
where kind = 'asset' and category = 'property' and property_use is null;
