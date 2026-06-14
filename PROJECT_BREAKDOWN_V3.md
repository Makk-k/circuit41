# Circuit41 — Project Breakdown V3
_Generated 2026-04-14. Based on full codebase read._

---

## 1. Project Overview

Circuit41 is a React Native / Expo mobile app for a freight forwarding service (operating under the "Circuit 40s" brand). Users can create shipments, declare parcels, pay for shipping, and track delivery progress. An admin/operator manages the back end through Supabase directly.

The app is consumer-facing only — there is no admin panel in this codebase.

**Tech stack:**
- React Native 0.83.4 with Expo SDK 55
- TypeScript throughout
- Supabase for auth, database, and file storage
- Stripe (stripe-react-native 0.63.0) for payments
- Google Sign-In via @react-native-google-signin/google-signin
- Navigation via React Navigation v7 (native stack + bottom tabs)
- Fonts: Plus Jakarta Sans via @expo-google-fonts

---

## 2. Navigation Structure

```
Welcome
  ├── Google Sign-In → (ProfileSetup if new user) → MainTabs
  ├── Apple Sign-In → "Coming Soon" alert (NOT IMPLEMENTED)
  └── Phone/Email → PhoneEmail
        ├── Phone OTP → Verification → (ProfileSetup if new user) → MainTabs
        └── Email link → Verification (magic link) → MainTabs
              └── EmailWaiting screen exists but is NEVER navigated to from PhoneEmailScreen

MainTabs (bottom tab navigator, 5 tabs):
  ├── Tools        — placeholder, "Coming Soon"
  ├── Shipments    → ShipmentDetail or ShipmentWorkspace (via navigateToShipment helper)
  ├── Home         → Activity (full list), ShippingRoute (start new shipment)
  ├── Actions      — inline ActionBottomSheet
  └── Profile      → SavedCards

Stack screens (above tabs):
  ShipmentDetail
  Activity
  ShippingRoute → SlotSelection → ShipmentWorkspace → ShipmentCheckout → ShipmentActive → MainTabs
  SavedCards
  EmailWaiting (registered but unreachable in normal flow)
```

Tab order left-to-right: Tools, Shipments, Home, Actions, Profile.

---

## 3. Environment & Configuration

**Environment variables (in .env, never committed):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**App identifiers:**
- Bundle ID: `com.circuit40s.circuit41`
- URL scheme: `circuit41`
- Stripe merchant identifier: `merchant.com.circuit40s.circuit41`

**EAS Build:**
- Apple ID: abdulkarymmay@gmail.com
- `ascAppId` and `appleTeamId` are still placeholder strings — must be filled before production build
- Profiles: development (simulator), preview (internal distribution), production

**Supabase:**
- One Edge Function expected: `create-payment-intent` — not in this repo, must exist in Supabase dashboard
- Storage bucket: `documents` (for receipts, payment proofs, shipment documents)
- RLS policies are assumed but not verified from this codebase

---

## 4. Database Schema

Inferred entirely from client code. No migration files in this repo. `database.types.ts` is partially out of date (missing several tables and columns).

### profiles
| column | notes |
|--------|-------|
| id | matches Supabase auth user id |
| first_name | |
| last_name | |
| preferred_name | |
| phone | |
| email | pulled from auth session, not stored here |

### shipments
| column | notes |
|--------|-------|
| id | |
| user_id | |
| status | 'in_progress', 'ready', 'confirmed', 'received', 'origin_port', 'in_transit', 'destination_port', 'out_for_delivery', 'delivered', 'completed' |
| slot_name | display name of the slot |
| slot_tag | short tag |
| slot_rate | rate per kg used for this shipment |
| origin_country | |
| destination_country | |
| delivery_address | full string |
| total_weight | set by admin |
| total_cost | set by admin |
| payment_method | 'card' or 'bank_transfer' |
| payment_status | |
| carrier | |
| carrier_vessel | |
| tracking_reference | |
| estimated_delivery | |
| origin_port_name | |
| destination_port_name | |
| out_for_delivery_note | |
| received_at, origin_port_at, in_transit_at, destination_port_at, out_for_delivery_at, delivered_at | timestamps for each stage |
| is_visible | soft-delete flag — NOT in database.types.ts |
| warehouse_address | |
| created_at, updated_at | |

### parcels
| column | notes |
|--------|-------|
| id | |
| shipment_id | |
| user_id | |
| item_names | string array |
| tracking_id | assigned externally |
| reference_id | user-provided |
| declared_value | |
| category | |
| sensitive_types | string array ('battery', 'liquid', 'branded') |
| status | |
| weight | NOT in database.types.ts |
| receipt_path | NOT in database.types.ts |
| has_receipt | NOT in database.types.ts |
| created_at, updated_at | |

### slots
| column | notes |
|--------|-------|
| id | |
| name | |
| tag | |
| origin_country | |
| destination_country | |
| general_rate | |
| battery_rate | |
| branded_rate | |
| liquid_rate | |
| warehouse_address | |
| is_active | |
| estimated_duration | |
| created_at | |

### actions
| column | notes |
|--------|-------|
| id | |
| shipment_id | |
| user_id | |
| title | |
| description | |
| action_type | 'payment_required', 'document_required', 'customs_info', 'other' |
| due_date | |
| status | 'pending', 'completed' |
| submitted_value | user response text |
| created_at, updated_at | |

### activity
Table name is `activity` (not `activities`).
| column | notes |
|--------|-------|
| id | |
| user_id | |
| shipment_id | |
| message | |
| type | |
| is_read | |
| created_at | |

### saved_addresses
| column | notes |
|--------|-------|
| id | |
| user_id | |
| address_line | |
| city | |
| country | |
| postcode | |
| is_default | |
| created_at | |

### documents
NOT in database.types.ts.
| column | notes |
|--------|-------|
| id | |
| shipment_id | |
| user_id | |
| name | |
| file_path | path in Supabase Storage `documents` bucket |
| file_type | 'receipt', 'payment_proof', 'shipment_doc', etc. |
| uploaded_by | 'user' or 'admin' |
| created_at | |

### saved_cards
NOT in database.types.ts.
| column | notes |
|--------|-------|
| id | |
| user_id | |
| stripe_payment_method_id | raw Stripe PM id |
| card_brand | e.g. 'visa', 'mastercard' |
| card_last4 | |
| card_exp_month | |
| card_exp_year | |
| is_default | |

---

## 5. Screen-by-Screen Breakdown

### WelcomeScreen
**Status: Mostly working**
- Google Sign-In: functional, uses SHA256 nonce flow via expo-crypto
- Apple Sign-In: button present, taps show "Coming Soon" alert — NOT implemented
- "Use phone or email" CTA navigates to PhoneEmail
- After sign-in, routes to ProfileSetup if `is_new_user` flag set on session, else MainTabs

### PhoneEmailScreen
**Status: Partially working**
- Toggle between phone and email input modes
- Phone: country picker modal with 12 hardcoded countries (GH, NG, UK, US, CA, DE, FR, NL, BE, IT, ES, PT). Sends OTP via `supabase.auth.signInWithOtp`.
- Email: sends magic link via same OTP call with `emailRedirectTo: 'circuit41://auth'`
- Always navigates to VerificationScreen regardless of phone/email — EmailWaitingScreen is NEVER used
- SMS OTP likely does not work unless Supabase project has an SMS provider configured

### VerificationScreen
**Status: Working for email magic link, questionable for SMS**
- 6 individual digit input boxes with auto-advance
- Calls `supabase.auth.verifyOtp` with type `'email'` or `'sms'`
- Routes new users to ProfileSetup, returning users to MainTabs
- Resend countdown timer (60 seconds)

### EmailWaitingScreen
**Status: Exists but unreachable**
- Shows "Check your email" with resend button
- Never navigated to in the current PhoneEmailScreen flow
- Can be deleted or the flow can be updated to use it

### ProfileSetupScreen
**Status: Working**
- Collects first name, last name, preferred name
- Upserts to `profiles` table
- Navigates to MainTabs with `isNewUser: true`

### DashboardScreen (Home tab)
**Status: Working**
- Shows up to 2 active shipments (all non-completed, non-delivered statuses)
- Activity feed showing recent unread items
- Animated divider between sections
- Skeleton loading cards on first load
- 30-second staleness tracking via `useRef<number>(0)` + `useFocusEffect`
- "Start new shipment" → ShippingRoute
- "View all activity" → Activity screen

### ShipmentsScreen
**Status: Working**
- Active / Completed tabs
- Active: in_progress, ready, confirmed, received, origin_port, in_transit, destination_port, out_for_delivery
- Completed: delivered, completed
- In-progress section (status === 'in_progress') shown separately above active list
- 3 parallel Supabase queries on mount
- Tapping any shipment routes via `navigateToShipment` helper

### ActivityScreen
**Status: Working**
- Full activity list, grouped by date
- Mark individual items as read
- Mark all as read button
- Navigates back to Dashboard

### ActionsScreen
**Status: Working**
- Lists pending actions from `actions` table
- Due date badges (overdue shows red)
- Tapping opens ActionBottomSheet inline
- Empty state when no pending actions

### ToolsScreen
**Status: Placeholder only**
- Renders a single "Coming Soon" message
- No functionality

### ShipmentDetailScreen
**Status: Working**
- 4 tabs: Overview, Parcels, Documents, Timeline
- Overview: shipment status, addresses, carrier info, tracking
- Parcels: list with item names, tracking ID, category, weight
- Documents: list with download/open, upload new document
- Timeline: events feed with timestamps
- Collapsible card sections with LayoutAnimation
- `isCompleted` param hides action buttons on completed shipments

### ShippingRouteScreen
**Status: Working**
- Fetches active slots from `slots` table
- Groups by origin/destination pair
- Falls back to a hardcoded list if table is empty
- Origin and destination pickers as modal-style dropdowns
- Navigates to SlotSelection with origin + destination

### SlotSelectionScreen
**Status: Working**
- Shows available slots for a given route
- Expandable rate cards (general/battery/branded/liquid rates per kg)
- Estimated duration displayed
- Auto-selects first slot
- Navigates to ShipmentWorkspace

### ShipmentWorkspaceScreen
**Status: Working**
- Creates a shipment record on mount if no `shipmentId` param
- Lists parcels via `AddItemBottomSheet`
- Each parcel shows: item names, category, sensitive type chips, tracking ID as tappable red link (opens QR modal), weight
- QR code modal for tracking ID
- Swipe-to-delete on parcel cards (with confirmation)
- "Ready to send" button updates shipment status to 'ready'
- Navigates to ShipmentCheckout

### ShipmentCheckoutScreen
**Status: Mostly working, some mock data**
- Delivery address: pulls from saved_addresses, uses AddressBottomSheet
- Cost breakdown: reads `total_weight`, `slot_rate`, `total_cost` directly from shipments record. Shows "Pending" / "TBC" when not yet set by admin
- Payment method toggle: Card or Bank Transfer
- Card: shows saved cards from `saved_cards` table as selectable list with radio buttons; "+ Add new card" → SavedCards
- Bank transfer: shows hardcoded Barclays account details (MOCK — not real)
- "Confirm & pay" → initPaymentSheet → presentPaymentSheet (Stripe) → navigates to ShipmentActive
- Weight & Volume Proof section exists but photo upload is a placeholder (no real implementation)

### ShipmentActiveScreen
**Status: Partially working**
- Shows animated confirmation ring
- Displays "Your shipment is confirmed" messaging
- "Track Shipment" button hardcodes `shipmentId: 'C0401'` — MOCK, should use actual shipment ID
- Auto-navigates to MainTabs after delay
- `shipmentId` param is optional but the Track button ignores it anyway

### SavedCardsScreen
**Status: Working**
- Lists saved cards from `saved_cards` table
- Set default / delete per card
- CardField from Stripe to add new card
- On save: creates Stripe PaymentMethod then inserts to `saved_cards`
- First card saved is automatically set as default

### ProfileScreen
**Status: Mostly working**
- Personal info: first_name, last_name, preferred_name, phone — editable with inline save
- Saved addresses: AddressBottomSheet for add/edit/delete/default
- Identity Verification: "Coming Soon" placeholder
- Payment Methods: shows card count, taps navigate to SavedCards screen
- Sign out button

---

## 6. Component Breakdown

### AddItemBottomSheet
- Parcel creation form
- Item name input with add/remove chips
- Category picker
- Sensitive type checkboxes (battery, liquid, branded)
- Declared value input
- Reference ID input
- Receipt photo upload → Supabase Storage `documents` bucket
- Submits to `parcels` table

### ActionBottomSheet
- Handles 4 action types: payment_required, document_required, customs_info, other
- `payment_required`: shows bank transfer details, text input for transaction reference
- `document_required`: file picker + upload to Supabase Storage
- `customs_info` / `other`: text input for response
- Submit updates action status to 'completed' and saves submitted_value
- Keyboard-aware (KeyboardAvoidingView + keyboard height listener)

### AddressBottomSheet
- Shows saved addresses with default indicator
- Set default / remove existing address
- Add new address form (line, city, country, postcode)
- Keyboard-aware
- Callback on address select

---

## 7. Authentication

**Flow:**
1. Supabase `onAuthStateChange` in AuthContext maintains session
2. Session persisted to AsyncStorage via custom storage adapter
3. Google: `GoogleSignin.signIn()` → SHA256 nonce → `supabase.auth.signInWithIdToken`
4. Phone/Email: `supabase.auth.signInWithOtp` → `supabase.auth.verifyOtp`
5. New user detection: session metadata `is_new_user` flag routes to ProfileSetup

**Known gaps:**
- Apple Sign-In is not implemented (button shows "Coming Soon")
- SMS OTP requires Supabase project to have an SMS provider (Twilio, etc.) configured — likely not set up
- No session refresh error handling visible

---

## 8. Payments

**Stripe integration:**
- `StripeProvider` wraps the entire app with publishable key + merchant identifier
- Card payments use `initPaymentSheet` + `presentPaymentSheet`
- Payment intent created via Supabase Edge Function `create-payment-intent` (not in this repo)
- Selected card's `stripe_payment_method_id` passed as `paymentMethodId` to `initPaymentSheet`
- Cards stored locally in `saved_cards` table (no Stripe Customer ID — just raw PM IDs)

**Bank transfer:**
- Account details (Barclays, sort 20-00-00, account 12345678, ref C0401-PAY) are HARDCODED MOCK DATA
- "I've made the payment" button in ActionBottomSheet submits a reference but no actual payment verification

**Gaps:**
- No Stripe Customer ID management — saving a card as a Stripe PM without attaching it to a customer means it cannot be reused server-side for future charges
- Bank transfer reference and account details need to be real
- No webhook handling visible (delivery confirmation of payment)

---

## 9. Real Data vs Mock Data

| Feature | Status |
|---------|--------|
| Shipment creation | Real |
| Parcel management | Real |
| Slot/route data | Real (with hardcoded fallback) |
| Delivery address | Real |
| Cost display | Real (admin sets values in DB) |
| Activity feed | Real |
| Pending actions | Real |
| Document upload/download | Real |
| Card payment | Real (Stripe) |
| Saved cards list | Real |
| Bank transfer account details | **MOCK** |
| Track Shipment button destination | **MOCK** (hardcoded C0401) |
| Weight & Volume Proof photos | **MOCK** (placeholder UI only) |
| Tools tab | **MOCK** (Coming Soon) |
| Identity Verification | **MOCK** (Coming Soon) |
| Apple Sign-In | **MOCK** (Coming Soon) |

---

## 10. Known Issues

### Critical (blocks functionality)
1. **Bank transfer details are fake** — Barclays account 12345678, sort 20-00-00, ref C0401-PAY. Real account details need to be inserted, ideally fetched from a config table or environment variable.
2. **Track Shipment hardcodes C0401** — ShipmentActiveScreen ignores the actual shipmentId param on the Track button. Fix: use `route.params?.shipmentId` instead.
3. **Stripe saved cards won't work server-side** — PaymentMethod IDs are saved without a Stripe Customer ID. The Edge Function `create-payment-intent` must attach PMs to customers for them to be usable. Architecture decision needed here.
4. **SMS OTP likely non-functional** — Supabase SMS provider needs to be configured or the phone login flow needs to be removed/replaced.

### Significant (degrades experience)
5. **EmailWaiting screen is unreachable** — registered in nav but PhoneEmailScreen always routes to Verification. Either use it or remove it.
6. **database.types.ts is stale** — missing: `saved_cards`, `documents` tables; missing columns: `weight`, `receipt_path`, `has_receipt` on parcels; `is_visible` on shipments. Using `any` types as workaround in several places.
7. **eas.json has placeholder values** — `ascAppId` and `appleTeamId` must be filled in before a production build can be submitted to App Store.
8. **Apple Sign-In not implemented** — button is present on WelcomeScreen but only shows an alert.

### Minor
9. **Weight & Volume Proof section in checkout is UI-only** — no photo capture or upload is wired up.
10. **ToolsScreen is empty** — shows "Coming Soon", no planned features specified.
11. **Identity Verification in Profile is stubbed** — no implementation.
12. **Android icon assets may be missing** — app.json references android-icon-foreground.png and android-icon-background.png; these were not confirmed to exist.
13. **No error handling on Google Sign-In cancellation** — if user cancels, a console error is logged but no user-facing feedback.
14. **Parcel delete shows confirmation but doesn't update parent state optimistically** — refreshes from DB after delete which causes a brief flicker.

---

## 11. What Is Left Before Launch

### Must-fix before any real users
- [ ] Replace hardcoded bank transfer details with real account
- [ ] Fix Track Shipment button to use actual shipment ID
- [ ] Decide on Stripe Customer ID strategy and update Edge Function accordingly
- [ ] Fill in `ascAppId` and `appleTeamId` in eas.json
- [ ] Either configure Supabase SMS provider or remove phone OTP login and go email-only
- [ ] Update database.types.ts with missing tables and columns (saved_cards, documents, weight, receipt_path, is_visible, etc.)
- [ ] Verify Supabase RLS policies are correct for all tables

### Should-fix before public launch
- [ ] Implement Apple Sign-In (or remove the button entirely)
- [ ] Wire up Weight & Volume Proof photo capture in checkout
- [ ] Implement Identity Verification or remove the section
- [ ] Remove or route to EmailWaiting screen — currently dead code
- [ ] Add error handling for network failures in all screens (currently most screens silently fail)
- [ ] Handle edge case: what if `create-payment-intent` Edge Function fails?
- [ ] Address management: no edit flow for existing addresses (only delete + re-add)

### Nice to have
- [ ] Tools tab — decide what goes here or remove the tab
- [ ] Push notifications for shipment status changes and new actions
- [ ] Android icon assets (foreground/background layers for adaptive icon)
- [ ] Proper loading states on ProfileScreen (currently just renders empty until data loads)
- [ ] Rate limiting or debounce on OTP resend
- [ ] Accessibility (no accessibilityLabel usage visible throughout)
- [ ] iPad layout (all screens are phone-only)

### Infrastructure (outside this codebase)
- [ ] Verify `create-payment-intent` Supabase Edge Function exists and handles paymentMethodId correctly
- [ ] Verify `documents` Storage bucket exists with correct permissions
- [ ] Verify Supabase email templates are customized (magic link email)
- [ ] Set up production Stripe webhook for payment confirmation
- [ ] Admin tooling — no internal dashboard; operator must use Supabase Table Editor directly
