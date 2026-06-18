# Circuit 41 — Release Status

_Snapshot: 2026-06-18. Single-page status of where each release stands. Items marked "verify" need
confirmation in the relevant console (the current owner has that access; see
`Handover/ACCESS_REQUIREMENTS.md`)._

---

## Version

| | Value |
|---|---|
| Marketing version | **1.0.2** |
| iOS build number (`CFBundleVersion`) | **8** |
| Android `versionName` | 1.0.2 |
| Android `versionCode` (committed native) | 1 (EAS `autoIncrement` manages cloud build number) |
| EAS project | `22a7a2e4-4ee9-4d30-919b-01c687e3bd95` |

---

## Android release status

- **Build:** an EAS production Android `.aab` build **completed and was uploaded** to Google Play.
- **🔴 BLOCKING DEFECT:** the uploaded build **crashes immediately on launch** when installed from
  Play Internal Testing. **Diagnosed root cause:** the EAS build was produced **without the
  `EXPO_PUBLIC_*` environment variables**, so the Supabase client threw at boot (see
  `RELEASE_HANDOFF.md` / `TECHNICAL_HANDOVER.md` §9).
- **Status:** code hardened so it no longer hard-crashes, **but a new build with the env vars set is
  required** — the crashing artifact cannot be patched in place.
- **Native config note:** Android splash still shows old/default branding (cosmetic, not the crash).

## iOS release status

- **Build 1.0.2 / build 8** builds and **runs on device from a local Xcode build** (working).
- **App Store Connect** already has **build 7** uploaded.
- Several JS-only polish changes have landed since build 8 was set but are **not yet in an uploaded
  binary** (see `RELEASE_HANDOFF.md`). Cutting a new binary requires bumping the build number (→ 9).
- No iOS crash reported.

## Play Console status

- App created and an `.aab` uploaded to the **Internal Testing** track (build present but crashing).
- **Verify / complete:** Data Safety form, privacy policy URL, content rating questionnaire,
  screenshots, app category, and tester list for internal testing.
- **Verify:** Google Play App Signing enrollment and the upload key (a local `@makk55__circuit41.jks`
  exists on the owner's machine — gitignored; confirm whether it is the canonical upload key or
  whether EAS-managed credentials are used).

## App Store Connect status

- App record exists; **build 7** is uploaded.
- **Verify:** TestFlight internal/external testing state, and capture the **numeric App Store Connect
  app ID** to fill `eas.json → submit.production.ios.ascAppId` if using `eas submit`.

## Internal Testing status

- **Android:** active but blocked by the launch crash → re-upload required after env-var fix.
- **iOS:** TestFlight state to be confirmed in App Store Connect.

## Current crash investigation status

- **CLOSED — root cause identified.** Missing EAS production `EXPO_PUBLIC_*` env vars →
  `lib/supabase.ts` `createClient()` threw at module load → crash before first render.
- **Code mitigation shipped in repo:** `lib/supabase.ts` placeholder fallback +
  `SUPABASE_ENV_MISSING`; `App.tsx` Stripe key `?? ''`. Prevents the hard crash even if a future build
  is misconfigured.
- **Outstanding to actually resolve on-device:** set the EAS env vars and rebuild (below).
- To confirm on the existing crashing build, run while launching:
  `adb logcat | grep -iE "supabaseUrl is required|ReactNativeJS|AndroidRuntime|FATAL"`.

---

## Next release steps (in order)

1. **EAS env vars:** `eas env:push production --path .env` → `eas env:list production` (expect 5 vars).
2. **Confirm Expo org migration:** verify project `22a7a2e4-…` is under `circuit40s`; update
   `app.json owner` to `circuit40s`.
3. **Rebuild Android:** `eas build -p android --profile production` (autoIncrements build number).
4. **Re-upload Android** to Play Internal Testing (`eas submit -p android --profile production` or
   manual `.aab` upload). Re-test launch on a real device.
5. **iOS (when ready):** bump build → 9 across the three version sources, then Xcode Archive (proven)
   or EAS build + submit (fill `ascAppId` first).
6. **Complete Play Console listing** requirements (Data Safety, privacy, rating, screenshots).
7. Smoke test per the checklist in `ANDROID_RELEASE_HANDOFF.md`.
