-- Portfolio import (CAS PDFs and app CSV/Excel exports). The file is read in the browser; only the
-- resulting holdings are stored. `external_id` (e.g. "folio:12345/67|INF209K01YN0" or "isin:INE002A01018")
-- lets the next import update the same row instead of creating a duplicate.
alter table public.financial_accounts add column if not exists source text check (char_length(source) <= 40);
alter table public.financial_accounts add column if not exists external_id text check (char_length(external_id) <= 160);
alter table public.financial_accounts add column if not exists units numeric(20, 4);
alter table public.financial_accounts add column if not exists synced_at timestamptz;

create unique index if not exists financial_accounts_user_external_idx
  on public.financial_accounts(user_id, external_id) where external_id is not null;
