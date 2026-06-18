# Circuit 41 — Technical Handover

_Prepared: 2026-06-18. Audience: incoming technical owner taking over releases, infrastructure,
deployment, and debugging. Goal: zero tribal knowledge required._

This document is self-contained. It does **not** require any prior chat/context. Companion docs:
`Handover/RELEASE_STATUS.md`, `Handover/ACCESS_REQUIREMENTS.md`, plus the root `RELEASE_HANDOFF.md`
(iOS), `ANDROID_RELEASE_HANDOFF.md`, and `PROJECT_STATUS.md` (chronological change log).

---

## 1. Project overview

Circuit 41 is a logistics / shipment-forwarding product. Customers create shipments, send parcels to
a warehouse, track them through fulfilment stages, pay (card or bank transfer), and raise support
tickets. There are **two front-ends sharing one Supabase backend**:

- **Mobile app (THIS repository)** — the customer-facing Expo / React Native app (iOS + Android).
- **Ops Tool (separate system, not in this repo)** — the staff/operator console used to review
  shipments, weigh/forward parcels, dispatch, and manage tickets. Evidence it exists and shares this
  backend: Supabase migrations `..._c41_phase1_ops_internal_queue_fields`,
  `..._phase1b_ops_reviewed_and_forwarder_dispatch`, `..._phase2_ops_workspace`, and
  `..._allow_staff_select_activity_actions` (staff RLS). The incoming owner should locate the Ops Tool
  repository/deployment separately (ask the current owner) — it is **not** part of this codebase.

---

## 2. Mobile app overview (this repo)

- **Stack:** Expo SDK `^55` (canary), React Native `0.83`, React `19`, TypeScript `~5.9`,
  React Navigation v7 (native-stack + bottom-tabs). Fonts: Plus Jakarta Sans.
- **Workflow type:** Expo with **committed native folders** (`ios/` and `android/` are checked in —
  i.e. "prebuild output committed"). This is critical: `app.json` changes do **not** reach a build
  unless `expo prebuild` is re-run; an Xcode Archive or EAS build uses the committed native project.
- **Entry / boot path:** `index.ts` → `App.tsx` → `StripeProvider` → `AuthProvider`
  (`context/AuthContext.tsx`) → `NavigationContainer` → `RootNavigator`. `AuthContext` imports
  `lib/supabase.ts`, so **anything that throws at module load in `lib/supabase.ts` crashes the app
  before the first screen renders** (this was the Android crash — see §9).
- **Key directories:**
  - `screens/` — all screens (Dashboard, Shipments, ShipmentDetail, ShipmentWorkspace, Checkout,
    Actions, Activity, Profile, auth flow, etc.).
  - `components/` — shared UI (bottom sheets, `CustomTabBar`, `StaticTabBar`).
  - `lib/` — `supabase.ts` (client), `googleAuth.ts`, `appleAuth.ts`, `bootstrapProfile.ts`,
    `database.types.ts`, `navigationHelper.ts`, `theme.ts`, `typography.ts`, `imagePicker.ts`.
  - `context/AuthContext.tsx` — session/user state, sign-out, deleted-account enforcement.
  - `supabase/` — `config.toml`, `migrations/`, `functions/` (edge functions).
- **Design system:** primary action = black `#1A1712`; accent = `#CD643D` (sparingly); danger/red
  `#DC2626` for destructive/errors only; base background `#F5F9F6`. (See `UI_BREAKDOWN.md`.)

---

## 3. Ops Tool overview

A **separate staff-facing application** (not in this repository) that operates the same Supabase
project. It handles the operator side of the shipment lifecycle: internal review queue, parcel
weighing, forwarder dispatch, status transitions, and ticket responses. The mobile app and the Ops
Tool are kept consistent through the shared Supabase schema + RLS (staff policies). **Action for
incoming owner:** obtain the Ops Tool repo, deployment target, and access from the current owner;
confirm both apps point at the same Supabase project (`ovowxxiyxjsntowwnxso`).

---

## 4. Supabase architecture

- **Project ref:** `ovowxxiyxjsntowwnxso` (region eu-central-1).
- **Client:** `lib/supabase.ts` — `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)`
  with AsyncStorage session persistence. Uses the **anon** key (public, RLS-enforced).
- **Core tables (referenced by the app):** `shipments`, `parcels`, `profiles`, `activity`,
  `actions`, `documents`, `shipment_proofs`, `payment_accounts`, `payment_proofs`, `pickup_points`,
  `saved_addresses`, `saved_cards`, `shipping_rates`, `fx_rates`, `feedback`, `shipment_tickets`,
  `shipment_ticket_messages`.
- **Migrations:** in `supabase/migrations/` (timestamped). They cover shipping rates / FX, payment
  accounts & proofs, pickup points, the multi-phase **Ops workspace**, archive behaviour, and
  tickets. Apply via the Supabase CLI (`supabase db push`) or the dashboard — coordinate with the
  Ops Tool owner since both apps share the schema.
- **Edge Functions** (`supabase/functions/`, Deno runtime — excluded from the app's tsconfig):
  - `create-payment-intent` — Stripe payment intent for card checkout.
  - `setup-payment-method` — saves a card / sets up a Stripe payment method.
  - `delete-account` — account deletion.
  - `app-review-login` — review/test login helper for store reviewers.
- **Storage:** shipment documents, photos, and bank-transfer proofs (uploaded via the app).
- **RLS:** customer rows scoped by `user_id`; staff policies allow Ops Tool access (see migration
  `allow_staff_select_activity_actions`). **Do not modify schema/RLS without coordinating the Ops Tool.**

---

## 5. Expo / EAS architecture

- **EAS project ID:** `22a7a2e4-4ee9-4d30-919b-01c687e3bd95`.
- **Account / ownership — ACTION REQUIRED:** `app.json` currently has `"owner": "makk55"` (the old
  **personal** account). The Expo account has been migrated to the **company org**:
  `https://expo.dev/accounts/circuit40s`. This org is now the primary Expo/EAS account.
  - **To complete the migration:** confirm the EAS project `22a7a2e4-…` has been transferred into the
    `circuit40s` org, then set `app.json → expo.owner` to `circuit40s` and re-verify `eas whoami` /
    `eas project:info`. This was **deliberately not changed in code** in this pass because changing
    `owner` before the project transfer is confirmed would break EAS builds. Treat as a release task.
- **`eas.json` profiles:** `development` (dev client, internal), `preview` (internal), `production`
  (`autoIncrement: true`; Android `buildType: app-bundle` → `.aab`; iOS Release).
  `cli.appVersionSource = "remote"` → EAS tracks build numbers on its servers.
- **Environment variables — the #1 operational gotcha:** the app reads 5 `EXPO_PUBLIC_*` vars at
  **build time**. The local `.env` is **gitignored** and is **not** uploaded to EAS. **EAS cloud
  builds must have these set as EAS environment variables (scope: production, plaintext visibility)**
  or the build ships with `undefined` keys (this caused the Android crash — §9). Set with
  `eas env:push production --path .env` (or the EAS dashboard). Verify with `eas env:list production`.

---

## 6. Android release architecture

- **Package / application ID:** `com.circuit40s.circuit41` (`android/app/build.gradle` namespace +
  applicationId; matches `app.json → android.package`).
- **Versioning:** Expo version `1.0.2`; native `versionCode` is `1` in the committed `android/`
  folder but EAS `autoIncrement` manages the Play build number on cloud builds.
- **Build artifact:** `.aab` (app bundle) via `eas build -p android --profile production`.
- **Signing:** managed by **EAS credentials** for `com.circuit40s.circuit41`. A local keystore file
  `@makk55__circuit41.jks` exists on the current owner's machine — it is **gitignored (never commit
  keystores)**. Confirm whether EAS holds the canonical upload key or whether this local keystore is
  the upload key; align with Google Play App Signing. Inspect with `eas credentials -p android`.
- **Google OAuth (Android):** the Android OAuth client must match package `com.circuit40s.circuit41`
  and the **release signing SHA-1/SHA-256** fingerprints, or Google Sign-In fails on the store build.
- **Submit:** `eas submit -p android --profile production`, or download the `.aab` and upload to the
  Play Console internal-testing track manually. (`eas.json` has no `submit.production.android` block
  yet — manual upload or add the block with the Google service-account JSON, which must stay gitignored.)

---

## 7. iOS release architecture

- **Bundle identifier:** `com.circuit40s.circuit41app`. **Apple Team ID (app):** `7B3AQARYKN`.
  - Note: `generate-apple-secret.js` (Sign-in-with-Apple client-secret generator for Supabase) uses a
    **different** Apple `teamId XRB5U52F27`, service `com.circuit40s.auth`, key `29QSA49B7C`. These
    are non-secret identifiers; the actual private key is `AuthKey.p8` (gitignored, kept off-repo).
- **Versioning (committed native = source of truth for Xcode Archive):** keep these in sync —
  `app.json` (`version`/`ios.buildNumber`), `ios/Circuit41/Info.plist`
  (`CFBundleShortVersionString`/`CFBundleVersion`), and
  `ios/Circuit41.xcodeproj/project.pbxproj` (`MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`).
  Currently **1.0.2 / build 8**. App Store Connect already has build 7.
- **Two upload paths:** (A) local **Xcode Archive** from `ios/Circuit41.xcworkspace` (reads local
  `.env` at bundle time — no EAS env needed); (B) **EAS build + submit** (needs EAS env vars + the
  `submit.production.ios.ascAppId` placeholder filled). See root `RELEASE_HANDOFF.md`.

---

## 8. Deployment flow (end to end)

```
code → tsc (npx tsc --noEmit) → ensure EAS env vars present (eas env:list production)
     → EAS build (-p android / -p ios, profile production)
     → submit / upload (.aab to Play internal testing; .ipa to App Store Connect / TestFlight)
     → internal testing → review → production rollout
Supabase: migrations applied via Supabase CLI/dashboard (coordinate with Ops Tool).
```

- **iOS** can also be shipped by local Xcode Archive (the only path proven to work so far).
- **No CI/CD is configured** in this repo (no GitHub Actions). Releases are run manually via EAS /
  Xcode. There is **no lint script** (`package.json` scripts: `start`, `android`, `ios`, `web`).
  TypeScript check: `npx tsc --noEmit` (currently 0 errors).

---

## 9. Current known issues

1. **🔴 Android launch crash (diagnosed, fix pending a rebuild).** The Play internal-testing Android
   build closes immediately. Root cause: the EAS Android production build had **no `EXPO_PUBLIC_*`
   env vars**, so `lib/supabase.ts`'s top-level `createClient(...)` threw (`supabaseUrl is required.`)
   before the first screen. **Code is now hardened** (placeholder fallback + `SUPABASE_ENV_MISSING`,
   so it no longer hard-crashes), **but the real fix is adding EAS production env vars and
   rebuilding** (see §5 / `RELEASE_HANDOFF.md`). iOS is unaffected (built locally with `.env`).
2. **Android splash shows old/default branding (cosmetic).** Committed `android/` splash resources are
   stale vs `app.json`; `app.json` splash only applies after `expo prebuild -p android`. Native splash
   background was synced to `#F5F9F6` in `colors.xml`; logo branding needs a prebuild or drawable swap.
3. **Expo owner not yet flipped to `circuit40s`** in `app.json` (see §5) — pending project-transfer
   confirmation.
4. **`eas.json` iOS submit `ascAppId` is a placeholder** (`YOUR_APP_STORE_CONNECT_APP_ID`).
5. **Moderate `npm audit` findings** (transitive, Expo tooling) — not force-fixed to avoid breaking
   changes (per `ANDROID_RELEASE_HANDOFF.md`).

---

## 10. Current release blockers

| # | Blocker | Platform | Owner action |
|---|---------|----------|--------------|
| 1 | Add `EXPO_PUBLIC_*` EAS production env vars, rebuild, re-upload | Android (and any EAS build) | `eas env:push production --path .env` → rebuild → re-upload to Play internal testing |
| 2 | Confirm EAS project transferred to `circuit40s`; set `app.json owner` | Both | verify in EAS dashboard, then edit `app.json` |
| 3 | Fill `eas.json` `submit.production.ios.ascAppId` | iOS (eas submit only) | get numeric App Store Connect app ID |
| 4 | Verify Android signing key + Google OAuth SHA fingerprints | Android | `eas credentials -p android` |
| 5 | Play Console store listing: Data Safety, privacy policy, content rating, screenshots | Android | Play Console |

---

## 11. Current ownership assumptions

- **Primary Expo/EAS account is now the `circuit40s` organization** (`https://expo.dev/accounts/circuit40s`).
  The old `makk55` personal account is being retired; `app.json owner` still references it pending the
  project-transfer flip.
- **Supabase project `ovowxxiyxjsntowwnxso`** is shared by the mobile app and the Ops Tool — schema
  changes must be coordinated across both.
- **Apple Developer** account holds Team `7B3AQARYKN` (app) and the Sign-in-with-Apple key (`AuthKey.p8`,
  off-repo).
- **Stripe** is in **live** mode (`pk_live` publishable key); secret keys live only in Supabase edge
  function env / Stripe dashboard, never in this repo.
- Secrets live **only** outside git: `.env`, `AuthKey.p8`, `GoogleService-Info.plist`, the Google
  OAuth `client_*.plist`, and `*.jks` keystores are all gitignored (verified — see repo safety audit
  in `PROJECT_STATUS.md`).
