-- Circuit 41 v1.0.1
-- Bank-transfer accounts, payment proof records, and Nigeria pickup points.
--
-- Notes:
-- - payment_proofs.file_url stores the Supabase Storage path, not a long-lived signed URL.
-- - Replace seeded bank/pickup placeholder values with real operational details before production use.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  country_name text not null,
  currency text not null,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  sort_code text,
  iban text,
  swift_bic text,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_accounts_country_code_check check (country_code in ('GB', 'NG')),
  constraint payment_accounts_currency_check check (currency in ('GBP', 'NGN'))
);

drop trigger if exists set_payment_accounts_updated_at on public.payment_accounts;
create trigger set_payment_accounts_updated_at
before update on public.payment_accounts
for each row execute function public.set_updated_at();

create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  country_name text not null,
  state text,
  city text not null,
  name text not null,
  address text not null,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_points_country_code_check check (country_code in ('NG'))
);

drop trigger if exists set_pickup_points_updated_at on public.pickup_points;
create trigger set_pickup_points_updated_at
before update on public.pickup_points
for each row execute function public.set_updated_at();

alter table public.shipments
add column if not exists pickup_point_id uuid references public.pickup_points(id) on delete set null;

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  file_url text not null,
  file_name text,
  file_type text,
  uploaded_at timestamptz not null default now(),
  status text not null default 'submitted',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  constraint payment_proofs_status_check check (status in ('submitted', 'approved', 'rejected'))
);

create index if not exists payment_accounts_active_country_idx
  on public.payment_accounts(country_code, is_active);

create index if not exists pickup_points_active_country_idx
  on public.pickup_points(country_code, is_active);

create index if not exists payment_proofs_shipment_id_idx
  on public.payment_proofs(shipment_id);

create index if not exists payment_proofs_user_id_idx
  on public.payment_proofs(user_id);

create index if not exists shipments_pickup_point_id_idx
  on public.shipments(pickup_point_id);

alter table public.payment_accounts enable row level security;
alter table public.pickup_points enable row level security;
alter table public.payment_proofs enable row level security;

grant select on public.payment_accounts to authenticated;
grant select on public.pickup_points to authenticated;
grant select, insert, update on public.payment_proofs to authenticated;
grant select, update on public.shipments to authenticated;

-- Active customers can read active bank accounts and pickup points.
create policy "payment_accounts_active_read"
on public.payment_accounts
for select
to authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
  )
);

create policy "pickup_points_active_read"
on public.pickup_points
for select
to authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
  )
);

-- Staff management of config tables is intentionally limited to admin roles for now.
create policy "payment_accounts_staff_admin_manage"
on public.payment_accounts
for all
to authenticated
using (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
);

create policy "pickup_points_staff_admin_manage"
on public.pickup_points
for all
to authenticated
using (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
);

create policy "payment_proofs_user_insert_own"
on public.payment_proofs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.shipments s
    where s.id = payment_proofs.shipment_id
      and s.user_id = auth.uid()
  )
);

create policy "payment_proofs_user_read_own"
on public.payment_proofs
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
  )
);

create policy "payment_proofs_staff_review_update"
on public.payment_proofs
for update
to authenticated
using (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.staff_users su
    where su.id = auth.uid()
      and su.active = true
      and su.role in ('super_admin', 'admin')
  )
);

-- Keep using the existing private documents bucket.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies for customer-owned paths and staff review.
-- Path convention: {auth.uid()}/{shipment_id}/payment-proof/{timestamp}_{filename}
create policy "documents_customer_read_own_paths"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.staff_users su
      where su.id = auth.uid()
        and su.active = true
    )
  )
);

create policy "documents_customer_insert_own_paths"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Seed initial payment account rows. Replace placeholder account details before production use.
insert into public.payment_accounts (
  country_code,
  country_name,
  currency,
  bank_name,
  account_name,
  account_number,
  sort_code,
  instructions,
  is_active
) values (
  'GB',
  'United Kingdom',
  'GBP',
  'Wise',
  'Onarion Ltd',
  '16975721',
  '23-08-01',
  'Use your shipment reference as the payment reference.',
  true
) on conflict do nothing;

insert into public.payment_accounts (
  country_code,
  country_name,
  currency,
  bank_name,
  account_name,
  account_number,
  instructions,
  is_active
) values (
  'NG',
  'Nigeria',
  'NGN',
  'Zenith Bank',
  'Onarion Ltd',
  '1310176960',
  'Use your shipment reference as the payment reference.',
  true
) on conflict do nothing;

-- Seed initial Nigeria pickup points. Replace placeholder addresses before production use.
insert into public.pickup_points (
  country_code,
  country_name,
  state,
  city,
  name,
  address,
  notes,
  is_active
) values
  (
    'NG',
    'Nigeria',
    'Lagos',
    'Lagos',
    'Lagos Pickup Warehouse',
    'REPLACE_WITH_LAGOS_PICKUP_WAREHOUSE_ADDRESS',
    'Recipient will collect from this designated pickup warehouse.',
    true
  ),
  (
    'NG',
    'Nigeria',
    'FCT',
    'Abuja',
    'Abuja Pickup Warehouse',
    'REPLACE_WITH_ABUJA_PICKUP_WAREHOUSE_ADDRESS',
    'Recipient will collect from this designated pickup warehouse.',
    true
  )
on conflict do nothing;
