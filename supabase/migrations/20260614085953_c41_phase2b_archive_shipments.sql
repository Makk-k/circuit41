-- Circuit 41 Ops — Phase 2B: archive shipments (soft hide, never hard-delete).
-- Additive only. Two nullable columns on shipments. Rides existing shipments RLS
-- ("Staff can update shipments"). The mobile customer app does not read these.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-06 via Supabase MCP apply_migration.

alter table public.shipments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.staff_users(id);

create index if not exists idx_shipments_archived_at on public.shipments (archived_at);

comment on column public.shipments.archived_at is
  'When ops archived the shipment (soft hide from normal ops views). NULL = active. Shipments are never hard-deleted.';
comment on column public.shipments.archived_by is
  'Staff member who archived the shipment.';
