-- Circuit 41 Ops — Phase 1 (event-driven revision).
-- Additive/safe. Renames the set-once ops_viewed_at to a bumpable "reviewed up to"
-- checkpoint, and adds a per-shipment forwarder dispatch marker.
--
-- Existing ops_viewed_at values are preserved as the initial reviewed checkpoint.
-- No customer-facing behaviour changes; the mobile app does not read these columns.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-04 via Supabase MCP apply_migration.

-- 1. Rename the checkpoint column (preserves existing values).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='shipments' and column_name='ops_viewed_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='shipments' and column_name='ops_reviewed_at'
  ) then
    alter table public.shipments rename column ops_viewed_at to ops_reviewed_at;
  end if;
end $$;

-- 2. Per-shipment forwarder dispatch marker.
alter table public.shipments
  add column if not exists forwarder_sent_at timestamptz;

-- 3. Keep the index in sync with the renamed column.
drop index if exists public.idx_shipments_ops_viewed_at;
create index if not exists idx_shipments_ops_reviewed_at on public.shipments (ops_reviewed_at);
create index if not exists idx_shipments_forwarder_sent_at on public.shipments (forwarder_sent_at);

comment on column public.shipments.ops_reviewed_at is 'Checkpoint: ops has reviewed the shipment up to this time. Bumped each time staff opens the detail or clicks Mark reviewed. Child records (parcels, actions, etc.) created after this re-surface the shipment in the operations queue. NULL = never reviewed (New).';
comment on column public.shipments.forwarder_sent_at is 'When ops dispatched this shipment''s details/tracking to the freight forwarder. NULL or older than a parcel''s created_at means parcels still need sending.';
