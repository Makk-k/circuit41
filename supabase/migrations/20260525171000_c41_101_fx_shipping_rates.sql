create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  target_currency text not null,
  rate numeric not null check (rate > 0),
  is_active boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (base_currency, target_currency)
);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  origin_country text not null,
  destination_country text not null,
  origin_country_code text null,
  destination_country_code text null,
  service_name text null,
  service_type text null check (service_type is null or service_type in ('fast', 'recommended', 'affordable')),
  currency text not null default 'USD',
  general_goods_rate numeric null check (general_goods_rate is null or general_goods_rate >= 0),
  battery_items_rate numeric null check (battery_items_rate is null or battery_items_rate >= 0),
  branded_goods_rate numeric null check (branded_goods_rate is null or branded_goods_rate >= 0),
  fragile_goods_rate numeric null check (fragile_goods_rate is null or fragile_goods_rate >= 0),
  liquid_goods_rate numeric null check (liquid_goods_rate is null or liquid_goods_rate >= 0),
  electronics_rate numeric null check (electronics_rate is null or electronics_rate >= 0),
  documents_rate numeric null check (documents_rate is null or documents_rate >= 0),
  clothing_rate numeric null check (clothing_rate is null or clothing_rate >= 0),
  cosmetics_rate numeric null check (cosmetics_rate is null or cosmetics_rate >= 0),
  minimum_charge numeric null check (minimum_charge is null or minimum_charge >= 0),
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipments
  add column if not exists shipping_rate_id uuid null references public.shipping_rates(id) on delete set null,
  add column if not exists rate_currency text not null default 'GBP';

create index if not exists fx_rates_active_pair_idx on public.fx_rates (base_currency, target_currency) where is_active = true;
create index if not exists shipping_rates_active_route_idx on public.shipping_rates (origin_country, destination_country) where is_active = true;

alter table public.fx_rates enable row level security;
alter table public.shipping_rates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fx_rates' and policyname = 'Users can read active fx rates') then
    create policy "Users can read active fx rates" on public.fx_rates for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fx_rates' and policyname = 'Staff can read all fx rates') then
    create policy "Staff can read all fx rates" on public.fx_rates for select using (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true)
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fx_rates' and policyname = 'Admins can manage fx rates') then
    create policy "Admins can manage fx rates" on public.fx_rates for all using (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true and staff_users.role in ('admin', 'super_admin'))
    ) with check (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true and staff_users.role in ('admin', 'super_admin'))
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_rates' and policyname = 'Users can read active shipping rates') then
    create policy "Users can read active shipping rates" on public.shipping_rates for select using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_rates' and policyname = 'Staff can read all shipping rates') then
    create policy "Staff can read all shipping rates" on public.shipping_rates for select using (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true)
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shipping_rates' and policyname = 'Admins can manage shipping rates') then
    create policy "Admins can manage shipping rates" on public.shipping_rates for all using (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true and staff_users.role in ('admin', 'super_admin'))
    ) with check (
      exists (select 1 from public.staff_users where staff_users.id = auth.uid() and staff_users.active = true and staff_users.role in ('admin', 'super_admin'))
    );
  end if;
end $$;

grant select on public.fx_rates to anon, authenticated;
grant insert, update, delete on public.fx_rates to authenticated;
grant select on public.shipping_rates to anon, authenticated;
grant insert, update, delete on public.shipping_rates to authenticated;

insert into public.fx_rates (base_currency, target_currency, rate, is_active)
values
  ('USD', 'GBP', 0.79, true),
  ('USD', 'NGN', 1500, true),
  ('GBP', 'NGN', 1900, true)
on conflict (base_currency, target_currency) do nothing;

insert into public.shipping_rates (
  origin_country,
  destination_country,
  service_name,
  service_type,
  currency,
  general_goods_rate,
  battery_items_rate,
  branded_goods_rate,
  liquid_goods_rate,
  is_active,
  notes
)
select
  s.origin_country,
  s.destination_country,
  s.name,
  case
    when lower(coalesce(s.tag, '')) like '%fast%' or lower(coalesce(s.tag, '')) like '%express%' then 'fast'
    when lower(coalesce(s.tag, '')) like '%afford%' or lower(coalesce(s.tag, '')) like '%economy%' then 'affordable'
    else 'recommended'
  end,
  'GBP',
  s.general_rate,
  s.battery_rate,
  s.branded_rate,
  s.liquid_rate,
  s.is_active,
  'Seeded from existing slots table for 1.0.1 rate management.'
from public.slots s
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'slots'
)
and not exists (
  select 1 from public.shipping_rates sr
  where sr.origin_country = s.origin_country
    and sr.destination_country = s.destination_country
    and coalesce(sr.service_name, '') = coalesce(s.name, '')
);
