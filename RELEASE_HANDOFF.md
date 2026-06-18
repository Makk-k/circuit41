# Circuit 41 — iOS Release Handoff

_Last updated: 2026-06-15 — prepared by release-prep pass._

This document is the single source of truth for shipping the iOS app. It is written so another
agent (or human) can continue release work without re-deriving the project setup.

---

## Changes since last build (pending in next build)

Several polish passes landed **after** version 1.0.2 / build 8 was set but are **not yet in an
uploaded binary**. If you cut a new build now, it will include:
- Shipment Workshop: bottom navigation bar restored + top `‹ Shipments` control (empty state).
- Dashboard empty state: friendly welcome + 4-step how-it-works.
- Final UI cleanup: add-parcel & OTP selected states use the accent tint (not pink-red); new wavy
  Circuit 41 launch/loading screen; Shipment ID shown under Shipment info.

Mostly JS-only. **If you archive/submit a new binary, bump the build number** (next = 9) across the
four version sources listed below, since build 8 may already be uploaded.

**One native-only item:** `app.json → expo.splash.backgroundColor` changed `#F7F6F0` → `#F5F9F6`.
This is baked into the binary, so it only appears after a **native rebuild** (the new JS loading
screen does not need one). Cosmetic; not a blocker.

Visual references (dev-only, not bundled): `dev/empty-states-preview.html`.

---

## Current release target

| Item | Value |
|------|-------|
| Marketing version (`CFBundleShortVersionString`) | **1.0.2** |
| iOS build number (`CFBundleVersion`) | **8** |
| Previous shipped/uploaded build in App Store Connect | 7 |
| Bundle identifier | `com.circuit40s.circuit41app` |
| URL scheme | `circuit41` |
| Apple Team ID | `7B3AQARYKN` |
| EAS project ID | `22a7a2e4-4ee9-4d30-919b-01c687e3bd95` |
| EAS owner (`app.json`) | `makk55` (personal) — **migrating to `circuit40s` org**, see below |
| Supabase project | `ovowxxiyxjsntowwnxso` |

> **Expo account migration (2026-06-18):** the primary Expo/EAS account is now the **`circuit40s`
> organization** (`https://expo.dev/accounts/circuit40s`). `app.json owner` still says `makk55`.
> Once you confirm the EAS project `22a7a2e4-…` is transferred into `circuit40s`, set
> `app.json → expo.owner` to `circuit40s` and re-verify with `eas project:info`. Not changed in code
> yet to avoid breaking builds before the transfer is confirmed.
>
> **Full technical handover:** see `Handover/TECHNICAL_HANDOVER.md`, `Handover/RELEASE_STATUS.md`,
> `Handover/ACCESS_REQUIREMENTS.md`.

---

## Workflow type (read this first)

This is **Expo with a committed native `ios/` folder** (prebuild output is checked in). That means:

- A **direct Xcode Archive uses the native files** (`ios/Circuit41/Info.plist` +
  `Circuit41.xcodeproj`), **not** `app.json`. `Info.plist` holds **hardcoded** version strings, so
  Expo does **not** override them unless someone runs `expo prebuild`.
- `app.json` only reaches the native project via `expo prebuild` (which regenerates `ios/`).
- Therefore **all four version sources are kept in sync** (see table below) so either path — Xcode
  Archive or a future prebuild/EAS build — yields 1.0.2 / 8.

### Version sources (all currently aligned at 1.0.2 / 8)
- `app.json` → `expo.version`, `expo.ios.buildNumber`
- `ios/Circuit41/Info.plist` → `CFBundleShortVersionString`, `CFBundleVersion`
- `ios/Circuit41.xcodeproj/project.pbxproj` → `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` (Debug + Release)

**To bump again next release:** update all of the above together (or bump `app.json` and run
`expo prebuild --clean`, which regenerates the native folder from `app.json`).

---

## Environment / secrets

App reads `EXPO_PUBLIC_*` from `.env` (gitignored). Required keys:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (verified **`pk_live`** = production)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

- **Xcode Archive (local):** reads local `.env` at JS bundle time → no extra setup.
- **EAS Build (cloud):** `.env` is gitignored and **not** uploaded → these must be set as EAS
  environment variables/secrets, or the build ships undefined keys.

---

## 🔴 ANDROID CRASH — BLOCKER #0 (confirmed 2026-06-15)

**Symptom:** Play Internal Testing Android build closes immediately on launch (iOS fine).
**Root cause:** the EAS Android production build had **no `EXPO_PUBLIC_*` env vars** (`.env` is
gitignored → never uploaded; `eas.json` production had no `env`). `lib/supabase.ts` called
`createClient(...)` at import with `process.env...!`, and supabase-js **throws on an empty url/key**
→ crash before the first screen renders.

**Done in code (boot hardening):** `lib/supabase.ts` no longer throws on missing env (placeholder
fallback + loud `console.error`, exports `SUPABASE_ENV_MISSING`); `App.tsx` Stripe key `?? ''`;
Android `colors.xml` splash bg synced to `#F5F9F6`.

**Still REQUIRED — add EAS production env vars, then rebuild + re-upload:**
```bash
eas env:push production --path .env       # add all 5 EXPO_PUBLIC_* (plaintext visibility)
eas env:list production                   # verify
eas build --platform android --profile production
eas submit --platform android --profile production   # or upload .aab to Play Console
```
A **new Google Play internal-testing upload is required** — the crashing build can't be patched in place.

---

## Release blockers / open items

1. **🔴 Android (above):** add EAS production `EXPO_PUBLIC_*` env vars + rebuild + re-upload. Without
   this the Android app still ships keyless (boots but cannot authenticate / reach Supabase).
2. **EAS (both platforms):** same `EXPO_PUBLIC_*` env vars must be present for any cloud build.
3. **`eas submit` (iOS) only:** `eas.json → submit.production.ios.ascAppId` is still
   `YOUR_APP_STORE_CONNECT_APP_ID`. Fill with the App Store Connect numeric app ID. (`appleId` and
   `appleTeamId` are already set.) Not needed for manual Xcode/Transporter upload.
4. **Splash branding (Android, cosmetic):** committed `android/` shows old/default splash; `app.json`
   splash isn't applied without `expo prebuild -p android`. Fix after the crash, in a follow-up build.

TypeScript: `npx tsc --noEmit` → **0 errors**.

---

## Upload — Path A: Xcode Archive (recommended; matches committed native files)

1. `cd ios && pod install`
2. Open `ios/Circuit41.xcworkspace` in Xcode.
3. Scheme `Circuit41`, destination `Any iOS Device (arm64)`, configuration Release.
4. Confirm General tab: Version **1.0.2**, Build **8**.
5. Product → Archive → Distribute App → App Store Connect → Upload.

## Upload — Path B: EAS Build + Submit

1. Resolve blocker #1 (EAS env/secrets).
2. `eas build --platform ios --profile production`
   - `eas.json` has `appVersionSource: "remote"` + production `autoIncrement: true`: EAS tracks the
     build number remotely and auto-increments (last remote build = 7 → next = 8).
3. Resolve blocker #2 (`ascAppId`), then `eas submit --platform ios --profile production`.

---

## Validation commands (re-runnable)

```bash
# version consistency
grep -nE '"version"|"buildNumber"' app.json
grep -A1 "CFBundleShortVersionString\|CFBundleVersion" ios/Circuit41/Info.plist
grep -nE "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/Circuit41.xcodeproj/project.pbxproj
npx expo config --json   # confirm resolved version/ios.buildNumber

# type check
npx tsc --noEmit
```

There is no lint script configured (`package.json` has start/android/ios/web only).
