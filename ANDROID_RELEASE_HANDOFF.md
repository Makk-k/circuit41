# Circuit 41 — Android Release Handoff

_Last updated: 2026-06-15 — Android release-readiness pass._

This document covers the Google Play release path for the existing Expo/React Native app. No new
codebase, schema, ticketing, archive, payment, or workflow redesign was introduced.

## Release target

| Item | Value |
|------|-------|
| App name | Circuit 41 |
| Expo version | 1.0.2 |
| Android package/application ID | `com.circuit40s.circuit41` |
| Android native versionName | 1.0.2 |
| Android native versionCode | 1 |
| EAS project ID | `22a7a2e4-4ee9-4d30-919b-01c687e3bd95` |
| EAS owner | `makk55` |

## Production configuration

- `eas.json` production Android builds are configured as Play Store bundles with
  `build.production.android.buildType = "app-bundle"`.
- Required public app env vars are loaded from `.env` locally:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- For EAS cloud builds, set the same `EXPO_PUBLIC_*` values as EAS environment variables/secrets;
  `.env` is gitignored and is not uploaded automatically.
- Android uses package `com.circuit40s.circuit41`; Google OAuth Android client configuration must
  match this package and the release signing SHA-1/SHA-256 fingerprints.

## Android-specific fixes made

- Removed unused Android microphone/overlay permissions from Expo config and committed native
  manifest output.
- Configured production Android EAS builds to generate an `.aab`.
- Aligned app/package/native Android version display to `1.0.2`.
- Changed Google Pay to use Stripe test mode only in development (`__DEV__`), so production builds
  do not request `testEnv`.
- Fixed app TypeScript validation issues in Google Sign-In nonce typing and the orphaned Tools
  screen route type.
- Excluded Supabase Edge Functions from the Expo app TypeScript check because those files target
  Deno, not the React Native runtime.

## Validation performed

```bash
npx expo config --type public
npx tsc --noEmit
npx expo install --check
PATH=/Users/makk/.nvm/versions/node/v24.14.1/bin:$PATH npx expo prebuild --platform android --no-install
./android/gradlew -p android :app:assembleRelease
```

Results:

- Expo config resolves successfully and confirms Android package `com.circuit40s.circuit41`.
- TypeScript app validation passes after separating Deno Edge Functions from the app check.
- Expo/RN SDK dependencies were aligned with `npx expo install --fix`; `npx expo install --check`
  now reports `Dependencies are up to date`.
- Expo prebuild for Android completes and reuses the committed `android/` directory.
- Local Gradle release assembly is blocked on this machine because no Java Runtime is installed.
- EAS login is valid as `makk55`; `eas build:list --platform android` shows no prior Android builds.
- `npm audit --omit=dev --audit-level=high` passes; 11 moderate transitive findings remain and
  require `npm audit fix --force` / breaking Expo package changes, so they were not force-applied.

## Remaining Play Store blockers

1. Install/configure a JDK locally or run an EAS cloud Android build to prove native compilation.
2. Verify EAS Android credentials/app signing for package `com.circuit40s.circuit41`.
3. Create/verify the Google OAuth Android client for package `com.circuit40s.circuit41` with the
   release signing certificate fingerprints.
4. Verify Stripe Google Pay production settings, merchant name, and publishable key before release.
5. Decide whether the remaining moderate `uuid`/Expo tooling audit findings justify a breaking
   `npm audit fix --force`; not force-applied during this release-readiness pass.
6. Complete Play Console Data Safety, privacy policy, content rating, screenshots, app category, and
   internal testing setup.

## Build commands

Use EAS for the release artifact:

```bash
npx eas whoami
npx eas credentials -p android
npx eas build -p android --profile production
```

For local native validation after installing a JDK:

```bash
npx expo prebuild --platform android --no-install
./android/gradlew -p android :app:assembleRelease
```

For Play upload:

```bash
npx eas submit -p android --profile production
```

If `eas submit` is not configured yet, download the `.aab` from EAS and upload it manually to the
Google Play Console internal testing track first.

## Android smoke test checklist

- Sign in with Google and email/password.
- Confirm Apple Sign-In does not block Android users when unavailable.
- Create, view, archive, and unarchive shipments.
- Open shipment details, documents, costs, events, and support tickets.
- Upload shipment images, documents, and bank-transfer proof.
- Start checkout with saved/new card paths and verify Google Pay availability on a production build.
- Confirm Supabase-backed dashboard, shipment, ticket, profile, and archive reads/writes obey RLS.
