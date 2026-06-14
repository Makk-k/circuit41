-- Circuit 41 Ops — Phase 1: internal operations queue fields.
-- Additive only. All columns nullable. No changes to existing columns, RLS, or the
-- customer-facing shipments.status. These columns are internal-ops only and are not
-- read by the mobile customer app.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-04 via Supabase MCP apply_migration.

alter table public.shipments
  add column if not exists internal_status text,
  add column if not exists next_review_at  timestamptz,
  add column if not exists ops_viewed_at   timestamptz;

-- Constrain internal_status to the controlled ops vocabulary (NULL allowed = "no internal status set").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shipments_internal_status_check'
  ) then
    alter table public.shipments
      add constraint shipments_internal_status_check
      check (
        internal_status is null
        or internal_status in (
          'new','awaiting_customer','awaiting_forwarder','awaiting_payment',
          'awaiting_review','in_progress','no_action_needed','completed'
        )
      );
  end if;
end $$;

-- Indexes to keep the operations queue fast as the table grows.
create index if not exists idx_shipments_next_review_at  on public.shipments (next_review_at);
create index if not exists idx_shipments_internal_status on public.shipments (internal_status);
create index if not exists idx_shipments_ops_viewed_at   on public.shipments (ops_viewed_at);

comment on column public.shipments.internal_status is 'Internal ops prioritization status. Separate from customer-facing status. One of: new, awaiting_customer, awaiting_forwarder, awaiting_payment, awaiting_review, in_progress, no_action_needed, completed.';
comment on column public.shipments.next_review_at is 'Internal ops review date. When reached, the shipment surfaces in the operations queue.';
comment on column public.shipments.ops_viewed_at is 'Set when ops staff first opens the shipment detail. NULL means the shipment is still New/unseen.';
