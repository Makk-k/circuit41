with usd_gbp as (
  select rate
  from public.fx_rates
  where base_currency = 'USD'
    and target_currency = 'GBP'
    and is_active = true
  order by updated_at desc
  limit 1
)
update public.shipping_rates sr
set
  currency = 'USD',
  general_goods_rate = case when general_goods_rate is null then null else round(general_goods_rate / usd_gbp.rate, 2) end,
  battery_items_rate = case when battery_items_rate is null then null else round(battery_items_rate / usd_gbp.rate, 2) end,
  branded_goods_rate = case when branded_goods_rate is null then null else round(branded_goods_rate / usd_gbp.rate, 2) end,
  fragile_goods_rate = case when fragile_goods_rate is null then null else round(fragile_goods_rate / usd_gbp.rate, 2) end,
  liquid_goods_rate = case when liquid_goods_rate is null then null else round(liquid_goods_rate / usd_gbp.rate, 2) end,
  electronics_rate = case when electronics_rate is null then null else round(electronics_rate / usd_gbp.rate, 2) end,
  documents_rate = case when documents_rate is null then null else round(documents_rate / usd_gbp.rate, 2) end,
  clothing_rate = case when clothing_rate is null then null else round(clothing_rate / usd_gbp.rate, 2) end,
  cosmetics_rate = case when cosmetics_rate is null then null else round(cosmetics_rate / usd_gbp.rate, 2) end,
  minimum_charge = case when minimum_charge is null then null else round(minimum_charge / usd_gbp.rate, 2) end,
  notes = concat_ws(E'\n', sr.notes, 'Converted from GBP to USD using active USD->GBP FX rate during 1.0.1 canonical rates cleanup.'),
  updated_at = now()
from usd_gbp
where sr.currency = 'GBP';
