# Circuit 41 Mobile — Project Status

## Version 1.0.1 Update

**Date:** 2026-05-25

### Scope

Focused launch-safe update across checkout, bank transfer proof upload, Nigeria pickup-point handling, and Supabase migration preparation.

### Changes

- Added Supabase-backed bank-transfer account lookup for United Kingdom and Nigeria.
- Removed hardcoded bank account display from checkout.
- Payment reference now uses the shipment tracking/order reference where available, falling back to the shipment id prefix.
- Added payment proof metadata insertion into `payment_proofs` after uploading files to the existing private `documents` bucket.
- Nigeria-bound checkout now asks users to select a Supabase-backed pickup point instead of forcing a home delivery address.
- UK and other destination flows retain the existing delivery-address behavior.
- App version updated to `1.0.1`.
- iOS build number updated to `7`.

### Backend

Created migration:

- `supabase/migrations/20260525135140_c41_101_payment_accounts_proofs_pickup_points.sql`

The migration creates:

- `payment_accounts`
- `payment_proofs`
- `pickup_points`
- nullable `shipments.pickup_point_id`
- initial RLS policies
- initial placeholder seed rows for GB/NG bank accounts and Lagos/Abuja pickup points

### Required Before Production

- Replace placeholder bank details in the migration or production rows with real UK and Nigeria account details.
- Replace Lagos and Abuja placeholder pickup warehouse addresses with real operational addresses.
- Apply migration to Supabase after confirming live schema/RLS.
- Supabase MCP currently requires reauthentication, so live schema/policy verification was not completed through the connector.

### Verification Status

- `npx tsc --noEmit` was run on 2026-05-25.
- It failed on pre-existing project-wide issues outside this change path:
  - `App.tsx`: unsupported `tabBarPressColor` option. Fixed later in the 1.0.1 live device fix pass.
  - `lib/googleAuth.ts`: `nonce` not accepted by current Google sign-in type.
  - `screens/ToolsScreen.tsx`: `Tools` is not part of `TabParamList`.
  - Supabase Edge Function files use Deno/remote imports that the app TypeScript config does not understand.
- No new checkout/payment/pickup-point type errors appeared in the reported output.

---

## 1.0.1 Pre-Submission Fix Pass

**Date:** 2026-05-25

### Mobile Checkout Fixes

- Refined Nigeria pickup-point checkout UI without changing checkout architecture.
- Visible pickup copy is now:
  - Title: `Select pickup point`
  - Helper: `Choose where the recipient will collect this shipment.`
- Moved the longer Nigeria pickup explanation into an info modal:
  - `Nigeria-bound shipments may be collected from designated pickup warehouses. Final local delivery may be arranged separately where available.`
- Pickup-point cards now show a compact collapsed view:
  - city
  - pickup point name
  - first address line plus city/state
- Full pickup address is hidden behind `View details`.
- Added a `Copy address` action in the expanded card.
- Selected pickup state remains visible but less visually heavy.

### Supabase / RLS

- No new SQL/RLS changes required for this pass.
- Existing 1.0.1 migration is still required for `payment_accounts`, `payment_proofs`, `pickup_points`, and `shipments.pickup_point_id`.

### Remaining TODOs Before iOS 1.0.1 Submission

- Test Nigeria checkout on device/simulator for pickup selection, details expansion, and copy action.
- Test UK checkout to confirm address flow remains unchanged.
- Re-run full app type/build checks after the existing unrelated TypeScript issues are resolved.

### Verification

- `npx tsc --noEmit` was re-run after this pass.
- It still fails on the known unrelated project-wide issues listed above.
- No `ShipmentCheckoutScreen.tsx` errors were reported.

---

## 1.0.1 Final Mobile Polish Pass

**Date:** 2026-05-25

### Recent Activity Expiry

- Dashboard recent activity now only shows activity created within the last 5 days.
- Older activity remains available in the full `Activity` screen.
- Live schema check confirmed `activity` has `created_at` and `is_read`, but no `updated_at`; the expiry rule uses `created_at`.

### Activity Unread Badge

- Dashboard notification bell now shows a small red dot when any activity row for the current user has `is_read = false`.
- Opening the `Activity` screen marks unread activity rows as read using the existing `activity.is_read` column.
- Activity was not moved into the bottom tab bar for 1.0.1 because that would touch navigation structure.

### Pickup Point Card Simplification

- Nigeria pickup point collapsed cards now show only the pickup point name.
- City, state, and partial address were removed from the collapsed card.
- `View details` still reveals the full address and copy-address action.

### Shipment Route Display

- `ShipmentWorkspaceScreen` now displays the route clearly in the header when origin/destination are available.
- Example format: `China → Nigeria`.

### Supabase / RLS

- No schema or RLS changes required.
- Existing `activity.is_read` supports the unread badge and mark-read behavior.

### Verification

- `npx tsc --noEmit` was re-run after this polish pass.
- It still fails on the known unrelated project-wide issues:
  - `App.tsx` unsupported tab bar press options. Fixed later in the 1.0.1 live device fix pass.
  - `lib/googleAuth.ts` unsupported `nonce` property.
  - `screens/ToolsScreen.tsx` route type mismatch.
  - Supabase Edge Function Deno/remote import typings.
- No errors were reported in the files changed by this pass.

---

## 1.0.1 Live Device Fix Pass

**Date:** 2026-05-25

### Corrected Activity Read Logic

- Opening the `Activity` screen no longer marks all activity rows as read.
- The dashboard bell red dot remains while any `activity.is_read = false` rows exist.
- Tapping an activity linked to a shipment now marks unread activity rows for that shipment only.
- Unread activity for other shipments remains unread, so the red dot stays visible until every unread shipment group has been viewed.

### Actions Incomplete Badge

- Added a red dot to the Actions tab icon when the current user has visible pending actions.
- The dot is based on `actions.status = 'pending'` and uses the same mobile visibility rule as the Actions screen: actions on `in_progress` shipments are hidden.
- Opening the Actions tab does not clear the dot.
- Completing/submitting an action refreshes the badge and clears it only when no other visible pending actions remain.

### Supabase / RLS

- Required SQL/RLS change was applied and saved locally:
  - `supabase/migrations/20260525162000_allow_staff_select_activity_actions.sql`
- This migration adds staff SELECT policies for `activity` and `actions` so ops-created rows can load after insertion.

### Additional Mobile Type Compatibility

- Removed unsupported React Navigation tab options `tabBarPressColor` and `tabBarPressOpacity` from `App.tsx`.
- This cleared the `App.tsx` TypeScript error.

### Verification

- `npx tsc --noEmit` was re-run.
- Remaining failures are unrelated existing issues:
  - `lib/googleAuth.ts` unsupported `nonce` property.
  - `screens/ToolsScreen.tsx` route type mismatch.
  - Supabase Edge Function Deno/remote import typings.

---

## 1.0.1 Supabase-Managed Rates / FX Blocker Fix

**Date:** 2026-05-25

### Supabase

- Added and applied migration:
  - `supabase/migrations/20260525171000_c41_101_fx_shipping_rates.sql`
- New tables:
  - `fx_rates`
  - `shipping_rates`
- Added shipment metadata columns:
  - `shipments.shipping_rate_id`
  - `shipments.rate_currency`
- RLS:
  - mobile users can read active `fx_rates`
  - mobile users can read active `shipping_rates`
  - staff can read all rates
  - only active `admin` / `super_admin` staff can insert/update/deactivate rates
- Live verification found:
  - `fx_rates`: 3 rows
  - `shipping_rates`: 20 rows seeded from existing `slots`

### Mobile

- `SlotSelectionScreen` now reads active `shipping_rates` instead of hardcoded/legacy `slots`.
- Only non-null rate categories are shown in the mobile rate card.
- Selected service/rate is carried into shipment creation through `shipping_rate_id`, `slot_rate`, and `rate_currency`.
- Checkout calculates amount due from `total_weight * slot_rate` when `total_cost` is not already stored.
- Checkout displays the amount in the shipment rate currency.
- Shipment detail cost rows now display the stored shipment rate currency instead of assuming GBP.
- Bank transfer now converts the amount into the selected bank account currency using active `fx_rates`.
- Bank transfer section shows:
  - `Transfer amount: £X` for UK accounts
  - `Transfer amount: ₦X` for Nigeria accounts
- If the required FX rate is missing, checkout shows a safe error instead of displaying a wrong converted amount.
- Card payments still charge in GBP; if shipment pricing is not GBP, checkout requires an active FX rate to GBP before proceeding.

### Verification

- `npx tsc --noEmit` was re-run.
- Remaining failures are unchanged existing issues:
  - `lib/googleAuth.ts` unsupported `nonce` property.
  - `screens/ToolsScreen.tsx` route type mismatch.
  - Supabase Edge Function Deno/remote import typings.

---

## 1.0.1 Rates Architecture Cleanup

**Date:** 2026-05-25

### Canonical Model

- `shipping_rates` is now the canonical table for route/service pricing and drop-off warehouse instructions.
- `slots` remains untouched as legacy data until the verified app release no longer depends on it.
- Shipment rates are canonicalized to USD.
- FX rates are expected to convert from USD to target currencies such as GBP and NGN.
- The legacy active GBP to NGN FX row remains available for older GBP-priced shipments, but ops FX management now surfaces USD-base rows only.
- Controlled service types are:
  - `economy` = `Most affordable`
  - `standard` = `Recommended`
  - `express` = `Fast`

### Supabase

- Added and applied migration:
  - `supabase/migrations/20260525182000_c41_101_shipping_rates_warehouse_canonical.sql`
- Added and applied migration:
  - `supabase/migrations/20260525182500_c41_101_shipping_rates_usd_canonical.sql`
- Added warehouse/drop-off fields to `shipping_rates`:
  - `warehouse_name`
  - `warehouse_address`
  - `warehouse_city`
  - `warehouse_state`
  - `warehouse_country`
  - `warehouse_postcode`
  - `warehouse_contact_phone`
  - `warehouse_notes`
- Copied legacy `slots.name` and `slots.warehouse_address` into matching `shipping_rates` rows by origin country, destination country, and service name.
- Backfilled missing `shipments.warehouse_address` from the selected `shipping_rates` row where possible.
- Converted existing GBP `shipping_rates` values into USD using the active USD to GBP FX rate.
- Live verification found:
  - 20 `shipping_rates` rows in USD
  - 4 `economy`, 8 `standard`, and 8 `express` rows
  - 20 `shipping_rates` rows with warehouse addresses
  - 20 legacy `slots` rows still present and untouched

### Mobile

- `ShippingRouteScreen` now derives route options from active `shipping_rates`, not `slots`.
- `SlotSelectionScreen` still uses the existing slot-style UI model internally, but maps it from `shipping_rates` rows.
- Selected route/service records now carry warehouse/drop-off fields from `shipping_rates` into shipment creation.
- New shipments default `rate_currency` to USD when a selected rate does not provide a currency.
- Checkout defaults missing shipment rate currency to USD.
- Shipment detail and rate cards default missing currency display to USD.
- Amount due now uses the selected shipping rate and goods category where available:
  - effective rate = selected goods-category rate from `shipping_rates`
  - amount due = effective rate × confirmed shipment weight
  - stored/manual `shipments.total_cost` still wins as an override
- If ops later changes the goods category basis after a manual total has been set, ops should update or clear the manual `total_cost` value so recalculation can reflect the new category.

### Verification

- Ops live database verification completed through Supabase MCP.
- `npx tsc --noEmit` was re-run for the mobile app.
- Remaining failures are unchanged existing issues:
  - `lib/googleAuth.ts` unsupported `nonce` property.
  - `screens/ToolsScreen.tsx` route type mismatch.
  - Supabase Edge Function Deno/remote import typings.
- No pricing/rates files appeared in the TypeScript error output.

---

## Archived shipments hidden from customers (2026-06-14)

Ops can archive a shipment (`shipments.archived_at`). Archived shipments must not appear in the
customer-facing mobile app.

**Primary mechanism — server-side RLS (no app release needed):**
Migration `supabase/migrations/20260614100045_c41_phase2c_hide_archived_from_customers.sql` changes
the customer SELECT policy to `(auth.uid() = user_id AND archived_at IS NULL)`. Archived shipments
disappear from every customer query (lists + detail) immediately, enforced in the database. The staff
policy is unchanged (Ops still sees archived). No data is deleted. **This is live now and does not
require an App Store / Play Store update.**

**Defensive client changes (ship with the next normal build; not required):**
- `screens/ShipmentsScreen.tsx` and `screens/DashboardScreen.tsx`: added `.is('archived_at', null)` to
  the customer list queries.
- `lib/database.types.ts`: added `archived_at` / `archived_by` to the `Shipment` type.
- A detail `.single()` on an archived shipment now returns no row under RLS → handled by the existing
  not-found path. (A friendlier "this shipment is no longer available" message would be a future polish.)

No other mobile behaviour changed. No auth changes.

---

## Phase 3 — Shipment ticketing + archive history (2026-06-14)

### Migration `20260614111928_c41_phase3_tickets_and_archive_visibility.sql`
Applied to production. Two parts:
1. **Archive visibility reverted for customers.** The customer `shipments` SELECT policy is back to
   `(auth.uid() = user_id)` (Phase 2C's `archived_at IS NULL` restriction removed). Archived
   shipments are viewable by their owner again and now belong in the **completed/history** section.
2. **New tables** (staff + owning customer only; no anon):
   - `shipment_tickets (id, shipment_id, user_id, status new|in_progress|closed, subject, created_at, updated_at, closed_at)`
   - `shipment_ticket_messages (id, ticket_id, sender_user_id, sender_staff_id, sender_type customer|staff|system, message, created_at)`
   - Trigger bumps `tickets.updated_at` on every message.

### Archive — customer behaviour (mobile)
- **Active tab** excludes archived (active/in-progress queries keep `.is('archived_at', null)`).
- **Completed tab** now shows `status='delivered' OR archived_at IS NOT NULL` — archived shipments
  move here and stay viewable. Completed cards show an **"Archived"** badge (and "Delivered · Archived"
  when both). Detail header shows an **Archived** pill. Nothing vanishes; nothing is deleted.

### Tickets — customer behaviour (mobile)
- A **help (?) icon** (C41 accent `#CD643D`) is added to the **Shipment Detail** and **Shipment
  Workshop** headers. Tapping opens the new **`ShipmentSupportScreen`**.
- Support screen: "Ask a question" form (optional subject + message) → creates a ticket
  (`status='new'`, auto-attaches `shipment_id` + `user_id`) and its first message. Existing tickets
  list with status (Open / In progress / Closed); tap to expand the message thread; customers can
  add follow-up replies to non-closed tickets. Closed tickets stay visible as history.

### Files changed (mobile)
- `lib/database.types.ts` — `ShipmentTicket`, `ShipmentTicketMessage`, `TicketStatus`.
- `screens/ShipmentsScreen.tsx` — completed query includes archived; Archived badge on history cards.
- `screens/ShipmentDetailScreen.tsx` — help icon → support; Archived pill in header.
- `screens/ShipmentWorkspaceScreen.tsx` — help icon → support (when the shipment exists).
- `screens/ShipmentSupportScreen.tsx` — **new** customer ticket screen.
- `App.tsx` — registered `ShipmentSupport` route.

### Ops side
See `circuit41-ops/PROJECT_STATUS.md` (Phase 3): dashboard ticket categories (New ticket / Customer
replied), a Tickets panel on shipment detail (reply / in progress / close / reopen), and ticket
events in Recent Changes + Internal Timeline.

### RLS / security
Staff (active) full access to tickets + messages; customers limited to their own shipments' tickets
and may only message non-closed tickets; no anon. Advisor after migration: no new findings.

### Mobile build REQUIRED
The RLS revert + ticket tables are live server-side now, but **all customer-facing changes
(archive→history, Archived badge, help icon, support screen) require a new mobile build** to reach
devices. `tsc --noEmit` passes for the changed files. See the session notes for the quickest
TestFlight/dev-build install path.

---

## Mobile UI overhaul — phase 1 (2026-06-14)

UI-only pass (no business logic changed). Monzo-*inspired* principles — soft card layout, calm
warm-neutral surfaces, friendly type, generous spacing, a floating rounded bottom nav — with the
C41 accent `#CD643D` used **sparingly** (selected nav, primary CTAs, small badges). Not a copy of
Monzo; no banking patterns.

### New shared design system
- `lib/theme.ts` — single source of truth: warm neutral palette, **accent `#CD643D`**, soft shadow
  tokens, radius/spacing scales, Plus Jakarta Sans ramp. Screens migrate to it incrementally
  (previously every screen hard-coded its own `DS` block with the master-brand red `#C10F1D`).

### Bottom navigation
- Replaced the heavy dark edge-to-edge bar with a **floating, rounded, light pill** (side + bottom
  margins, radius 28, soft shadow), now **with labels** and the **accent `#CD643D` for the selected
  tab** (inactive = warm grey). The Actions badge dot is now accent on a white border.
- Consistently visible across the main tab screens (Home, Shipments, Actions, Profile).

### Floating home button removed
- The glossy floating "home" FAB on the **Shipment Workshop** was removed. Return is handled by the
  existing **back button** (`handleBack`, which already routes to the correct source tab) — so
  navigation is cleaner and there's no redundant floating control. Pushed stack screens
  (Detail/Workshop/Checkout) keep the back button; the tab bar is not force-shown on them (that would
  need risky navigation restructuring — out of scope for a UI pass).

### Cards & accent
- Shipment cards (active / in-progress / completed-history) are softer/premium: radius 18, hairline
  neutral border, subtle shadow, more padding. Harsh per-status **colored borders removed** — status
  is shown by the pill/badge instead (incl. the **Archived** badge). Dashboard card base + Support
  cards get the same soft shadow.
- Accent shifted from red `#C10F1D` → `#CD643D` on Home, Shipments, Detail, Workshop (Support already
  used it). Destructive actions (cancel parcel/shipment) keep red intentionally.

### Files changed
- `lib/theme.ts` (new)
- `App.tsx` — floating bottom nav + labels + accent + badge colour
- `screens/ShipmentsScreen.tsx` — soft cards, accent, neutral borders
- `screens/DashboardScreen.tsx` — accent, soft card base
- `screens/ShipmentDetailScreen.tsx` — accent (incl. action pill + spinner), softer borders
- `screens/ShipmentWorkspaceScreen.tsx` — removed floating home button + styles, accent
- `screens/ShipmentSupportScreen.tsx` — soft card shadows

### Preserved (unchanged behaviour)
Login/auth, shipment creation, listing, archived placement, ticketing, payment proof upload, pickup
point selection, bank transfer, checkout, actions/activity, support/help icon, completed/history
logic. Checkout was intentionally left structurally untouched (accent only via shared tokens later).

### Build / native
- `tsc --noEmit` — **0 errors** across the project.
- **No native rebuild required** — JS/style only, no new native modules. Loads on the existing dev
  build via `expo start --dev-client` (or a JS reload).

### Follow-up (not in this pass)
Secondary screens (auth flow, Profile/Tools/Settings, Checkout internals, bottom sheets) still use
their own inline `DS` red accent and can be migrated to `lib/theme.ts` next. Forcing the floating nav
onto pushed shipment screens would need a navigation refactor.
