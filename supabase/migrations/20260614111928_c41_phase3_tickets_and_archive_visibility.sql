-- Circuit 41 — Phase 3: lightweight shipment ticketing + restore customer visibility of
-- archived shipments. Additive; no data deleted.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-14 via Supabase MCP apply_migration.

-- ── 1. Restore customer read of their archived shipments ──
-- (Archived shipments move to the customer's completed/history section, controlled client-side.
--  Ops still hides archived from active/dashboard views via its own client filters.)
drop policy if exists "Users can view own shipments" on public.shipments;
create policy "Users can view own shipments"
  on public.shipments
  for select
  to public
  using (auth.uid() = user_id);

-- ── 2. Ticket tables (staff + owning customer only) ──
create table if not exists public.shipment_tickets (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  user_id      uuid,
  status       text not null default 'new',
  subject      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz,
  constraint shipment_tickets_status_check check (status in ('new','in_progress','closed'))
);
create index if not exists idx_shipment_tickets_shipment on public.shipment_tickets (shipment_id, created_at desc);
create index if not exists idx_shipment_tickets_status   on public.shipment_tickets (status);

create table if not exists public.shipment_ticket_messages (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.shipment_tickets(id) on delete cascade,
  sender_user_id  uuid,
  sender_staff_id uuid references public.staff_users(id),
  sender_type     text not null,
  message         text not null,
  created_at      timestamptz not null default now(),
  constraint shipment_ticket_messages_sender_type_check check (sender_type in ('customer','staff','system'))
);
create index if not exists idx_ticket_messages_ticket on public.shipment_ticket_messages (ticket_id, created_at);

-- ── 3. Bump ticket.updated_at on every message (so "customer replied" is detectable) ──
create or replace function public.bump_ticket_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shipment_tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;
revoke execute on function public.bump_ticket_updated_at() from public, anon, authenticated;

drop trigger if exists trg_bump_ticket_updated_at on public.shipment_ticket_messages;
create trigger trg_bump_ticket_updated_at
  after insert on public.shipment_ticket_messages
  for each row execute function public.bump_ticket_updated_at();

-- ── 4. RLS ──
alter table public.shipment_tickets         enable row level security;
alter table public.shipment_ticket_messages enable row level security;

grant select, insert, update, delete on public.shipment_tickets         to authenticated;
grant select, insert, update, delete on public.shipment_ticket_messages to authenticated;

create policy "Staff manage tickets" on public.shipment_tickets
  for all to authenticated
  using (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true))
  with check (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true));

create policy "Customers read own tickets" on public.shipment_tickets
  for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_id and s.user_id = auth.uid()));

create policy "Customers create own tickets" on public.shipment_tickets
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.shipments s where s.id = shipment_id and s.user_id = auth.uid())
  );

create policy "Staff manage ticket messages" on public.shipment_ticket_messages
  for all to authenticated
  using (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true))
  with check (exists (select 1 from public.staff_users su where su.id = auth.uid() and su.active = true));

create policy "Customers read own ticket messages" on public.shipment_ticket_messages
  for select to authenticated
  using (exists (
    select 1 from public.shipment_tickets t
    join public.shipments s on s.id = t.shipment_id
    where t.id = ticket_id and s.user_id = auth.uid()
  ));

create policy "Customers add messages to own open tickets" on public.shipment_ticket_messages
  for insert to authenticated
  with check (
    sender_type = 'customer'
    and sender_user_id = auth.uid()
    and exists (
      select 1 from public.shipment_tickets t
      join public.shipments s on s.id = t.shipment_id
      where t.id = ticket_id and s.user_id = auth.uid() and t.status <> 'closed'
    )
  );

comment on table public.shipment_tickets is 'Customer support tickets/questions raised against a shipment. Customers see their own; staff see all.';
comment on table public.shipment_ticket_messages is 'Thread messages for a shipment ticket (customer/staff/system).';
