# Circuit41 — Backend Breakdown
_Generated 2026-04-14. Based on full codebase read._

> **Note on schema accuracy:** This document infers column definitions from TypeScript types in `lib/database.types.ts` and from queries across all screens. The actual Supabase project may have additional columns, constraints, RLS policies, or triggers not visible from client code alone. Sections marked _(inferred)_ should be verified against the Supabase dashboard.

---

## 1. BACKEND ARCHITECTURE OVERVIEW

### What Supabase Provides

| Service | Used? | How |
|---------|-------|-----|
| **Auth** | Yes | Email magic links, SMS OTP, Google OAuth via `signInWithIdToken` |
| **PostgreSQL Database** | Yes | 10 tables (8 typed, 2 untyped) storing all app data |
| **Storage** | Yes | `documents` bucket for receipts, payment proofs, shipment documents |
| **Edge Functions** | Yes | `create-payment-intent` (Stripe integration) |
| **Realtime** | No | Not used anywhere in the current codebase |

### How the App Connects to Supabase

`lib/supabase.ts` creates a single shared client exported as `supabase`:

```
createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage   ← sessions persisted on device
    autoRefreshToken:   true           ← tokens refresh automatically
    persistSession:     true           ← session survives app restarts
    detectSessionInUrl: false          ← disabled (not a web app)
  }
})
```

The anon key is used for all requests. Row Level Security policies on each table restrict what data each user can see. The client is imported directly into every screen and component that needs data — there is no API layer or service abstraction between the UI and Supabase.

### External Services

**Google Sign-In**
- Library: `@react-native-google-signin/google-signin`
- Flow: Google SDK → ID token → Supabase `signInWithIdToken` (provider: 'google')
- Nonce: SHA256-hashed via `expo-crypto` before being passed to Google; raw nonce passed to Supabase for verification
- Config: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- Google project must have Supabase's callback URL whitelisted as an authorised redirect URI

**Stripe (Payments)**
- Library: `@stripe/stripe-react-native` v0.63.0
- `StripeProvider` wraps the whole app in `App.tsx` with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Client creates a PaymentIntent via Supabase Edge Function `create-payment-intent`
- Stripe payment sheet (`initPaymentSheet` + `presentPaymentSheet`) handles the UI
- Apple Pay: merchant identifier `merchant.com.circuit40s.circuit41` (requires Apple Pay entitlement)
- Google Pay: configured with `testEnv: true` (must switch to false for production)
- Saved cards: stored as raw Stripe PaymentMethod IDs in `saved_cards` table — **no Stripe Customer ID is currently stored**

**Resend (Email)**
- Supabase uses its configured SMTP provider for magic link emails
- The app never calls Resend directly; it calls `supabase.auth.signInWithOtp({ email })`
- Supabase project must have Resend (or another SMTP provider) configured in Auth → Email settings
- Email template for magic links must be customised in the Supabase dashboard

**Twilio/Vonage (SMS OTP)**
- The app calls `supabase.auth.signInWithOtp({ phone })` for phone login
- Supabase routes this to whatever SMS provider is configured in Auth → Phone settings
- **No SMS provider has been confirmed as configured.** Phone OTP is likely non-functional without this setup.
- The `VerificationScreen` uses `type: 'sms'` for phone verification

---

## 2. AUTHENTICATION ARCHITECTURE

### How AuthContext Works

`context/AuthContext.tsx` exports `AuthProvider` and `useAuth`. Every screen that needs the current user calls `useAuth()` to get `{ session, user, loading, signOut }`.

On mount, `AuthProvider`:
1. Calls `supabase.auth.getSession()` to restore any persisted session from AsyncStorage
2. Sets `loading = false` once the session check completes
3. Subscribes to `supabase.auth.onAuthStateChange` to react to sign-in, sign-out, and token refresh events
4. Cleans up the subscription when the provider unmounts

`RootNavigator` in `App.tsx` reads `loading` and `session`. While `loading` is true, it renders `LoadingScreen` (app icon + wordmark). Once loading is false, it renders either the auth flow (`Welcome` as initial route) or the main app (`MainTabs` as initial route) depending on whether `session` is set.

### Session Persistence with AsyncStorage

`@react-native-async-storage/async-storage` is passed as the `storage` adapter to the Supabase client. Supabase automatically reads and writes the session JWT to AsyncStorage under the key `supabase.auth.token`. This means sessions survive app restarts and background kills without re-authentication.

`autoRefreshToken: true` means Supabase automatically refreshes the JWT before it expires, as long as the refresh token is valid.

### Auth State Flow

```
App launch
  └─ AuthProvider mounts
       └─ supabase.auth.getSession()
            ├─ session found → setSession(session), setLoading(false)
            │     └─ RootNavigator renders → initialRoute = 'MainTabs'
            └─ no session → setSession(null), setLoading(false)
                  └─ RootNavigator renders → initialRoute = 'Welcome'
```

### Email OTP Flow

```
PhoneEmailScreen (email mode)
  └─ supabase.auth.signInWithOtp({ email, shouldCreateUser: true })
       └─ Supabase sends magic link email via configured SMTP
  └─ navigation.navigate('Verification', { contact: email })

VerificationScreen
  └─ user enters 6-digit code
  └─ supabase.auth.verifyOtp({ email: contact, type: 'email', token: code })
       ├─ success → session created
       │     └─ supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
       │           ├─ profile exists → navigation.reset → MainTabs (returning user)
       │           └─ no profile → navigation.navigate('ProfileSetup') (new user)
       └─ error → Alert, clear boxes, focus box 0
```

### Phone OTP Flow (same structure, different OTP type)

```
PhoneEmailScreen (phone mode)
  └─ supabase.auth.signInWithOtp({ phone: '+XX...' })
  └─ navigation.navigate('Verification', { contact: phone })

VerificationScreen
  └─ supabase.auth.verifyOtp({ phone: contact, type: 'sms', token: code })
       └─ (same new/returning user routing as above)
```

### Google Sign-In Flow with Nonce

```
WelcomeScreen → "Continue with Google"
  └─ GoogleSignin.hasPlayServices()
  └─ rawNonce = random 32-char alphanumeric string
  └─ hashedNonce = SHA256(rawNonce) via expo-crypto
  └─ GoogleSignin.signIn({ nonce: hashedNonce })
       └─ returns idToken
  └─ supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce })
       └─ Supabase verifies: SHA256(rawNonce) must equal the nonce embedded in the idToken
       └─ session created
  └─ supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle()
       ├─ profile found → navigation.reset → MainTabs
       └─ no profile → navigation.navigate('ProfileSetup')
```

The nonce prevents replay attacks. The raw nonce is sent to Supabase because Supabase hashes it internally to match the hashed nonce Google embedded in the ID token.

### New vs Returning User Detection

After every successful auth (OTP verify or Google sign-in), the app queries `profiles` for a row matching `id = auth.users.id`. If a row exists, the user is returning and goes straight to `MainTabs`. If no row exists, they are new and go to `ProfileSetup` which creates the profile via `upsert`.

### Sign Out Flow

```
ProfileScreen → "Sign out"
  └─ signOutFromGoogle() → GoogleSignin.signOut()   (clears Google session token)
  └─ signOut() from AuthContext → supabase.auth.signOut()  (clears Supabase session + AsyncStorage)
  └─ navigation.getParent().reset → Welcome screen
  └─ onAuthStateChange fires → session = null → loading = false
```

---

## 3. DATABASE SCHEMA — COMPLETE

> Column types are inferred from TypeScript types in `database.types.ts` and query usage. Nullable = `| null` in the type definition. Default values and constraints are inferred from code behaviour where possible. Verify against Supabase dashboard for exact DDL.

---

### `profiles`

**Purpose:** Stores display name and contact info for each authenticated user. One row per auth user, created at ProfileSetup.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key. References `auth.users.id` |
| first_name | text | No | Set at ProfileSetup |
| last_name | text | No | Set at ProfileSetup |
| preferred_name | text | Yes | Optional display name |
| email | text | Yes | Not stored directly — pulled from `auth.users` in the UI |
| phone | text | Yes | Editable in ProfileScreen |
| is_verified | boolean | Yes | Not in database.types.ts but queried in ProfileScreen |
| created_at | timestamptz | No | Auto-set |
| updated_at | timestamptz | No | Manually set on upsert |

**RLS policies** _(inferred)_: Users can only select/update their own row (`id = auth.uid()`). Insert allowed for new users.

**Triggers** _(likely)_: A trigger on `auth.users` insert may auto-create a profile row — or this is done manually via `upsert` in ProfileSetup. Currently done manually.

---

### `shipments`

**Purpose:** Core table. One row per shipment. Created when a user starts a new shipment in ShipmentWorkspaceScreen.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| user_id | uuid | No | References `auth.users.id` |
| status | text | No | See status enum below |
| slot_name | text | Yes | Name of the freight slot |
| slot_tag | text | Yes | Tag/label from slot |
| slot_rate | numeric | Yes | Rate per kg at time of booking |
| origin_country | text | Yes | |
| destination_country | text | Yes | |
| delivery_address | text | Yes | Confirmed delivery address |
| total_weight | numeric | Yes | Set by admin after weighing |
| total_cost | numeric | Yes | Set by admin |
| payment_method | text | Yes | 'card', 'apple_pay', 'google_pay', 'bank_transfer' |
| payment_status | text | No | Default likely 'unpaid'; set to 'paid' or 'pending' |
| carrier | text | Yes | Shipping carrier name |
| carrier_vessel | text | Yes | Vessel name |
| tracking_reference | text | Yes | Carrier-assigned tracking number |
| estimated_delivery | date | Yes | |
| origin_port_name | text | Yes | |
| destination_port_name | text | Yes | |
| out_for_delivery_note | text | Yes | Custom message from admin |
| warehouse_address | text | Yes | Address where parcels should be sent |
| received_at | timestamptz | Yes | Timestamp when status → received |
| origin_port_at | timestamptz | Yes | |
| in_transit_at | timestamptz | Yes | |
| destination_port_at | timestamptz | Yes | |
| out_for_delivery_at | timestamptz | Yes | |
| delivered_at | timestamptz | Yes | |
| is_visible | boolean | No | Soft-delete flag. Not in database.types.ts. Default: true |
| created_at | timestamptz | No | |
| updated_at | timestamptz | No | |

**Status enum values** (all statuses seen in code):
- `in_progress` — created, user adding parcels, not yet submitted
- `ready` — user clicked "Ready to ship" (not currently set by the app — checkout goes straight to received)
- `received` — payment submitted, operator has received/acknowledged
- `origin_port` — at departure port
- `in_transit` — on the vessel
- `destination_port` — arrived at destination port
- `out_for_delivery` — with local courier
- `delivered` — delivered to recipient
- `completed` — administrative closure (referenced in code)
- `cancelled` — cancelled shipment

**RLS policies** _(inferred)_: Users can select/insert/update their own shipments (`user_id = auth.uid()`). Admins likely have broader access via service role key.

---

### `parcels`

**Purpose:** Items declared within a shipment. One shipment can have many parcels.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| shipment_id | uuid | No | References `shipments.id` |
| user_id | uuid | No | References `auth.users.id` |
| item_names | text[] | No | Array of item names declared in the parcel |
| tracking_id | text | Yes | External carrier tracking ID (user-supplied) |
| reference_id | text | Yes | Auto-generated if no tracking_id (format: REF-XXXXX) |
| declared_value | numeric | Yes | User-declared value in GBP |
| category | text | No | 'general' or 'sensitive' |
| sensitive_types | text[] | No | Array of sensitive type flags (e.g. 'Battery', 'F-Brand') |
| status | text | No | See status enum below |
| weight | numeric | Yes | Set by admin after weighing. Not in database.types.ts. |
| receipt_path | text | Yes | Storage path in documents bucket. Not in database.types.ts. |
| has_receipt | boolean | No | Not in database.types.ts. Default: false |
| created_at | timestamptz | No | |
| updated_at | timestamptz | No | |

**Parcel status enum values**:
- `in_transit` — default when created
- `arrived` — parcel arrived at warehouse
- `held` — held by operator/customs
- `returned` — returned to sender

**RLS policies** _(inferred)_: Users can select/insert their own parcels. Delete not directly exposed in UI.

---

### `slots`

**Purpose:** Freight slots available for booking. Managed by admin. Read-only from the user's perspective.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| name | text | No | Display name e.g. "March 2025 Shipment" |
| tag | text | Yes | Label e.g. "Recommended", "Express" |
| origin_country | text | No | |
| destination_country | text | No | |
| general_rate | numeric | No | £/kg for general goods |
| battery_rate | numeric | Yes | £/kg for battery items |
| branded_rate | numeric | Yes | £/kg for branded goods |
| liquid_rate | numeric | Yes | £/kg for liquid/fragile |
| warehouse_address | text | Yes | Address users ship their parcels to |
| is_active | boolean | No | Only active slots are shown to users |
| estimated_duration | text | Yes | e.g. "4–6 weeks". Not in database.types.ts |
| created_at | timestamptz | No | |

**RLS policies** _(inferred)_: Public read access for `is_active = true`. Admin write access.

---

### `actions`

**Purpose:** Tasks or requests from the admin that require the user to respond. E.g. upload a document, confirm details, provide an address.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| shipment_id | uuid | No | References `shipments.id` |
| user_id | uuid | No | References `auth.users.id` |
| title | text | No | Short description e.g. "Upload customs form" |
| description | text | Yes | Longer explanation |
| action_type | text | No | See action type enum below |
| due_date | date | Yes | Optional deadline |
| status | text | No | 'pending' or 'submitted' |
| submitted_value | text | Yes | User's response (address text, filename, 'yes'/'no'). Not in database.types.ts. |
| created_at | timestamptz | No | |
| updated_at | timestamptz | No | |

**Action type enum values** (from code):
- `address` — user needs to provide a delivery address
- `confirm` — user needs to confirm shipment details
- `document` — user needs to upload a document
- `default` — generic text response

**RLS policies** _(inferred)_: Users can read their own actions, update `status` and `submitted_value`. Admin creates and manages all actions.

---

### `activity`

**Purpose:** Notification/event log shown to users. Created by admin or automated triggers. Table name is `activity` (not `activities`).

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| user_id | uuid | No | References `auth.users.id` |
| shipment_id | uuid | Yes | References `shipments.id` (null for account-level events) |
| message | text | No | Human-readable event description |
| type | text | No | e.g. 'info', 'alert', 'warning' — alert/warning get red styling |
| is_read | boolean | No | Default: false. Set to true when user views |
| created_at | timestamptz | No | |

**RLS policies** _(inferred)_: Users can read their own activity rows and update `is_read`. Admin inserts rows.

---

### `documents`

**Purpose:** File attachments linked to a shipment. Stored in Supabase Storage; this table holds metadata. **Not in database.types.ts.**

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| shipment_id | uuid | No | References `shipments.id` |
| user_id | uuid | No | References `auth.users.id` |
| name | text | No | Sanitised filename |
| file_path | text | No | Path in the `documents` Storage bucket |
| file_type | text | Yes | MIME type e.g. 'image/jpeg', 'application/pdf' |
| uploaded_by | text | No | 'user' or 'admin' |
| created_at | timestamptz | No | |

**RLS policies** _(inferred)_: Users can read documents where `shipment_id` belongs to them or `uploaded_by = 'admin'`. Users can insert their own documents.

---

### `saved_addresses`

**Purpose:** Delivery addresses saved by users for reuse at checkout.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| user_id | uuid | No | References `auth.users.id` |
| address_line | text | No | Street address |
| city | text | Yes | |
| country | text | Yes | |
| postcode | text | Yes | |
| is_default | boolean | No | One address per user should have this true |
| created_at | timestamptz | No | |

**RLS policies** _(inferred)_: Users can fully manage their own rows. No cross-user access.

---

### `saved_cards`

**Purpose:** Saved Stripe PaymentMethod IDs for reuse at checkout. **Not in database.types.ts.** Schema entirely inferred from insert/select queries.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | No | Primary key |
| user_id | uuid | No | References `auth.users.id` |
| stripe_payment_method_id | text | No | Raw Stripe PM ID e.g. `pm_xxxxx` |
| card_brand | text | No | e.g. 'visa', 'mastercard' |
| card_last4 | text | No | Last 4 digits |
| card_exp_month | integer | No | |
| card_exp_year | integer | No | |
| is_default | boolean | No | One card per user should have this true |

**Important limitation:** No Stripe Customer ID is stored. PaymentMethod IDs without an associated Customer cannot be reattached for future server-side charges. This is a known architectural gap.

**RLS policies** _(inferred)_: Users can fully manage their own rows.

---

### `shipment_events`

**Purpose:** Referenced by the user's request to document but **not found in any query or TypeScript type in the codebase**. This table may exist in the Supabase project for admin use, or may have been planned but not yet connected to the client. No queries against this table were found.

---

## 4. TABLE RELATIONSHIPS

```
auth.users (1) ──────────────→ (1)    profiles
auth.users (1) ──────────────→ (many) shipments
auth.users (1) ──────────────→ (many) parcels
auth.users (1) ──────────────→ (many) activity
auth.users (1) ──────────────→ (many) actions
auth.users (1) ──────────────→ (many) saved_addresses
auth.users (1) ──────────────→ (many) saved_cards
auth.users (1) ──────────────→ (many) documents

shipments (1) ────────────────→ (many) parcels
shipments (1) ────────────────→ (many) activity
shipments (1) ────────────────→ (many) actions
shipments (1) ────────────────→ (many) documents

slots (1) ────────────────────→ (many) shipments
  (no FK enforced in client — slot data is copied into shipment at creation time)
```

**Notes on relationship design:**
- When a shipment is created, `slot_name`, `slot_tag`, `slot_rate`, and `warehouse_address` are **copied** from the slot into the shipment row. There is no live FK from shipments to slots. This means changing a slot's rate won't affect existing shipments.
- Parcels have both a `shipment_id` and a `user_id`. The `user_id` is redundant given the shipment relationship, but allows direct RLS queries without a join.
- `activity.shipment_id` is nullable (account-level events don't relate to a shipment).

---

## 5. STORAGE BUCKETS

### Bucket: `documents`

**Purpose:** All user-uploaded and admin-uploaded files associated with shipments and parcels.

**What is stored:**
- Parcel purchase receipts (uploaded via AddItemBottomSheet)
- Shipment documents (uploaded via ShipmentDetailScreen Documents tab)
- Payment proofs for bank transfers (uploaded via ShipmentCheckoutScreen)
- Documents submitted for actions (uploaded via ActionBottomSheet)

**File naming / folder structure** (from code):

| File type | Path pattern |
|-----------|-------------|
| Parcel receipt | `receipts/{timestamp}_{sanitised_filename}` |
| Shipment document | `{user_id}/{shipment_id}/{timestamp}_{sanitised_filename}` |
| Payment proof | `{user_id}/{timestamp}_{sanitised_filename}` |
| Action document | `{user_id}/{shipment_id}/{timestamp}_{sanitised_filename}` |

**File name sanitisation:** All names run through `name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').toLowerCase()` before upload.

**Upload method:** Files are read to Base64 via `expo-file-system`, converted to `Uint8Array`, and uploaded as binary with `upsert: true`. This means re-uploading the same path will overwrite silently.

**Download method:** `supabase.storage.from('documents').createSignedUrl(filePath, 3600)` — generates a 1-hour signed URL, then `expo-file-system.downloadAsync` downloads it locally, then `expo-sharing` opens the share sheet.

**RLS policies** _(inferred)_: Users can read/write files under their own `user_id` prefix. Admin (service role) can access all files.

---

## 6. EDGE FUNCTIONS

### `create-payment-intent`

**Location:** Supabase project → Edge Functions (code not in this repo)

**What it does:** Creates a Stripe PaymentIntent server-side and returns the `clientSecret` to the app. This is required because the Stripe secret key must never be exposed client-side.

**Called from:** `ShipmentCheckoutScreen.handleConfirmAndPay()` — only when payment method is card, Apple Pay, or Google Pay (not bank transfer).

**Invocation:**
```typescript
supabase.functions.invoke('create-payment-intent', {
  body: {
    amount:     shipment.total_cost,   // numeric, GBP amount
    currency:   'gbp',
    shipmentId: shipmentId,            // uuid string
  }
})
```

**Expected response:**
```json
{
  "clientSecret": "pi_xxxxx_secret_xxxxx"
}
```
On error, the function is expected to return `{ "error": "message string" }`.

**Environment variables the function needs** (must be set in Supabase Edge Function secrets):
- `STRIPE_SECRET_KEY` — Stripe live or test secret key
- Optionally: `STRIPE_WEBHOOK_SECRET` if webhooks are configured

**What the client does with it:**
```typescript
initPaymentSheet({
  paymentIntentClientSecret: data.clientSecret,
  paymentMethodId:           selectedCardId || undefined,
  merchantDisplayName:       'Circuit 40s',
  applePay:  { merchantCountryCode: 'GB' },
  googlePay: { merchantCountryCode: 'GB', testEnv: true },
  returnURL: 'circuit41://stripe-redirect',
})
→ presentPaymentSheet()
→ on success: update shipment status to 'received', payment_status to 'paid'
```

**Known gap:** The `paymentMethodId` (saved card) is passed to `initPaymentSheet`, but the Edge Function does not receive it. For a saved card to be charged server-side, the Edge Function would need to receive both the Stripe Customer ID and the PaymentMethod ID. Currently no Customer ID is stored, so card reuse server-side is not functional.

---

## 7. REALTIME SUBSCRIPTIONS

**Realtime is not used anywhere in the current codebase.**

No screen calls `supabase.channel()`, `.on('postgres_changes', ...)`, or `.subscribe()`. All data fetching is done via:

- `useEffect` on mount (one-time fetch)
- `useFocusEffect` with 30-second staleness check (re-fetches when screen is focused, at most once per 30 seconds)
- Manual refresh after mutations (call `fetchX()` after an insert/update/delete)

This means shipment status updates, new activity items, and new actions are **not pushed to the app in real-time**. The user sees stale data until they navigate away and back to a screen.

**Consequence:** If an admin updates a shipment status, the user won't see it until they leave and return to the relevant screen (triggering the 30-second staleness check). For production, adding realtime subscriptions on `shipments` and `activity` tables for the Dashboard and ShipmentDetail screens would significantly improve the experience.

---

## 8. SUPABASE QUERIES BY SCREEN

### WelcomeScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `profiles` | SELECT `id` | `id = auth.uid()` | Check if new or returning user after Google sign-in |

### PhoneEmailScreen
| Service | Operation | Notes |
|---------|-----------|-------|
| `auth` | `signInWithOtp({ phone })` | Sends SMS OTP |
| `auth` | `signInWithOtp({ email })` | Sends email magic link |

### VerificationScreen
| Service/Table | Operation | Filters | Purpose |
|---------------|-----------|---------|---------|
| `auth` | `verifyOtp({ phone/email, token })` | — | Verify 6-digit code |
| `profiles` | SELECT `id` | `id = auth.uid()` | Detect new vs returning user |
| `auth` | `signInWithOtp` (resend) | — | Resend code on request |

### EmailWaitingScreen
| Service | Operation | Notes |
|---------|-----------|-------|
| `auth` | `signInWithOtp({ email })` | Resend magic link email |

### ProfileSetupScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `auth` | `getUser()` | — | Get current user id |
| `profiles` | UPSERT | `id = auth.uid()` | Create/update profile with name fields |

### DashboardScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `shipments` | SELECT `*` | `user_id = auth.uid()`, `is_visible = true`, `status NOT IN ('delivered','cancelled')`, limit 2, order `updated_at DESC` | Up to 2 active shipment cards |
| `activity` | SELECT `*` | `user_id = auth.uid()`, limit 20, order `created_at DESC` | Recent activity feed |

### ShipmentsScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `shipments` | SELECT `*` | `user_id`, `is_visible = true`, `status IN ('received','origin_port','in_transit','destination_port','out_for_delivery')` | Active shipments tab |
| `shipments` | SELECT `*, parcels(id)` | `user_id`, `is_visible = true`, `status = 'in_progress'` | In-progress section |
| `shipments` | SELECT `*` | `user_id`, `is_visible = true`, `status = 'delivered'` | Completed tab |

### ActionsScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `actions` | SELECT `*, shipments(id, origin_country, destination_country, status)` | `user_id`, `status = 'pending'`, order `created_at DESC` | Pending actions list |
| `actions` | UPDATE `{ status: 'submitted' }` | `id = actionId` | Mark action complete (from ActionsScreen handler) |

### ActivityScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `activity` | SELECT `*` | `user_id`, limit 50, order `created_at DESC` | Full activity list |
| `activity` | UPDATE `{ is_read: true }` | `id = item.id` | Mark item read on tap |

### ShippingRouteScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `slots` | SELECT `origin_country, destination_country` | `is_active = true` | Populate origin/destination pickers |

### SlotSelectionScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `slots` | SELECT `*, estimated_duration` | `origin_country`, `destination_country`, `is_active = true`, order `general_rate DESC` | Available slots for chosen route |

### ShipmentWorkspaceScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `shipments` | INSERT | — | Create new shipment on screen mount |
| `shipments` | SELECT `*, parcels(*)` | `id = shipmentId` | Load existing shipment (when opened from Shipments tab) |
| `shipments` | UPDATE `{ is_visible: false }` | `id = shipmentId` | Soft-delete (cancel) shipment |
| `parcels` | SELECT `*` | `shipment_id`, order `created_at ASC` | Refresh parcel list on focus |
| `parcels` | INSERT | — | Add a new parcel |

### ShipmentDetailScreen
| Table/Service | Operation | Filters | Purpose |
|---------------|-----------|---------|---------|
| `shipments` | SELECT `*, parcels(*)` | `id = shipmentId` | Load shipment + parcels |
| `activity` | SELECT `*` | `shipment_id`, order `created_at DESC` | Events tab activity |
| `actions` | SELECT `*` | `shipment_id`, order `created_at DESC` | Events tab actions |
| `documents` | SELECT `*` | `shipment_id`, order `created_at DESC` | Documents tab |
| `storage.documents` | UPLOAD | path: `{userId}/{shipmentId}/{ts}_{name}` | Upload document |
| `documents` | INSERT | — | Insert document metadata row |
| `storage.documents` | createSignedUrl | `filePath`, TTL 3600s | Generate download link |
| `actions` | UPDATE `{ status: 'submitted' }` | `id = actionId` | Submit action from Events tab |

### ShipmentCheckoutScreen
| Table/Service | Operation | Filters | Purpose |
|---------------|-----------|---------|---------|
| `saved_addresses` | SELECT `*` | `user_id`, order `is_default DESC` | Populate address picker |
| `saved_cards` | SELECT `*` | `user_id`, order `is_default DESC` | Show saved cards for card payment |
| `shipments` | SELECT `*` | `id = shipmentId` | Load cost data (weight, rate, total) |
| `shipments` | SELECT `total_cost` | `id = shipmentId` | Get amount for Stripe intent |
| `saved_addresses` | INSERT | — | Save new address entered at checkout |
| `storage.documents` | UPLOAD | path: `{userId}/{ts}_{name}` | Upload payment proof (bank transfer) |
| `functions` | INVOKE `create-payment-intent` | `{ amount, currency, shipmentId }` | Create Stripe PaymentIntent |
| `shipments` | UPDATE `{ delivery_address, payment_method, payment_status, status: 'received' }` | `id = shipmentId` | Update after successful payment |

### ShipmentActiveScreen
No Supabase queries. Navigation screen only.

### SavedCardsScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `saved_cards` | SELECT `*` | `user_id`, order `is_default DESC` | List saved cards |
| `saved_cards` | UPDATE `{ is_default: false }` | `user_id` | Clear all defaults before setting new one |
| `saved_cards` | UPDATE `{ is_default: true }` | `id = cardId` | Set a card as default |
| `saved_cards` | DELETE | `id = cardId` | Remove a card |
| `saved_cards` | INSERT | — | Save new card after Stripe `createPaymentMethod` |

### ProfileScreen
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `profiles` | SELECT `first_name, last_name, preferred_name, phone, is_verified` | `id = auth.uid()` | Load profile data |
| `saved_addresses` | SELECT `*` | `user_id`, order `is_default DESC` | Show saved addresses |
| `saved_cards` | SELECT `id` | `user_id` | Count saved cards |
| `profiles` | UPDATE `{ phone }` | `id = auth.uid()` | Save edited phone number |
| `saved_addresses` | INSERT | — | Add new address |

### navigationHelper.ts (shared utility)
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `shipments` | SELECT `id, status, slot_name, slot_tag, slot_rate` | `id = shipmentId` | Determine routing: in_progress → Workspace, else → Detail |

### AddressBottomSheet (component)
| Table | Operation | Filters | Purpose |
|-------|-----------|---------|---------|
| `saved_addresses` | UPDATE `{ is_default: false }` | `user_id` | Clear defaults before setting new one |
| `saved_addresses` | UPDATE `{ is_default: true }` | `id = addr.id` | Set address as default |
| `saved_addresses` | DELETE | `id = addr.id` | Remove address |

### ActionBottomSheet (component)
| Table/Service | Operation | Filters | Purpose |
|---------------|-----------|---------|---------|
| `storage.documents` | UPLOAD | path: `{userId}/{shipmentId}/{ts}_{name}` | Upload document for 'document' action type |
| `documents` | INSERT | — | Insert document metadata |
| `actions` | UPDATE `{ status: 'submitted', submitted_value }` | `id = actionId` | Submit the action |
| `shipments` | UPDATE `{ delivery_address }` | `id = shipmentId` | Update address for 'address' action type |

### AddItemBottomSheet (component)
| Service | Operation | Filters | Purpose |
|---------|-----------|---------|---------|
| `storage.documents` | UPLOAD | path: `receipts/{ts}_{name}` | Upload parcel purchase receipt |

---

## 9. ENVIRONMENT VARIABLES

All variables are prefixed `EXPO_PUBLIC_` which means they are **embedded in the compiled app bundle** and visible to anyone who unpacks it. This is acceptable for publishable keys and URLs, but is worth noting.

| Variable | Connects To | Used In |
|----------|-------------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | `lib/supabase.ts` — `createClient()` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `lib/supabase.ts` — `createClient()` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud OAuth client (web) | `lib/googleAuth.ts` — `GoogleSignin.configure()` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Cloud OAuth client (iOS) | `lib/googleAuth.ts` — `GoogleSignin.configure()` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `App.tsx` — `<StripeProvider publishableKey={...} />` |

**Edge Function secrets (set in Supabase dashboard, NOT in .env):**

| Variable | Used By | Notes |
|----------|---------|-------|
| `STRIPE_SECRET_KEY` | `create-payment-intent` Edge Function | Never exposed to client |
| `STRIPE_WEBHOOK_SECRET` | Webhook handler (if configured) | For verifying webhook signatures |

---

## 10. KNOWN BACKEND ISSUES

### Critical — blocks real-money transactions

**1. No Stripe Customer ID stored**
Saved card PaymentMethod IDs are stored in `saved_cards` without an associated Stripe Customer ID. Without a Customer, the `create-payment-intent` Edge Function cannot attach the PaymentMethod to the intent for a server-side charge. The `paymentMethodId` is passed to `initPaymentSheet` client-side, which works for the initial payment, but the card cannot be reused for future server-initiated charges (e.g. additional fees). Fix: create a Stripe Customer on first payment and store the Customer ID in the `profiles` table.

**2. Bank transfer account details are hardcoded mock data**
`ShipmentCheckoutScreen` has `const BANK_DETAILS = { bankName: 'Barclays Bank', accountNumber: '12345678', sortCode: '20-00-00', reference: 'C0401-PAY' }` hard-coded in the file. Real bank details need to be loaded from a config table or environment variable. The reference should be dynamic per shipment.

**3. `create-payment-intent` Edge Function not in this repo**
The function must exist in the Supabase project. If it doesn't or has the wrong signature, all card payments will fail silently with `fnError`.

**4. SMS OTP not confirmed working**
`supabase.auth.signInWithOtp({ phone })` requires a Supabase SMS provider (Twilio or Vonage) to be configured under Auth → Providers → Phone in the Supabase dashboard. This has not been confirmed as set up.

### Significant — causes data integrity or UX problems

**5. `database.types.ts` is stale**
Three columns used extensively in queries are missing from `database.types.ts`:
- `shipments.is_visible` (soft-delete flag)
- `parcels.weight`, `parcels.receipt_path`, `parcels.has_receipt`
- `actions.submitted_value`
Missing tables: `saved_cards`, `documents`
This forces the use of `any` types in several screens, bypassing TypeScript safety.

**6. No RLS policy verification**
RLS policies are inferred from expected behaviour. If the actual policies are misconfigured, users could read each other's shipments, cards, or addresses. The anon key is embedded in the app bundle, so RLS is the only data security boundary.

**7. `documents` Storage bucket permissions not verified**
If the bucket is set to public, any file URL is accessible without authentication. If it's private, signed URLs (1-hour TTL) are used correctly — but the public/private setting needs verification.

**8. Payment proof upload path collision**
Payment proof files are uploaded to `{userId}/{timestamp}_{filename}` in the `documents` bucket — the same bucket used for shipment documents. There is no `shipment_id` in the path, so payment proofs cannot be associated back to a specific shipment from Storage alone. The `documents` table is not updated when a payment proof is uploaded (only Storage is written).

**9. Shipment `ready` status is unused**
The UI button says "Ready to ship →" but clicking it navigates to ShipmentCheckout and only sets status to `received` after payment — the `ready` status is never set. This may cause confusion if admin tooling uses `ready` as a processing state.

### Minor — technical debt

**10. Track Shipment button hardcodes `shipmentId: 'C0401'`**
In `ShipmentActiveScreen`, the "Track Shipment" button navigates to `ShipmentDetail` with a hardcoded shipment ID `'C0401'`. The actual `shipmentId` is available as `route.params?.shipmentId` but is not used.

**11. `EmailWaiting` screen is unreachable**
Registered in the navigation stack but `PhoneEmailScreen` never navigates to it. Either wire it into the email OTP flow or remove it.

**12. No optimistic updates**
After every mutation (insert, update, delete), the app re-fetches from Supabase. There are no optimistic UI updates. This causes brief loading states or flickers after actions. Acceptable for now but noticeable on slow connections.

**13. `supabase.storage.upload` uses `upsert: true` everywhere**
Re-uploading to the same path silently overwrites the existing file. For receipts this is probably fine, but for shipment documents it could accidentally overwrite a legitimate file if two uploads happen to generate the same timestamp prefix.

**14. `navigateToShipment` makes a DB round-trip on every navigation**
Every time a user taps a shipment card (on Dashboard, Shipments, or Activity), `navigationHelper.ts` queries the `shipments` table to check status before routing. For screens that already have the shipment's status in state (like ShipmentsScreen), this is an unnecessary extra query. The status could be passed directly.

**15. `shipment_events` table not connected**
The table was listed as a documentation target but no queries against it exist anywhere in the client code. If this table exists in Supabase, it is not used by the app.
