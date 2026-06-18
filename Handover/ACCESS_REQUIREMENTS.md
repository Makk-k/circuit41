# Circuit 41 — Access Requirements

_For the incoming technical owner. **No secrets are listed here** — only the service, its purpose,
and the access level needed. Credentials/keys are transferred out-of-band (password manager / secure
share), never in git._

---

## Core platforms

| Service | Purpose | Required access level |
|---------|---------|-----------------------|
| **GitHub** — `github.com/Makk-k/circuit41` (mobile app repo) | Source code, history, PRs, releases | **Write/Maintain** (Admin to manage settings/secrets/branch protection). Also locate + get access to the **Ops Tool** repo (separate). |
| **Supabase** — project `ovowxxiyxjsntowwnxso` | Database, Auth, Storage, Edge Functions, RLS, migrations (shared with Ops Tool) | **Owner/Admin** on the Supabase org/project (to run migrations, manage functions, view logs, manage env/secrets for edge functions) |
| **Expo / EAS** — org `circuit40s` (`expo.dev/accounts/circuit40s`), project `22a7a2e4-4ee9-4d30-919b-01c687e3bd95` | Builds, submissions, EAS env vars, credentials | **Owner/Admin** member of the `circuit40s` org |
| **Google Play Console** — `com.circuit40s.circuit41` | Android release, internal testing, store listing, App Signing | **Admin** (or release-manager with build upload + production release) |
| **App Store Connect** — `com.circuit40s.circuit41app` (Apple Team `7B3AQARYKN`) | iOS release, TestFlight, store listing | **App Manager / Admin** |
| **Apple Developer Program** — Team `7B3AQARYKN` | Certificates, provisioning, Sign-in-with-Apple key | **Admin** (or membership with certificate/identifier management) |
| **Stripe** | Payments (live mode); publishable + secret keys, Google Pay/merchant config | **Admin / Developer** (to manage API keys, webhooks, products) |

## Identity / OAuth providers

| Service | Purpose | Required access level |
|---------|---------|-----------------------|
| **Google Cloud Console** (OAuth clients) | Google Sign-In Web + iOS + **Android** OAuth clients (Android client must match package + release SHA fingerprints) | **Editor/Owner** on the GCP project holding the OAuth consent screen + clients |
| **Sign in with Apple** (Apple Developer) | Service ID `com.circuit40s.auth`, auth key (`AuthKey.p8`) used by `generate-apple-secret.js` for Supabase Apple auth | Covered by Apple Developer admin above |

## Supporting / production systems

| Service | Purpose | Required access level |
|---------|---------|-----------------------|
| **Android upload keystore** (`*.jks`) | Signs the Android app bundle (currently a local `@makk55__circuit41.jks`; gitignored) | Secure handover of the keystore **+ its password**, OR confirm EAS-managed signing / Google Play App Signing |
| **Domain / privacy-policy hosting** | Privacy policy + terms URLs required by both stores | Access to wherever those pages are hosted |
| **Email for store accounts** | `abdulkarymmay@gmail.com` is the Apple ID on `eas.json` submit config; confirm the company account to use | Access to the account used for store communications |

---

## Notes for the incoming owner

- **Secrets to receive out-of-band** (not in repo): `.env` (5 `EXPO_PUBLIC_*` values), `AuthKey.p8`
  (Apple), `GoogleService-Info.plist`, the Google OAuth `client_*.plist`, the Android keystore
  (`*.jks`) + password, Stripe live keys, and the Supabase service-role key.
- After gaining EAS access, the **first task** is to set the EAS production env vars (the Android
  crash blocker) — see `Handover/RELEASE_STATUS.md`.
- Confirm the **Expo project transfer** from `makk55` (personal) to the `circuit40s` org, then flip
  `app.json owner`.
- Confirm whether the **Android signing key** is EAS-managed or the local keystore is the upload key
  (run `eas credentials -p android`).
