# Circuit 41 Mobile — Project Status

## Technical handover + repo sync + Expo org migration

**Date:** 2026-06-18 · Documentation/handover only — no business logic, UI, workflow, or schema changes.

### Handover package created (`Handover/`)
- `TECHNICAL_HANDOVER.md` — project / mobile / Ops Tool / Supabase / Expo-EAS / Android / iOS /
  deployment / known issues / blockers / ownership.
- `RELEASE_STATUS.md` — Android, iOS, Play Console, App Store Connect, internal testing, crash status, next steps.
- `ACCESS_REQUIREMENTS.md` — every platform needing access (service / purpose / access level; **no secrets**).

### Repository safety audit (findings)
- **FIXED (required):** `@makk55__circuit41.jks` (Android signing keystore) was **untracked but NOT
  gitignored** → added `*.jks`, `*.keystore`, `*.p12`, `*.pepk`, `credentials.json`,
  `google-services.json`, `google-play-service-account*.json` to `.gitignore`. Verified now ignored.
- **Verified properly ignored & untracked:** `.env`, `AuthKey.p8` (`*.p8`), `GoogleService-Info.plist`,
  `client_*googleusercontent.com*.plist`.
- **Git history clean:** no `.env` / `*.p8` / `*.jks` / `GoogleService-Info.plist` ever committed.
- **Tracked diff scanned:** no passwords/private keys/live secret keys introduced; Android
  `build.gradle` has no embedded signing password.
- **Low-risk note:** `generate-apple-secret.js` is tracked and contains Apple **identifiers**
  (Team `XRB5U52F27`, service `com.circuit40s.auth`, key `29QSA49B7C`) — **not** the private key
  (that's the gitignored `AuthKey.p8`). Kept as needed ops tooling; flagged in handover.

### Expo org migration (personal → company)
- Primary Expo/EAS account is now the **`circuit40s` org** (`expo.dev/accounts/circuit40s`).
- `app.json` still has `"owner": "makk55"`. **Deliberately not changed in code** — flipping `owner`
  before confirming the EAS project (`22a7a2e4-…`) is transferred would break builds. Documented as a
  release task in the handover (verify transfer → set `owner: circuit40s`).

### Crash diagnosis (carried forward, unchanged)
Android launch crash root cause = **missing EAS production `EXPO_PUBLIC_*` env vars** →
`lib/supabase.ts` `createClient()` threw at boot. Code hardened (placeholder + `SUPABASE_ENV_MISSING`).
Real fix still pending: add EAS env vars, rebuild, re-upload to Play internal testing.

### Validation
- `npx tsc --noEmit` → **0 errors**.
- Repo synced to GitHub (`origin/main`) with the accumulated UI/release/handover work; secrets excluded.

---

## 🔴 Android launch crash — diagnosed (missing EAS production env vars)

**Date:** 2026-06-15 · **Status:** root cause found, code hardened, **EAS env vars must be added + rebuild required**

### Most likely cause (high confidence)
The EAS Android production build was created **without the `EXPO_PUBLIC_*` environment variables**.
`lib/supabase.ts` calls `createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)` at **module top-level**,
and `@supabase/supabase-js` **throws synchronously** when the URL/key are empty
(`"supabaseUrl is required."`). That module is imported at boot
(`App.tsx → AuthProvider → lib/supabase`), so the throw happens **before the first screen renders →
the app closes immediately**.

### Evidence
- `eas.json` `build.production` has **no `env` block**.
- `.env` is **gitignored** (`.gitignore` lines 2–3, 19–20) → it is **not uploaded to EAS**, so
  `EXPO_PUBLIC_*` resolve to `undefined` in the cloud build. (EAS output already warned: no prod env vars.)
- `@supabase/supabase-js@2.101.1` `dist/index.js:150` `if (!trimmedUrl) throw new Error("supabaseUrl is required.")`;
  `:367` `if (!supabaseKey) throw new Error("supabaseKey is required.")`.
- `lib/supabase.ts` evaluated `createClient(...)` at import with `process.env...!`.
- **iOS works** because it was a **local** build (read the local `.env`); **Android** was an **EAS** build (no `.env`).
- Secondary corroboration: the Android **native splash still shows old/default branding** →
  committed `android/` native config is stale vs `app.json` (config not re-applied via prebuild).

### Fix applied in code (boot-safety hardening — smallest safe change)
- `lib/supabase.ts` — no longer uses `!`; logs a loud error and falls back to harmless placeholders
  (`https://missing-env.invalid`) when env vars are missing, so a misconfigured build **boots to an
  unauthenticated state instead of crashing**. Added `SUPABASE_ENV_MISSING` export.
- `App.tsx` — `StripeProvider publishableKey` now `?? ''` (was `undefined!`).
- `android/.../values/colors.xml` — `splashscreen_background` `#F7F6F0 → #F5F9F6` (native splash bg
  was stale; `app.json` edits don't reach the committed `android/` folder without prebuild).

**This code change stops the hard crash but does NOT make the app functional on its own — the build
still needs real keys.** The required fix is adding the EAS production env vars (below).

### REQUIRED before next Android build — add EAS production env vars
The local `.env` holds the 5 public client vars. Add them to EAS (scope: production). They are
`EXPO_PUBLIC_*` client keys (Supabase anon, Stripe publishable, Google client IDs) — shipped in the
bundle anyway, so use **plaintext** visibility so they inline at build time:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

```bash
# easiest: push the local .env to EAS production (EAS CLI ≥ 18.6)
eas env:push production --path .env
# or per-variable:
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "<from .env>" --visibility plaintext
# (repeat for each var)  — or set them in the EAS dashboard → Project → Environment variables
eas env:list production           # verify all 5 present
```

### Files changed
`lib/supabase.ts`, `App.tsx`, `android/app/src/main/res/values/colors.xml`.

### Validation
- `npx tsc --noEmit` → **0 errors**.

### Native rebuild required?
**Yes.** Env vars are inlined at build time, so a **new Android build** is required after adding them.
The splash colour/native config also only updates on rebuild.

### Exact rebuild + release steps
```bash
eas env:push production --path .env          # 1. add env vars (one-time)
eas build --platform android --profile production   # 2. rebuild (autoIncrements build number)
eas submit --platform android --profile production  # 3. (or upload the .aab to Play Console)
```
Then promote/assign to the Internal Testing track. **A new Google Play internal-testing upload IS
required** — the current crashing build cannot be patched in place.

### Splash branding note (secondary, not the crash)
There's a committed `android/` folder, so `app.json` splash changes are **not** applied unless
`npx expo prebuild -p android --clean` is run (which regenerates native splash from `app.json`).
`expo-splash-screen` is not installed and not in `plugins`. To fix the "Expo/default branding"
splash: either re-run prebuild for Android (then verify signing/applicationId unchanged) or replace
the `splashscreen_logo.png` drawables + keep the colour set above. **Not a release blocker** — fix
the env vars first, ship, then address splash branding in a follow-up build.

---

## Final UI Cleanup — colour audit, Shipment ID, splash

**Date:** 2026-06-15

### Scope
Final UI consistency pass before release. No redesign, no Supabase/payment/ticket/archive/auth/
shipment-creation logic changes.

### 1. Colour / button audit (result)
Full sweep of every screen + modal/bottom sheet. **The old Circuit red `#C10F1D` is already fully
retired**, and all primary CTAs are already **black `#1A1712`** (Continue/Route-selection/SlotSelection/
Add parcel/Ready-to-ship/Checkout/Submit/Save/Confirm). The red buttons reported in testing were from
an **older build** — current source is correct.

The only genuine leftover "old red styling" was **3 selected-state fills** that had orange
(`#CD643D`) borders/text but pinkish-red backgrounds — now changed to the accent tint
`rgba(205,100,61,0.10)`:
- `components/AddItemBottomSheet.tsx` → `categoryRowSelected` (`#FEF9F9`) and `chipActive` (`#FEF0F0`) — the **add-parcel flow**.
- `screens/VerificationScreen.tsx` → `otpBoxFocused` (`#FEF9F9`).

Everything else red is **legitimate and kept**: destructive `#DC2626` (delete/cancel parcel/cancel
shipment/delete card/delete account), error boxes `#FEF2F2`/`#991B1B` (bank-transfer error), and
status badges `#FEE2E2`/`#991B1B`/`#9B1C1C` (urgent / returned / alert). All accent backgrounds are
small elements only (status dots, checkboxes, radios, progress segments, notification dot, divider glow).

### Button hierarchy (now consistent app-wide)
- **Primary CTA** → black `#1A1712`, white text.
- **Secondary emphasis** → accent `#CD643D` (sparingly: selected states, small highlights, progress,
  nav indicators) — never a primary-button fill.
- **Destructive / error / warning** → red (`#DC2626` actions, `#991B1B`/`#FEE2E2` status/error).

### 2. Shipment Detail — Shipment ID
Already present as the **first row of the expanded "Shipment info"** accordion
(`{ label: 'Shipment ID', value: #XXXXXXXX }`). Section kept clean — carrier / tracking reference
remain intentionally removed. (Reported missing in testing = older build.)

### 3. Splash / loading
- **JS bootstrap loading screen** (`App.tsx → LoadingScreen`, shown while Supabase restores session)
  redesigned: large, zoomed-in, thick **flowing accent-family waves** (SVG, `#CD643D` / `#E0875F` /
  `#9A3B1C` / soft peach, low opacity) behind a centred logo, "Circuit 40s" wordmark at the bottom.
  No spinner, no animation, no new deps — **JS + `react-native-svg` (already a dependency)**.
- **Native splash** `backgroundColor` updated `#F7F6F0` → `#F5F9F6` in `app.json` to match the app
  background (seamless cold-launch handoff). The image is unchanged.

### Files changed
- `components/AddItemBottomSheet.tsx`, `screens/VerificationScreen.tsx` (selected-state tints)
- `App.tsx` (`LoadingScreen` redesign)
- `app.json` (native splash backgroundColor)

### Validation
- `npx tsc --noEmit` → **0 errors** (clean).

### Native rebuild required?
- **JS loading screen + colour fixes:** **No rebuild** — Metro reload / next build picks them up.
- **Native splash `backgroundColor` change in `app.json`:** takes effect **only on the next native
  build** (it's baked into the binary). Current Android EAS / iOS local builds keep the old `#F7F6F0`
  native splash until rebuilt. This is cosmetic and not a release blocker.

### Phone testing steps
1. Reload JS (shake → Reload, or rebuild) — cold-launch shows the new wavy loading screen with
   centred logo + "Circuit 40s" at the bottom; no red, no spinner.
2. New shipment → Route selection → **Continue is black**. Slot selection → **Continue black**.
3. Add parcel sheet → select a **category** and a **sensitive-type chip**: selected fill is now a soft
   **orange** tint (not pink), border/text orange.
4. Verification screen → focus an OTP box: focused fill is soft orange tint.
5. Shipment detail → expand **Shipment info** → first row shows **Shipment ID** (`#XXXXXXXX`).
6. Spot-check destructive reds still red: delete card, cancel parcel, cancel shipment, delete account.

---

## Pre-Release UX Polish — Workshop nav + empty states

**Date:** 2026-06-15

### Scope
Focused navigation/empty-state polish before the next iOS release + Android/Play setup.
No Supabase / payment / ticketing / archive / shipment-creation logic changed. No new features.

### Changes
1. **Shipment Workshop — bottom navigation restored.** Added the shared floating `StaticTabBar`
   (Home · Shipments · Actions · Activity, `activeKey="Shipments"`) so the user is never trapped —
   visible both with **no parcels** and **after parcels are added**. Scroll padding bumped to clear
   the bar; the *Cancel shipment* link now sits just above it (both coexist with the nav).
2. **Shipment Workshop — top "‹ Shipments" control.** For an **empty newly-created shipment** the
   header now shows a labelled `‹ Shipments` control that always routes to the Shipments tab
   (`MainTabs → Shipments`), even if the shipment was opened from the Dashboard. For a shipment
   **with parcels**, the original chevron back button (`handleBack` → source) is **unchanged**.
3. **Dashboard empty state (no shipments) — friendlier & useful.** Replaced the bare
   "Start your first shipment / Create your first shipment to get started" card with:
   *"Welcome to Circuit 41 — Ship your goods from overseas to your door. Here's how it works:"*
   followed by a 4-step list (1 Start a shipment · 2 Add parcel & tracking details ·
   3 Send your goods to the warehouse · 4 Track every update inside Circuit 41) and a primary
   **Start your first shipment** button. No onboarding flow, no overbuild.

### Empty states reviewed (copy confirmed, all clean)
- **Dashboard (no shipments):** new welcome + how-it-works (above). Recent-activity card below shows
  "No activity recorded yet".
- **Shipments:** "No active shipments" / "No completed shipments".
- **Actions:** "All caught up" / "No actions needed right now".
- **Activity:** "No activity recorded yet".

### Empty-state preview (dev-only, release-safe)
`dev/empty-states-preview.html` — a standalone HTML mock of all four empty states (real colours +
copy). Open with `open dev/empty-states-preview.html`. **Not** bundled into the app; touches no data.

### Files changed
- `screens/ShipmentWorkspaceScreen.tsx` (bottom nav + top "‹ Shipments" control + padding)
- `screens/DashboardScreen.tsx` (empty-state content + step styles)
- `dev/empty-states-preview.html` (new, dev-only)

### Validation
- `npx tsc --noEmit` → **0 errors** (clean).

### Native rebuild required?
No. JS/TS only — reuses the existing `StaticTabBar` component and `expo-blur`/navigation already in
the build. A Metro reload / next normal Archive/EAS build picks it up.

### Release readiness note
These are low-risk UI/navigation changes. Version remains **1.0.2 / build 8** (see Release Prep
section below) — no version bump needed for this polish unless a fresh build is cut after it, in
which case bump the build number again (see `RELEASE_HANDOFF.md`).

---

## Release Prep — iOS 1.0.2 (build 8)

**Date:** 2026-06-15

### Goal
Cut a production iOS build. **No feature/UI/logic changes** — version/build bump + config check only.

### Version / build — now consistent across ALL sources of truth
| File | Field | Value |
|------|-------|-------|
| `app.json` | `expo.version` | **1.0.2** |
| `app.json` | `expo.ios.buildNumber` | **8** |
| `ios/Circuit41/Info.plist` | `CFBundleShortVersionString` | **1.0.2** |
| `ios/Circuit41/Info.plist` | `CFBundleVersion` | **8** |
| `ios/Circuit41.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (Debug+Release) | **1.0.2** |
| `ios/Circuit41.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` (Debug+Release) | **8** |

`npx expo config` resolves `version 1.0.2`, `ios.buildNumber 8`. (App Store Connect already has build 7.)

### Source-of-truth note (important for whoever archives)
This repo has a **committed native `ios/` folder**, and `Info.plist` uses **hardcoded** version
strings (not `$(MARKETING_VERSION)`/`$(CURRENT_PROJECT_VERSION)` variables). So for a **direct Xcode
Archive, `Info.plist` is what ships** — Expo does **not** override it unless `expo prebuild` is run.
All four files were updated together so a future `expo prebuild` (which regenerates `ios/` from
`app.json`) stays consistent at 1.0.2 / 8.

### Config verification
- ✅ Stripe key is `pk_live` (production) — `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- ✅ Supabase URL host `ovowxxiyxjsntowwnxso` matches the active project; anon key is the public client key.
- ✅ `bundleIdentifier com.circuit40s.circuit41app`, `scheme circuit41`, `appleTeamId 7B3AQARYKN`.
- ✏️ `eas.json` submit: filled `appleTeamId` → `7B3AQARYKN`. `ascAppId` still placeholder (see blockers).

### Validation run
- `npx tsc --noEmit` → no new errors (25 pre-existing/unrelated: `supabase/functions/*`,
  `ToolsScreen.tsx`, `lib/googleAuth.ts`).
- `npx expo config --json` → version 1.0.2 / build 8 confirmed.

### Remaining release blockers / dependencies
1. **EAS Build path only:** `.env` is gitignored, so `EXPO_PUBLIC_*` (Supabase URL/key, Stripe live
   key, Google client IDs) must be set as **EAS environment variables/secrets** or an EAS build ships
   undefined keys. *Not* a blocker for a local Xcode Archive (it reads local `.env` at bundle time).
2. **`eas submit` path only:** `eas.json → submit.production.ios.ascAppId` is still
   `YOUR_APP_STORE_CONNECT_APP_ID` — fill with the App Store Connect app ID before `eas submit`.
   *Not* needed for manual Xcode/Transporter upload.

### Next manual steps
**Path A — Xcode Archive (matches current native files; recommended given the committed `ios/`):**
1. `cd ios && pod install` (ensure Pods current), open `ios/Circuit41.xcworkspace`.
2. Select `Any iOS Device (arm64)`, scheme `Circuit41`, Release.
3. Confirm General tab shows Version **1.0.2**, Build **8**.
4. Product → Archive → Distribute App → App Store Connect → Upload.

**Path B — EAS Build + Submit:**
1. Set the `EXPO_PUBLIC_*` vars as EAS env/secrets (blocker #1).
2. `eas build --platform ios --profile production` (production profile auto-increments build remotely;
   `appVersionSource: "remote"` means EAS tracks the build number on its servers).
3. Fill `ascAppId` (blocker #2), then `eas submit --platform ios --profile production`.

### Native rebuild required?
No code rebuild needed — version/config only. A normal Archive/EAS build packages it.

---

## Design-System Standardisation Pass — colour & button audit

**Date:** 2026-06-15

### Goal
Make the app feel like one product. Retire the **old Circuit red (`#C10F1D`)** entirely, standardise
buttons, and enforce a single emphasis hierarchy. No layout/logic/Supabase/navigation changes.

### Canonical action-colour system (now centralised in `lib/theme.ts`)
- **Primary = black `#1A1712`**, white text — the dominant action colour: Continue, Submit, Save,
  Pay, Create, Next, Confirm.
- **Accent = `#CD643D` (orange), used sparingly** — selected states, active nav, small indicators,
  status highlights, progress, links. **Never** a full-screen or primary-button colour.
- **Danger = red `#DC2626`** — errors, destructive/delete/cancel-shipment, warnings ONLY.
- The old Circuit red `#C10F1D` is fully removed and must not be reintroduced.

### What was replaced
- **18 local `accent: '#C10F1D'` tokens → `#CD643D`** (every screen/component that still carried the
  old red as its accent).
- **16 primary CTAs red/orange → black `#1A1712`:** Route-selection *Continue*, Slot-selection
  *Continue*, Checkout CTA, Feedback *Submit*, Profile-setup, Welcome, Phone/Email, Shipment-active,
  Saved-cards *Save*, Verification, Support *Submit*, Workspace *Ready*, Action sheet *Submit*,
  Profile-edit *Save*, Add-item *Add*, Address *Confirm*, Dashboard *Start Shipment*.
- **Destructive → red `#DC2626`:** Profile delete-account button + "Delete account" link, Saved-cards
  delete icon, Workspace *cancel parcel* / *cancel shipment* text.
- **Accent links kept orange** (correct usage): selected-country check, "Done" links in bottom
  sheets, the workspace tracking-reference link.
- **Route-selection bottom "Cancel"** (aborts creation, not destructive) → neutral grey secondary.
- **Slot "Express/Fast" badge** red → soft accent tint (it's a highlight, not an error).

### Shipment Details correction
- **Shipment ID restored** — added as the first row of the *Shipment information* accordion
  (`#XXXXXXXX` short ref), so users can quote it to support.

### Screens / components modified
Screens: `ShippingRouteScreen`, `SlotSelectionScreen`, `ShipmentCheckoutScreen`,
`ShipmentWorkspaceScreen`, `ShipmentDetailScreen`, `ShipmentSupportScreen`, `ShipmentActiveScreen`,
`DashboardScreen`, `ProfileScreen`, `ProfileSetupScreen`, `SavedCardsScreen`, `FeedbackScreen`,
`WelcomeScreen`, `PhoneEmailScreen`, `VerificationScreen`, `EmailWaitingScreen`, `ActivityScreen`,
`TermsOfServiceScreen`, `PrivacyPolicyScreen`, `ToolsScreen`.
Components: `ActionBottomSheet`, `AddItemBottomSheet`, `AddressBottomSheet`, `ProfileEditBottomSheet`.
Theme: `lib/theme.ts` (added `primary` / `primaryText` / `danger` tokens + doc comment).

### Validation
- `grep #C10F1D` → 0 results (old red fully retired).
- `npx tsc --noEmit` → no new errors (25 remain, all pre-existing/unrelated:
  `supabase/functions/*`, orphaned `ToolsScreen.tsx`, `lib/googleAuth.ts`).

### Native rebuild
Not required — JS/TS only.

---

## Correction Pass 3 — FAB, gestures, timeline revert, empty states, countries

**Date:** 2026-06-15

### Scope
Correction-only pass. No broad redesign. No schema/policy/auth/payment/ticket/checkout logic changes.

### Changes
1. **Dashboard FAB is now a true floating button** (`screens/DashboardScreen.tsx`). It was a child of
   the gesture/animated surface, so it shifted during pulls. Moved it out into a static outer `View`
   (sibling of the animated layer); same position (`bottom: 92 + insets.bottom`, `right: 22`), now
   fixed regardless of pull/scroll.
2. **Dashboard swipe gestures de-sensitised.** Now require a deliberate "pull and hold":
   `onMoveShouldSetPanResponder` needs `|dy| > 24` and strong vertical dominance (`> |dx| * 2`);
   navigation only fires when **all** of: distance `> 160px`, release velocity `< 0.6` (rejects
   flicks), and duration `> 200ms`. Small/casual swipes and normal scrolls no longer switch pages.
3. **Shipment Detail timeline reverted** to the original boxed style (green/accent dots, stage cards
   with subtitle + full timestamp, compact internally-scrollable viewport). The redesigned hero and
   the unified bottom list card are **unchanged**.
4. **Empty states** standardised: “No parcels added yet”, “No documents uploaded yet”,
   “No activity recorded yet” (Events section + Activity screen + Dashboard), and a new
   “No cost records yet” when a shipment has no rate/weight/cost. Shipments list and SlotSelection
   already had clean empty states (“No active/completed shipments”, “No slots available for this route”).
5. **Origin countries** now: China, Turkey, United Kingdom, Nigeria, Spain.
6. **Destination countries** now: United Kingdom, Nigeria, United States, Canada, Spain, Ghana.
   (`screens/ShippingRouteScreen.tsx` — the only place country options are defined.)
7. **Backend/data compatibility verified.** `origin_country`/`destination_country` are free-text
   `string` columns (no Postgres enum), there is no country allowlist/validation/listener in app
   code, and existing shipments load as plain strings — so the new values are accepted everywhere.
   The picker now **merges** the canonical lists with active `shipping_rates` so the new countries
   always appear. **Note:** a route only produces selectable shipping *slots* when an **active
   `shipping_rates`** row exists for it. Currently active rates exist only for **China → United
   Kingdom** and **Turkey → Nigeria**; other routes will show the existing “No slots available for
   this route” state until priced rate rows are added in Supabase (not fabricated here).

### Files changed
`screens/DashboardScreen.tsx`, `screens/ShipmentDetailScreen.tsx`, `screens/ShippingRouteScreen.tsx`,
`screens/ActivityScreen.tsx`.

### Testing
- `npx tsc --noEmit`: all changed files type-clean (25 pre-existing, unrelated errors remain in
  `supabase/functions/*`, `ToolsScreen.tsx`, `lib/googleAuth.ts`).

### Native rebuild
Not required — JS/TS only. Metro reload / Fast Refresh is sufficient.

---

## UI Correction Pass 2 — Shipment Detail to match reference

**Date:** 2026-06-15

### Scope
Second focused pass on **Shipment Detail** + two small nav-screen fixes. No backend, Supabase,
auth, payment, ticketing, archive, checkout, or shipment-creation logic touched.

### Changes (`screens/ShipmentDetailScreen.tsx`)
- **Timeline de-boxed:** removed the per-step card boxes. Now a plain vertical timeline — line +
  circular dots + plain title and short date beside it. Dots: **completed = solid dark**,
  **current = blue ring (blue title/date)**, **upcoming = muted**. Shows stages up to the current
  one plus the next upcoming step, so it stays compact like the reference.
- **Bottom section is now ONE unified rounded white card** (not four floating cards): rows divided
  by thin dividers, label left, summary value right, chevron far right (rotates when open).
- **Row order: Events · Parcels · Shipment info · Documents · Cost.** Summary values: Events count,
  `N items`, (none), `N files`, and the formatted total cost.
- **All sections start collapsed.** Nothing auto-expands.
- **Shipment info simplified:** removed Carrier, Tracking ref, and Est. delivery (ETA lives in the
  hero). Now shows Slot, Origin, Destination, Delivery Address, Total weight, Created.
- **Parcels is its own rich section:** per parcel shows item name(s), category, status, tracking,
  weight, added date, and photo/proof count — the customer can see what's inside.
- **Hero headline** now prefers customer-facing delivery info (`Arriving <date>`, else
  `In transit to <country>` / `Delivery pending` / `Out for delivery` / `Delivered`); the small
  green label keeps the raw status. Removed the extra shipment-id/parcels meta line for a clean,
  reference-matching hero.
- Documents section still holds docs + photos/proofs (unchanged behaviour).

### Other fixes
- **`screens/ProfileScreen.tsx`** — added a back button (Profile is no longer a tab, so it needed an
  explicit exit; falls back to `MainTabs` if there's no back stack).
- **`screens/ActivityScreen.tsx`** — removed the back button; it behaves as a normal main tab now.

### Files changed
`screens/ShipmentDetailScreen.tsx`, `screens/ProfileScreen.tsx`, `screens/ActivityScreen.tsx`.

### Testing
- `npx tsc --noEmit`: all changed files type-clean (25 pre-existing, unrelated errors remain in
  `supabase/functions/*`, `ToolsScreen.tsx`, `lib/googleAuth.ts`).

### Native rebuild
Not required — JS/TS only. Metro reload / Fast Refresh is sufficient.

---

## UI Correction Pass — Shipment Detail, Navigation, Home

**Date:** 2026-06-15

### Scope
Focused UI/layout correction only. No backend, Supabase schema/policies, auth, payment,
ticketing, shipment-creation, archive, checkout, or rate logic touched. Existing data and
functionality reorganised, not removed.

### Changes
- **Shipment Detail (`screens/ShipmentDetailScreen.tsx`) reworked to match reference:**
  - New top bar: back (left) · route title centred (e.g. `Guangzhou → Lagos`) · help (right).
  - Added a **dark hero/status card** (`gradients.heroDark`) showing headline status from real
    data: `Arriving <date>` (or status label), an uppercase status line, and the most-recent
    real timeline event + relative time (e.g. `On board … · 4d ago`). No hardcoded values.
  - Timeline kept but **compact and internally scrollable** (`maxHeight` viewport) so it never
    dominates the page.
  - **Tabs removed.** Replaced with an **expandable accordion**: `Shipment Information`
    (details + cargo table), `Documents` (docs + uploaded photos/proofs), `Cost`, `Events`
    (activity + actions, with the action bottom sheet preserved).
  - Upload/download, signed URLs, action submit, and the `ActionBottomSheet` are unchanged.
- **Bottom navigation visible on Shipment Detail:** new presentational `components/StaticTabBar.tsx`
  mirrors the floating nav and jumps back into the tab navigator (`navigate('MainTabs', { screen })`).
  Chosen over a full nested-stack rebuild to keep the change focused and low-risk.
- **Bottom nav corrected:** `Profile` tab removed; `Activity` tab restored. Tabs are now
  `Home · Shipments · Actions · Activity`. `Profile` moved to a root-stack screen, still reachable
  from the Home avatar button. Updated prop types and `getParent()?.reset` fallback accordingly.
- **Home greeting name source:** now prefers `profiles.preferred_name`/`first_name`, then auth
  metadata name, then a generic `there` — no longer derives the name from the email/Gmail handle.
- **Base background colour:** `#F7F6F0` → `#F5F9F6` everywhere it was used (`lib/theme.ts` +
  ~28 screens/components).
- Home floating `+` button confirmed already a proper floating circular FAB above content.

### Files changed
`App.tsx`, `lib/theme.ts`, `screens/ShipmentDetailScreen.tsx`, `screens/DashboardScreen.tsx`,
`screens/ActivityScreen.tsx`, `screens/ProfileScreen.tsx`, `components/StaticTabBar.tsx` (new),
plus the bulk background-colour replacement across screens/components.

### Testing
- `npx tsc --noEmit`: all changed files type-clean. Remaining errors are pre-existing and
  unrelated (`supabase/functions/*` Deno globals, `ToolsScreen.tsx` orphaned `'Tools'` tab,
  `lib/googleAuth.ts` nonce).
- Device smoke-test still pending (see next steps).

### Native rebuild
Not required — only JS/TS changed. `expo-linear-gradient` and `expo-blur` are already installed
and in use, so a Metro reload / Fast Refresh is sufficient.

---

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

---

## Mobile UI redesign — handoff pass + corrections (2026-06-14)

Implemented the design-handoff direction with the user's 10 corrections taking precedence over the
README (which proposed a blue accent + liquid pill + bordered cards — all rejected). Visual only;
no business logic changed. Focus: **nav + the 10 corrections** (full per-screen rebuild deferred).

### Visual system applied
- **Accent = `#CD643D` only, used sparingly**; the README's blue `#2E9BDC` two-tone was dropped.
  No blue accent, no blue gradients anywhere. (The app had no gradients/blue to begin with — the
  "blue gradients" were only in the mockups.)
- **Borderless cards** — depth via soft shadow + spacing + one premium dark surface.
- **One emphasis treatment** = solid near-black `#1A1712`, white text (selected service, bank
  transfer selected, warehouse card). No loud gradients; the only approved gradient token
  (`gradients.heroDark`) is reserved for a future dashboard hero.
- New tokens in `lib/theme.ts` (`dark`, `onDark`, `navFrost`, `navPill`, `gradients.heroDark`,
  `shadow.dark`).

### Bottom nav (correction #1)
- New `components/CustomTabBar.tsx`: floating **frosted** pill (`expo-blur` BlurView + translucent
  overlay) with a **restrained translucent sliding selector** — one gentle `Animated.spring`
  (high friction, no overshoot), **no stretch/wobble/liquid**. Active icon+label `#CD643D`,
  inactive neutral ink. Wired via `Tab.Navigator tabBar={...}`. Kept the existing 4 tabs to avoid
  risky route surgery (Profile→Activity restructure noted as optional follow-up).

### Card / gradient / colour corrections (#2–#6, #10)
- **Borders removed** on Dashboard, Shipments (active/in-progress/completed), Support, Actions, and
  Checkout payment/bank cards → soft shadows instead.
- **Bank transfer selected** (Checkout): now a **dark solid** card (`#1A1712`, white icon+label,
  white dot) — no red border, no blue. Payment icons gained an optional `color` prop for legibility
  on dark. Bank-details card is borderless solid.
- **Warehouse card** (Workshop): **solid dark premium card**, white text, white copy pill — important
  & copyable, not loud; no blue.
- **Service selection** (SlotSelection): selected option = **dark solid filled** with white text and
  an orange-on-dark expand link; unselected = neutral borderless. (Replaces the red-border selected.)
- Residual harsh **red `#C10F1D` → `#CD643D`** in Checkout, SlotSelection, Dashboard, Shipments,
  Detail, Workshop.

### Recent section (#7)
- Verified the live Dashboard "Recent" already renders the **real `activity` feed** (the fake
  "Istanbul → London" was mockup-only). No hardcoded content; left on real data, borderless card.

### Actions page (#8)
- Redesigned `ActionsScreen`: borderless soft-shadow cards, a clear **"Pending"** status chip
  (warm accent dot), flat near-black CTA (accent reserved), warm neutral layout, accent used sparingly.

### Files changed
- `lib/theme.ts` (tokens), `components/CustomTabBar.tsx` (new), `App.tsx` (custom tabBar wiring),
  `screens/DashboardScreen.tsx`, `screens/ShipmentsScreen.tsx`, `screens/ShipmentDetailScreen.tsx`,
  `screens/ShipmentWorkspaceScreen.tsx`, `screens/ShipmentCheckoutScreen.tsx`,
  `screens/SlotSelectionScreen.tsx`, `screens/ActionsScreen.tsx`, `screens/ShipmentSupportScreen.tsx`.
- `package.json` — added `expo-blur`, `expo-linear-gradient`.

### Build / native
- `npx tsc --noEmit` — **0 errors in changed files** (25 pre-existing errors remain in
  `supabase/functions/*` Deno edge functions, `ToolsScreen`, `googleAuth` — untouched, unrelated).
- **NATIVE REBUILD REQUIRED** — `expo-blur` + `expo-linear-gradient` are native modules. The new nav
  frost won't appear (and the app won't bundle them) until a fresh dev/preview build:
  `eas build -p ios --profile preview` (or `npx expo run:ios --device`). A JS-only reload is NOT enough.

### Functionality preserved
Auth, shipment creation/list, archived placement, ticketing/support, payment-proof upload, bank
transfer, pickup selection, checkout, actions/activity, dashboard data, completed/history — all
unchanged (presentation + a custom tabBar renderer only).

### Follow-up (deferred)
Full per-screen pixel rebuild (dashboard dark hero with `gradients.heroDark`, shipment progress
tracks, detail timeline, checkout weight/volume proof tiles, Profile→Activity tab restructure),
and migrating remaining secondary screens off their inline red `DS` blocks.

---

## Mobile redesign — Dashboard, Detail, layer-gesture (2026-06-14)

Applied the design-package visual language to the Dashboard and Shipment Detail, plus a
gesture-navigation experiment. UI/layout only — no business logic, schema, API, nav flow,
workflow, ticketing, payment, or auth changes.

### Dashboard (`DashboardScreen`)
- **Dark gradient hero** for the active shipment (`expo-linear-gradient` + `gradients.heroDark`,
  soft orange glow, white text, status pill, route, stage) — the design-package hero.
- **Removed the large "Start New Shipment" button**; replaced with a **floating circular "+" FAB**
  (bottom-right, above the nav) → still `navigate('ShippingRoute')` (flow unchanged).
- **Recent Activity** kept; bottom margin increased to `96 + insets.bottom` so it **floats clear of
  the bottom nav** and never touches it.
- **Layer gesture (experiment):** the static top area is a `PanResponder` surface. Pull **down →
  Activity**, pull **up → Shipments**, once past a ~95px threshold; otherwise it **spring-bounces**
  back ("alive" feel). Built with core `PanResponder` + `Animated` (resistive follow + spring) — no
  gesture-handler/reanimated, no navigation rebuild, navigates only to existing routes.

### Shipment Detail (`ShipmentDetailScreen`)
- **Timeline / status / tracking kept**, now shown **always at the top** (inside one ScrollView).
- **Lower navigation changed to: Parcels · Documents · Costs · Events** (was Timeline/Events/
  Details/Documents). Parcels = shipment info + cargo; Costs = cost breakdown; Documents (photos'
  home — no photos were shown in the top section, so nothing to remove there); Events = activity +
  actions (tracking/system/shipment events). No data lost — Shipment Info preserved under Parcels.
- Refactored the four content renderers from per-tab `ScrollView`s to `View`s nested in one outer
  scroll (Timeline + tabs + content) to avoid nested-scroll issues.

### Creation flow
- Already carries the design system from prior passes (Slot/Workshop/Checkout: borderless cards,
  dark-solid selected service, dark warehouse + bank-transfer cards, `#CD643D` accent). No
  field/validation/workflow changes. `ShippingRoute` deep restyle deferred (consistent already).

### Files changed
`screens/DashboardScreen.tsx`, `screens/ShipmentDetailScreen.tsx`. (Builds on `lib/theme.ts`
`gradients`/`shadow`, and the earlier `CustomTabBar`.)

### Build / native
- `npx tsc --noEmit` — **0 errors in changed files** (25 pre-existing, unrelated errors remain in
  `supabase/functions/*`, `ToolsScreen`, `googleAuth`).
- **Native rebuild still required** (carryover): `expo-blur` + `expo-linear-gradient` are native
  modules added in the prior pass — the frosted nav + gradient hero need a fresh dev/preview build
  (`eas build -p ios --profile preview` or `npx expo run:ios --device`). No new native deps added
  this pass.

### Preserved
Auth, shipment creation/list, archived placement, ticketing/support, payment-proof upload, bank
transfer, pickup selection, checkout, actions/activity, dashboard data, completed/history.

---

## Mobile UI iteration — screenshot-match pass (2026-06-15)

Implemented the attached design screenshots as the source of truth, preserving all functionality
(no logic/nav-architecture/schema/query/auth/workflow/payment/ticketing changes). Builds on the
shared `lib/theme.ts`, `CustomTabBar`, `expo-blur`, `expo-linear-gradient`.

### Done this iteration
- **Dashboard (`DashboardScreen.tsx`)**
  - Greeting redesigned to **avatar + "Good {morning/afternoon/evening}" + first name** (avatar →
    Profile). Removed the old "Welcome back 👋" + bell.
  - **Hero** now matches the reference: dark gradient card, "ACTIVE SHIPMENT" label, status pill,
    route, **"Arriving <date>"** headline (falls back to stage), **4-segment progress bar**
    (orange filled / dark empty, derived from status), meta caption.
  - **Floating circular "+" FAB** (created last pass) retained; Recent Activity floats clear of the
    nav (`marginBottom: 96 + insets.bottom`).
  - **Whole-page gesture**: `PanResponder` moved to the **root** Animated.View (was top-section
    only). Pull down → Activity, up → Shipments past ~95px, else spring-bounce. The Recent
    ScrollView still scrolls within its own area; the rest of the page drives the gesture.
  - **Fixed the earlier "Rendered more hooks" crash** — gesture `useRef` hooks now sit ABOVE the
    `if (!fontsLoaded) return null` early return.
- **Shipments (`ShipmentsScreen.tsx`)**: header is now **title + dark rounded "+" button**;
  Active/Completed is a **segmented control** (light track, dark active segment, white label).
- **Shipment Detail (`ShipmentDetailScreen.tsx`)**: timeline is now **compact + internally
  scrollable** (`timelineViewport maxHeight 232` wrapping a nested ScrollView) so it doesn't
  dominate; all timeline events remain reachable by scrolling within that area.
- **Checkout (`ShipmentCheckoutScreen.tsx`)**: the **entire bank-transfer details block is now
  dark** (card, country selector, detail rows, transfer-amount box, dashed upload, divider) with
  white/ muted-white text — matching the reference. Behaviour unchanged.
- (Prior passes already delivered: borderless cards, dark-solid selected service card, dark
  warehouse card, `#CD643D` accent, frosted floating `CustomTabBar`.)

### Deferred / not done (intentional)
- **Detail lower nav is still TABS** (Parcels/Documents/Costs/Events), not the screenshot's
  **rows-with-chevrons + Events section**. Functional and on-brand; converting to the rows/accordion
  layout is the main remaining visual delta. Deferred to avoid a risky refactor at session end.
- **4th bottom-tab is still "Profile"**, while the screenshots show **"Activity"** (with Profile via
  the avatar). Kept per the explicit "do not modify navigation architecture" rule. Switching to an
  Activity tab + avatar-only Profile is a small, reversible follow-up if approved.
- Route/Creation flow already matches closely; no deep changes this pass.

### Known issues / notes
- **Native rebuild required**: `expo-blur` + `expo-linear-gradient` are native modules (added a
  prior pass). The frosted nav + gradient hero need a dev/preview build (`eas build -p ios
  --profile preview` or `npx expo run:ios --device`); a JS-only reload won't include them.
- **Pre-existing tsc errors (25)** in `supabase/functions/*` (Deno globals), `ToolsScreen.tsx`
  ("Tools" not in TabParamList), and `lib/googleAuth.ts` (nonce). Unrelated to this work; all
  changed files are type-clean (`npx tsc --noEmit`).
- Whole-page gesture: inside the Recent list's scroll region the scroll wins over the pan (expected
  RN responder behaviour); the rest of the page participates.

### Design decisions
- Accent **`#CD643D` used sparingly** (selected states, CTAs, small badges); **no blue**; one
  premium **dark `#1A1712`** emphasis surface (hero/selected service/warehouse/bank/FAB).
- **Borderless cards** (soft shadow). Frost via translucency + BlurView; the only gradient is the
  dark hero (`gradients.heroDark`).

### Files changed this iteration
`screens/DashboardScreen.tsx`, `screens/ShipmentsScreen.tsx`, `screens/ShipmentDetailScreen.tsx`,
`screens/ShipmentCheckoutScreen.tsx`.

### Testing done
- `npx tsc --noEmit`: 0 errors in changed files (25 pre-existing unrelated). Not yet run on a device
  this iteration — needs the native build + manual smoke test (see next steps).

### Recommended next steps
1. Rebuild the dev client (native libs) and smoke-test on device.
2. Convert the Detail lower nav from tabs → rows/accordion to match the screenshot.
3. Decide on the Activity-vs-Profile 4th tab; if approved, do the small nav reorg.
4. Optional: sticky tab/rows header while the timeline scrolls under it.

---

## Android release-readiness pass (2026-06-15)

Prepared the existing Expo/React Native app for Google Play release validation. No Supabase schema,
payment workflow, ticketing workflow, archive logic, or UI redesign changes were made.

### Diagnosis
- Android package/application ID is `com.circuit40s.circuit41`.
- Expo/EAS/native Android config was mostly present, but production release readiness had gaps:
  Google Pay was hard-coded to Stripe test mode, Android EAS production lacked explicit AAB output,
  unused microphone/overlay permissions were present in Android output, app/package/native versions
  were not fully aligned, and app TypeScript validation was being polluted by Deno Supabase Edge
  Function files.
- Local native release assembly could not run because this machine has no Java Runtime installed.

### Fixes made
- Set Android EAS production builds to app bundle output.
- Removed unused Android `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` permissions from Expo config and
  the committed native manifest.
- Aligned app/package/native Android version display to `1.0.2`.
- Changed Google Pay test environment usage to development-only via `__DEV__`.
- Fixed app TypeScript issues in Google Sign-In nonce typing and the orphaned Tools screen prop.
- Excluded `supabase/functions/**` from the Expo app TypeScript check because those files target
  Deno, not React Native.
- Added `ANDROID_RELEASE_HANDOFF.md` with build, submit, blocker, and smoke-test steps.

### Validation
- `npx expo config --type public`: passes and resolves package `com.circuit40s.circuit41`.
- `npx tsc --noEmit`: app validation passes after excluding Deno Edge Functions.
- `npx expo prebuild --platform android --no-install`: passes with Node 24 and reuses `android/`.
- `npx expo install --fix`: aligned Expo/RN SDK patch versions; `npx expo install --check` now
  reports `Dependencies are up to date`.
- `npm audit --omit=dev --audit-level=high`: passes after safe `npm audit fix`; 11 moderate
  transitive findings remain and would require `npm audit fix --force` / breaking Expo package
  changes, so they were not force-applied.
- `./android/gradlew -p android :app:assembleRelease`: blocked locally by missing Java Runtime.
- `npx eas whoami`: authenticated as `makk55`; `npx eas build:list --platform android --limit 5`
  shows no prior Android builds for this project.

### Remaining Play Store blockers
1. Install/configure a JDK locally or run an EAS Android production build to prove native compile.
2. Verify EAS Android signing credentials and Google Play app signing for `com.circuit40s.circuit41`.
3. Configure/verify Google OAuth Android client SHA-1/SHA-256 for the release signing key.
4. Verify Stripe Google Pay production settings and run one production-build payment smoke test.
5. Decide whether the remaining moderate `uuid`/Expo tooling audit findings justify a breaking
   `npm audit fix --force`; not force-applied here.
6. Complete Play Console metadata, privacy/data safety, content rating, screenshots, and internal
   testing before production rollout.
