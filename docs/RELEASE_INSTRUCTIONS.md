# PairUpToday — Multi-Platform Production Release Guide

This document outlines the step-by-step procedures for building, signing, and releasing PairUpToday across all supported production distribution targets:
- **Web App**: `https://pairuptoday.com`
- **Admin Portal**: `https://admin.pairuptoday.com`
- **Android App (Google Play)**: `com.pairuptoday.app`
- **iOS App (Apple App Store / TestFlight)**: `com.pairuptoday.app`

---

## 1. Production Web & Admin Release

### A. Environment Configuration
Ensure `.env` in the server environment contains production credentials:
```bash
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://pairuptoday.com
ADMIN_ORIGIN=https://admin.pairuptoday.com
APITXT_API_KEY=<LIVE_APITXT_KEY>
APITXT_BASE_URL=https://apitxt.com
OTP_HMAC_SECRET=<RANDOM_SECRET_AT_LEAST_32_CHARACTERS>
SESSION_SECRET=<DIFFERENT_RANDOM_SECRET_AT_LEAST_32_CHARACTERS>
BANK_ACCOUNT_ENCRYPTION_KEY=<32_RANDOM_BYTES_AS_64_HEX_CHARACTERS>
SUPABASE_URL=<SUPABASE_PROJECT_URL>
SUPABASE_SERVICE_ROLE_KEY=<SERVER_ONLY_SUPABASE_SERVICE_ROLE_KEY>
RAZORPAY_KEY_ID=<LIVE_RAZORPAY_KEY_ID>
RAZORPAY_KEY_SECRET=<LIVE_RAZORPAY_KEY_SECRET>
RAZORPAY_WEBHOOK_SECRET=<LIVE_RAZORPAY_WEBHOOK_SECRET>
ADMIN_EMAIL=<PREPROVISIONED_ADMIN_EMAIL>
ADMIN_PHONE=<E.164_PHONE_REGISTERED_FOR_MFA>
```

Never put these server secrets in frontend variables, source files, or client bundles. In Cloud Run, use Secret Manager references from [`deploy/cloudrun-api.yaml`](../deploy/cloudrun-api.yaml); grant the runtime service account access only to the referenced secrets.

### B. APITXT OTP and Supabase challenge storage

The backend uses the existing APITXT contract in `server/services/apitxt.ts`: `POST {APITXT_BASE_URL}/api/sendOTP`, form-urlencoded `authkey`, `mobile`, `otp`, `channel=sms`, and `country=91`, with `template_id` omitted. The existing parser recognizes a successful HTTP response with JSON `status: "success"` or `status: 200`; it reads `data.request_id` when present. No independent APITXT API specification is present in this repository, so confirm this contract remains enabled for the APITXT account before production use.

Before deploying:

1. Add the APITXT API key to Secret Manager as `apitxt-api-key`; set `APITXT_BASE_URL` to the account's approved API base URL.
2. Confirm the APITXT account can use the `sendOTP` endpoint with a server-supplied OTP and without `template_id`, and that its SMS route/sender and OTP message configuration are approved.
3. Configure distinct random `OTP_HMAC_SECRET` and `SESSION_SECRET` values, each at least 32 characters, as Secret Manager secrets named `pairuptoday-otp-hmac-secret` and `pairuptoday-session-secret`. Configure `BANK_ACCOUNT_ENCRYPTION_KEY` as 32 random bytes encoded as 64 hexadecimal characters in Secret Manager secret `pairuptoday-bank-account-encryption-key`. Preserve that key for as long as encrypted bank records are retained; rotating it requires a planned re-encryption.
4. Configure the Supabase project URL and server-only service-role key. The operator reports migrations `001` and `002` are already applied; do not rerun them. After a verified backup and schema review, apply only migrations `003`, `004`, `005`, `006`, `007`, and `008`, in that order, using the approved migration process. Migration 008 adds durable rate-limit/session state, refund reservations, sensitive finance MFA, device tokens, booking-specific location consent, scheduled-job idempotency, notification push claims/retries, and settlement/expiry/reminder maintenance. The operator reports migrations 003–008 have not been executed; verify the live migration history before applying.
5. Add Razorpay credentials as Secret Manager secrets named `razorpay-key-id`, `razorpay-key-secret`, and `razorpay-webhook-secret`. Configure Razorpay webhooks for `payment.captured`, `payment.failed`, `refund.processed`, and `refund.failed` at `/api/payments/razorpay/webhook`. Grant the Cloud Run runtime service account Secret Manager access only to the secrets referenced in the service template.

The KYC document buckets are created as private by migration 006; do not make them public or expose object paths in browser responses. The backend returns five-minute signed document URLs only to `SUPER_ADMIN` and `KYC_ADMIN`. Migration 006 has not been executed, so bucket readiness and RPC behavior are not verified. No additional client-side provider secret or environment variable is required for Storage; Supabase service-role access remains backend-only.

User OTP and Admin MFA challenges are HMAC-hashed and stored in Supabase; the challenge RPCs serialize updates and enforce a five-minute expiry, four failed verification attempts, a 60-second resend cooldown, and a maximum of three requests per rolling minute. Admin MFA is sent to the admin account's registered APITXT phone. The local JSON adapter is for local development only and is not accepted for OTP/MFA in `NODE_ENV=production`.

The API authorization inventory and current canonical-database status are in [`final-audit/ROUTE_AUTHORIZATION.md`](final-audit/ROUTE_AUTHORIZATION.md) and [`final-audit/SUPABASE_CANONICAL_DATABASE.md`](final-audit/SUPABASE_CANONICAL_DATABASE.md). The operator reports that only migrations 001 and 002 are applied in Production; this has not been independently queried. Migration 008 supplies the distributed rate-limit RPC required by the global `/api` middleware, so API requests fail closed with 503 until the reviewed migrations are applied in sequence. Do not bypass this control. Production startup requires Supabase, and routes not yet migrated return 503 instead of reading or writing JSON. External providers are not verified and several route groups remain production-blocked; this repository is not production-ready.

### C. Provider, Firebase, and Maps setup still required

- **APITXT:** configure the approved API key/base URL, OTP SMS route and sender/message configuration, and penny-less bank verification product/wallet. Confirm the repository's existing bank endpoint contract and any APITXT IP allowlist requirements with the account owner. Do not send live requests until APITXT enables the account.
- **Razorpay:** create live keys only after account/KYC approval, configure automatic capture so payment lookup reports `captured`, and set the key ID, key secret, and separate webhook secret in Secret Manager. Webhook processing, provider-backed refunds, and reconciliation are implemented in code but have not been verified against a live account.
- **Firebase:** set the exact existing project ID, service-account email, private key, and Realtime Database URL. Deploy [`database.rules.json`](../database.rules.json), which denies direct client reads/writes; the backend uses Admin SDK access after Supabase booking ownership and consent checks. Grant only required RTDB/FCM permissions. Location sharing and presence code is unverified against the live RTDB.
- **Google Maps:** enable the Places Autocomplete, Geocoding, and Distance Matrix APIs needed by the app. Restrict the backend API key to required APIs and server usage; use `GOOGLE_MAPS_API_KEY` only on the backend.
- **Cloud Scheduler and Cloud Run Jobs:** deploy [`deploy/cloudrun-maintenance-job.yaml`](../deploy/cloudrun-maintenance-job.yaml) with the same application image as the API. Create a dedicated scheduler service account with permission to execute this named Cloud Run Job. A 5-minute Scheduler job invokes the Cloud Run Jobs `:run` API using an OAuth access token; the job runner claims an idempotency key before performing maintenance.
- **Secret Manager:** create `firebase-admin-private-key` and `google-maps-api-key` in addition to the Supabase, APITXT, Razorpay, session, OTP-HMAC, and bank-encryption secrets referenced by the Cloud Run template. Replace the Firebase project/email/database URL and Cloud Run URL placeholders before deployment.

### D. Cloud Run API template

[`deploy/cloudrun-api.yaml`](../deploy/cloudrun-api.yaml) is a configuration template, not a deployed service. [`Dockerfile.api`](../Dockerfile.api) builds the API runtime, web bundles, and `maintenance-job.js`. Replace the project, region, repository, image tag, Supabase project URL, Firebase settings, and service-account values after creating the corresponding resources. No deployment or migration was performed by this change.

After the Cloud Run Job is deployed, grant the dedicated scheduler identity the job-execution role and create the recurring maintenance trigger:

```bash
gcloud run jobs replace deploy/cloudrun-maintenance-job.yaml \
  --region="${GCP_REGION}" --project="${GCP_PROJECT_ID}"

gcloud run jobs add-iam-policy-binding pairuptoday-maintenance \
  --member="serviceAccount:${SCHEDULER_SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.jobsExecutor" \
  --region="${GCP_REGION}" --project="${GCP_PROJECT_ID}"

gcloud scheduler jobs create http pairuptoday-maintenance \
  --schedule="*/5 * * * *" --time-zone="UTC" \
  --uri="https://run.googleapis.com/v2/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/pairuptoday-maintenance:run" \
  --http-method=POST --attempt-deadline=60s \
  --oauth-service-account="${SCHEDULER_SERVICE_ACCOUNT_EMAIL}" \
  --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
  --location="${GCP_REGION}" --project="${GCP_PROJECT_ID}"
```

This job runs idempotent membership/booking expiry, 48-hour settlement release, booking-reminder insertion, durable FCM notification delivery retries, rate/session cleanup, and stale booking-location cleanup. Push notifications stop retrying after five recorded failures. It is not configured in a live project.

### E. Building the Client Web Application
```bash
npm run build
# Outputs to /dist
# Deployed via Dockerfile.web or static CDN/reverse proxy to pairuptoday.com
```

### F. Building the Standalone Admin Portal
```bash
npm run build:admin
# Outputs to /dist-admin
# Deployed via Dockerfile.admin or dedicated Nginx container to admin.pairuptoday.com
```

### G. Running the Backend Service
```bash
npm run start
# Runs the Express service; production OTP requires Supabase challenge storage and HMAC-SHA256 validation
```

---

## 2. Android Release (Google Play Store)

Package identifier: `com.pairuptoday.app`  
Source root: `/android`

**Current status:** Capacitor 6.2.1 runtime, Android/iOS platforms, CLI, keyboard, and splash-screen packages are pinned. The repository still lacks the Android root Gradle project, wrapper, `MainActivity`, and referenced resources. Its existing `android/` directory is a partial stub, so `cap add android` refuses to overwrite it. No Android SDK is installed in this environment; native generation/build remains blocked.

### A. Prerequisites
- Android Studio Iguana / Jellyfish or latest
- JDK 17+ installed and `JAVA_HOME` set
- Android SDK 34 installed
- Production Keystore (`pairuptoday-release-key.jks`)

### B. Release Keystore
Obtain the production keystore and credentials through the organization's approved signing process. Do not commit the keystore or filled signing properties to the repository.

### C. Configuring `keystore.properties`
Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the local values using the names shown in the example:
```properties
storeFile=upload-key.jks
storePassword=REPLACE_WITH_LOCAL_SECRET
keyAlias=REPLACE_WITH_LOCAL_ALIAS
keyPassword=REPLACE_WITH_LOCAL_SECRET
```
The signing file and keystore are ignored by version control. The Android Gradle project and wrapper are not present yet, so the commands below are not currently runnable from this repository.

### D. Syncing Web Assets with Capacitor
```bash
npm run build
npx cap sync android
```

### E. Generating Android App Bundle (AAB) for Google Play
```bash
cd android
./gradlew bundleRelease
```
The production `.aab` file will be generated at:
`android/app/build/outputs/bundle/release/app-release.aab`

### F. Generating Standalone Signed APK (for direct enterprise distribution)
```bash
cd android
./gradlew assembleRelease
```
The signed `.apk` file will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

### G. Google Play Console Submission
1. Open Google Play Console -> PairUpToday (`com.pairuptoday.app`).
2. Navigate to **Production** -> **Create new release**.
3. Upload `app-release.aab`.
4. Fill in release notes in English, Bengali, and Hindi.
5. Review permissions: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
6. Submit release for review.

---

## 3. iOS Release (Apple App Store & TestFlight)

Bundle identifier: `com.pairuptoday.app`  
Source root: `/ios`

**Current status:** Capacitor 6.2.1 packages are pinned, but the Xcode project is missing. The existing `ios/` directory is a partial stub, so the Capacitor CLI refuses to overwrite it. Generate and validate the native project on macOS with Xcode while preserving the existing plist, entitlements, and signing example before following the steps below.

### A. Prerequisites
- macOS Sonoma or Sequoia with Xcode 15+
- Active Apple Developer Account with PairUpToday Team membership
- Provisioning Profile for `com.pairuptoday.app`
- A generated Capacitor iOS Xcode project; the current repository contains only plist/entitlement/signing placeholders.

### B. Syncing Web Assets to iOS
```bash
npm run build
npx cap sync ios
```

### C. Opening Project in Xcode
```bash
npx cap open ios
```
Or open `/ios/App/App.xcworkspace` in Xcode.

### D. Configuring Signing & Capabilities
1. In Xcode, select the **App** project target.
2. Select **Signing & Capabilities**.
3. Check **Automatically manage signing** and select your Team.
4. Verify Bundle Identifier is `com.pairuptoday.app`.
5. Verify Info.plist permission strings:
   - `NSCameraUsageDescription`: "PairUpToday requires camera access for identity verification and profile photos."
   - `NSLocationWhenInUseUsageDescription`: "PairUpToday uses your location to discover nearby companions and verify arrival at meeting locations."
   - `NSPhotoLibraryUsageDescription`: "PairUpToday requires photo library access to upload profile pictures and verification documents."

### E. Archiving and Uploading to TestFlight
1. In Xcode, set active scheme destination to **Any iOS Device (arm64)**.
2. Select menu **Product** -> **Archive**.
3. When Xcode Organizer opens, select the latest archive and click **Distribute App**.
4. Choose **App Store Connect** -> **Upload**.
5. Keep default strip symbols and upload options checked.
6. Click **Upload** to send the build to App Store Connect.
7. Wait 10-15 minutes for processing in App Store Connect.
8. Add internal/external testers in TestFlight or submit for App Store review.

---

## 4. Emergency Response & Hotlines Verification
- Indian Police: `100` (Direct Emergency Dispatcher)
- National Emergency SOS: `112` (Unified Pan-India Hotline)
- Dedicated Admin Escalation Contact: use the organization's approved, provisioned contact.
- Dedicated Admin Email: use the organization's approved, provisioned address.
