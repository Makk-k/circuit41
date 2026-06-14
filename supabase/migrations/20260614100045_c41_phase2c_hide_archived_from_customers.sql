-- Circuit 41 — hide archived shipments from customers (server-side, no app release needed).
-- Adds `archived_at IS NULL` to the customer SELECT policy on shipments. Staff policy is
-- unchanged, so ops still sees archived shipments (Show archived / Unarchive keep working).
-- No data is deleted. The customer mobile app needs NO code change for this to take effect.
--
-- Applied to project ovowxxiyxjsntowwnxso on 2026-06-14 via Supabase MCP apply_migration.

drop policy if exists "Users can view own shipments" on public.shipments;

create policy "Users can view own shipments"
  on public.shipments
  for select
  to public
  using (auth.uid() = user_id and archived_at is null);
