-- Circuit 41 Ops — Phase 2: operations workspace.
-- Additive only. Three new STAFF-ONLY tables (internal notes, forwarder details, internal
-- ops event log) + one low-sensitivity timestamp column on shipments. The mobile customer
-- app does not read any of this. The existing customer-facing shipment_events table is NOT
-- touched.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-05 via Supabase MCP apply_migration.

-- 1. Waiting-For "since" timestamp (low sensitivity; rides existing shipments RLS).
alter table public.shipments
  add column if not exists internal_status_changed_at timestamptz;
create index if not exists idx_shipments_internal_status_changed_at
  on public.shipments (internal_status_changed_at);
comment on column public.shipments.internal_status_changed_at is
  'When internal_status (the ops "waiting for" state) last changed. Powers the Waiting For section and dashboard staleness.';

-- 2. Internal notes (staff-only).
create table if not exists public.shipment_notes (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  author_id    uuid references public.staff_users(id),
  author_email text,
  body         text not null,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists idx_shipment_notes_shipment
  on public.shipment_notes (shipment_id, created_at desc);

-- 3. Forwarder reference (staff-only, 1:1). Commercially sensitive — kept off shipments.
create table if not exists public.shipment_forwarder (
  shipment_id         uuid primary key references public.shipments(id) on delete cascade,
  forwarder_name      text,
  forwarder_reference text,
  forwarder_contact   text,
  confirmed_at        timestamptz,
  updated_at          timestamptz not null default now()
);

-- 4. Internal ops event log (staff-only) — powers the Internal Timeline / Recent Changes.
create table if not exists public.shipment_ops_events (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  event_type   text not null,
  summary      text not null,
  actor_id     uuid references public.staff_users(id),
  actor_label  text,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ops_events_shipment
  on public.shipment_ops_events (shipment_id, created_at desc);

-- ── RLS: enable + staff-only policies on all three new tables ──
alter table public.shipment_notes        enable row level security;
alter table public.shipment_forwarder    enable row level security;
alter table public.shipment_ops_events   enable row level security;

-- Grants for the Data API roles (RLS still restricts rows to active staff).
grant select, insert, update, delete on public.shipment_notes        to authenticated;
grant select, insert, update, delete on public.shipment_forwarder    to authenticated;
grant select, insert, update, delete on public.shipment_ops_events   to authenticated;

-- shipment_notes: active staff only, full access.
create policy "Staff manage shipment notes" on public.shipment_notes
  for all to authenticated
  using (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true))
  with check (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true));

-- shipment_forwarder: active staff only, full access.
create policy "Staff manage shipment forwarder" on public.shipment_forwarder
  for all to authenticated
  using (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true))
  with check (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true));

-- shipment_ops_events: active staff only, full access.
create policy "Staff manage shipment ops events" on public.shipment_ops_events
  for all to authenticated
  using (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true))
  with check (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true));
