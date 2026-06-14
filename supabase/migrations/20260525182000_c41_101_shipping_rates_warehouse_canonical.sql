alter table public.shipping_rates
  add column if not exists warehouse_name text null,
  add column if not exists warehouse_address text null,
  add column if not exists warehouse_city text null,
  add column if not exists warehouse_state text null,
  add column if not exists warehouse_country text null,
  add column if not exists warehouse_postcode text null,
  add column if not exists warehouse_contact_phone text null,
  add column if not exists warehouse_notes text null;

alter table public.shipping_rates drop constraint if exists shipping_rates_service_type_check;

update public.shipping_rates
set service_type = case service_type
  when 'fast' then 'express'
  when 'recommended' then 'standard'
  when 'affordable' then 'economy'
  else service_type
end
where service_type in ('fast', 'recommended', 'affordable');

alter table public.shipping_rates
  add constraint shipping_rates_service_type_check
  check (service_type is null or service_type in ('economy', 'standard', 'express'));

update public.shipping_rates sr
set
  warehouse_name = coalesce(sr.warehouse_name, nullif(s.name, '')),
  warehouse_address = coalesce(sr.warehouse_address, nullif(s.warehouse_address, '')),
  warehouse_country = coalesce(sr.warehouse_country, s.origin_country),
  warehouse_notes = coalesce(sr.warehouse_notes, 'Copied from legacy slots table for 1.0.1 canonical shipping_rates cleanup.'),
  updated_at = now()
from public.slots s
where sr.origin_country = s.origin_country
  and sr.destination_country = s.destination_country
  and coalesce(sr.service_name, '') = coalesce(s.name, '')
  and s.warehouse_address is not null
  and btrim(s.warehouse_address) <> '';

update public.shipments sh
set warehouse_address = sr.warehouse_address
from public.shipping_rates sr
where sh.shipping_rate_id = sr.id
  and (sh.warehouse_address is null or btrim(sh.warehouse_address) = '')
  and sr.warehouse_address is not null
  and btrim(sr.warehouse_address) <> '';
