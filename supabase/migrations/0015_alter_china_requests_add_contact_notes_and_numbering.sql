-- =============================================================================
-- 0015_alter_china_requests_add_contact_notes_and_numbering
--
-- Extends public.china_requests (created in 0012) with the three fields this
-- phase requires that 0012's column list did not cover, plus server-side
-- request-number generation.
--
-- Required by this phase, already in 0012:
--   product_name, description, quantity, specifications, budget,
--   product_url, contact_phone, shipping_preference, status, created_at
--
-- Required by this phase, MISSING from 0012 and added here:
--   customer_name       customer full name
--   customer_email      customer email
--   additional_notes    additional notes
--
-- Also adds the `data` catch-all, because the application's existing reader
-- (mapChinaRequest in server/db/postgres-store.ts) reconstructs every request
-- from a jsonb `data` column. Keeping it means the legacy reader and the new
-- Supabase path can coexist during migration.
--
-- Creates no other table. Alters no other table's data.
-- Run AFTER 0012_create_china_requests.
-- NOT YET EXECUTED.
-- =============================================================================

begin;

alter table public.china_requests
  add column if not exists customer_name    text,
  add column if not exists customer_email   text,
  add column if not exists additional_notes text,
  add column if not exists data             jsonb not null default '{}'::jsonb;

-- customer_name is required by this phase. The DEFAULT '' is deliberate: a
-- NOT NULL column with no default breaks every insert that omits it, whereas
-- '' + a non-blank CHECK rejects exactly the rows that are actually
-- incomplete, and does so with a useful error message.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'china_requests_customer_name_not_blank'
       and conrelid = 'public.china_requests'::regclass
  ) then
    alter table public.china_requests
      add constraint china_requests_customer_name_not_blank
      check (char_length(btrim(customer_name)) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'china_requests_customer_email_valid'
       and conrelid = 'public.china_requests'::regclass
  ) then
    alter table public.china_requests
      add constraint china_requests_customer_email_valid
      check (
        customer_email is not null
        and char_length(btrim(customer_email)) between 3 and 320
        -- deliberately lenient: one @, no spaces, a dot in the domain.
        -- Stricter RFC validation rejects real addresses more often than it
        -- rejects typos.
        and customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'china_requests_notes_length'
       and conrelid = 'public.china_requests'::regclass
  ) then
    alter table public.china_requests
      add constraint china_requests_notes_length
      check (additional_notes is null or char_length(additional_notes) <= 5000);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Request number generation: BFS-CHINA-2026-000001
--
-- Implemented as a BEFORE INSERT trigger rather than a column DEFAULT so that
-- an explicitly supplied request_number is respected (admin imports, data
-- migration) and only auto-assigned when absent. A NOT NULL column is checked
-- AFTER BEFORE triggers run, so assigning here satisfies NOT NULL.
--
-- One global sequence, year interpolated at insert time. Consequence, stated
-- plainly: the first 2027 request is BFS-CHINA-2027-000425, not -000001. The
-- number stays globally unique and monotonic, which is what the UNIQUE
-- constraint and the customer-facing format both need. If you require the
-- counter to reset each January, that needs a per-year sequence created
-- dynamically, and it is a deliberate change rather than an oversight.
-- ---------------------------------------------------------------------------
create sequence if not exists public.china_request_number_seq as bigint;

create or replace function public.assign_china_request_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number :=
      'BFS-CHINA-'
      || to_char(now(), 'YYYY')
      || '-'
      || lpad(nextval('public.china_request_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists china_requests_assign_number on public.china_requests;

create trigger china_requests_assign_number
  before insert on public.china_requests
  for each row
  execute function public.assign_china_request_number();

comment on column public.china_requests.request_number is
  'Human-facing reference, format BFS-CHINA-<year>-<6 digits>. '
  'Auto-assigned by trigger when not supplied on insert.';

-- Staff dashboards filter by status and sort by recency per customer.
create index if not exists china_requests_status_created_idx
  on public.china_requests (status, created_at desc);

-- Customer "my requests" view: the RLS policy filters on customer_id, so this
-- index is what keeps that policy cheap.
create index if not exists china_requests_customer_created_idx
  on public.china_requests (customer_id, created_at desc);

commit;

-- =============================================================================
-- NOTE ON `data` vs the typed columns
--
-- This table now has both typed columns and a jsonb catch-all. Keep them in
-- step: the typed columns are the source of truth for anything queried,
-- filtered, sorted or reported on; `data` is for fields with no column yet
-- (preferred_brand, model_number, color, size, and anything the ChinaSourcing
-- form grows). Do not write the same value to both and expect them to stay
-- consistent -- nothing enforces that.
--
-- specifications is jsonb, but ChinaRequest in src/types.ts types it as
-- `specifications?: string`, i.e. free text like "500W, 220V, single phase".
-- A customer does not fill in a form. Either:
--   - the API coerces a string to {"raw": "<text>"} on the way in, or
--   - this becomes `specifications text` in a later migration.
-- Flagged, not decided, because it changes how the existing form serialises.
-- =============================================================================
