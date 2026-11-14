# PairUpToday — External Production Tasks & Owner Action Checklist

**Date:** 2026-11-13  
**Project Root:** `C:\Users\ADMIN\Downloads\pairup-today-ai-2ai`  
**Purpose:** Comprehensive inventory of all production tasks that **cannot be executed from local source code alone** and require project owner action, external provider configuration, credential provisioning, or live approval.

> [!CAUTION]
> **Zero Secrets in Chat:** Never paste live production API keys, service role keys, or database passwords into chat or unencrypted files. All production secrets must be provisioned directly via **Google Cloud Secret Manager** or the relevant provider dashboards.

---

## External Tasks Inventory

| Task # | Domain / Platform | Action Required | Responsible Party | Required Credentials / Scope | Launch Blocking? |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **01** | **Supabase Database** | Create production Supabase project in `ap-south-1` (Mumbai) and execute migrations `001` through `008`. | Project Owner | Supabase Dashboard / SQL Editor access | **YES** |
| **02** | **Supabase Storage & RLS** | Verify Row Level Security is active and create private storage buckets (`kyc-documents`, `profile-photos`) with signed URL access. | Project Owner | Supabase Storage Dashboard | **YES** |
| **03** | **APITXT SMS Gateway** | Fund APITXT wallet, obtain live `APITXT_API_KEY`, register DLT sender ID / headers, verify SMS delivery to real Indian phone numbers. | Project Owner | APITXT Account & DLT registration | **YES** |
| **04** | **Razorpay Live Setup** | Switch Razorpay account to Live mode, obtain `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. | Project Owner | Razorpay Live Dashboard | **YES** |
| **05** | **Razorpay Webhooks** | Configure Webhook URL `https://pairuptoday.com/api/payments/razorpay/webhook` with events `order.paid`, `payment.captured`, `payment.failed`, and generate `RAZORPAY_WEBHOOK_SECRET`. | Project Owner | Razorpay Settings -> Webhooks | **YES** |
| **06** | **Bank Account Verification** | Activate penny-less bank account verification API on APITXT. | Project Owner | APITXT Banking Services | **YES** |
| **07** | **Firebase RTDB & FCM** | Create Firebase Project (`pairuptoday-prod`), generate Service Account JSON for backend admin SDK, configure RTDB in `asia-southeast1`, and deploy `database.rules.json`. | Project Owner | Firebase Console / Google Cloud IAM | **YES** |
| **08** | **Google Maps Platform** | Enable Places API, Geocoding API, Distance Matrix API; link billing; restrict API key to Google Cloud Run backend IP / service. | Project Owner | Google Cloud Console -> Maps Platform | **YES** |
| **09** | **Google Cloud Run Deployment** | Build production container from [`Dockerfile.api`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/Dockerfile.api) and deploy to Cloud Run service `pairuptoday-api` in `asia-south1`. | Developer & Owner | GCP Artifact Registry & Cloud Run | **YES** |
| **10** | **GCP Secret Manager** | Provision production secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `APITXT_API_KEY`, etc.) in Secret Manager and grant Secret Accessor role to Cloud Run service account. | Project Owner | GCP Secret Manager | **YES** |
| **11** | **DNS, Domain & SSL** | Configure DNS A/CNAME records for `pairuptoday.com` and `admin.pairuptoday.com` pointing to Cloud Run / Firebase Hosting / Load Balancer; verify SSL certificates. | Project Owner | DNS Registrar (Cloudflare, GoDaddy, etc.) | **YES** |
| **12** | **Scheduled Job (Cloud Scheduler)** | Deploy Cloud Run Job from `maintenance-job.js` and schedule via Cloud Scheduler to run every 15 minutes (`*/15 * * * *`). | Developer & Owner | GCP Cloud Scheduler | **YES** |
| **13** | **Monitoring & Alerting** | Configure Google Cloud Monitoring alerts for HTTP 5xx spikes, error logs, and low APITXT SMS balance notification. | Project Owner | GCP Cloud Monitoring | **NO (Post-launch)** |
| **14** | **Initial Admin User Creation** | Seed the initial `SUPER_ADMIN` account with verified email, authorized Indian phone number, and strong password in Supabase `admin_users` table. | Project Owner | Supabase Table Editor | **YES** |
| **15** | **Real-Device Acceptance Testing** | Conduct end-to-end user journeys on physical Android, iOS, and Web devices (Client booking, OTP verification, payment, companion arrival). | Developer & Owner | Physical Mobile Devices & Test Cards | **YES** |

---

## Detailed Task Workflows

### Task 01 & 02: Supabase Canonical Database & Private Storage
1. Navigate to [Supabase Console](https://supabase.com/dashboard).
2. Create project `pairuptoday-prod` in region `ap-south-1` (Mumbai).
3. In SQL Editor, execute the SQL files in exact order:
   - [`supabase/migrations/001_initial_schema.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/001_initial_schema.sql)
   - [`supabase/migrations/002_rls_policies.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/002_rls_policies.sql)
   - [`supabase/migrations/003_auth_otp_challenges.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/003_auth_otp_challenges.sql)
   - [`supabase/migrations/004_admin_mfa_challenges.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/004_admin_mfa_challenges.sql)
   - [`supabase/migrations/005_canonical_business_data.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/005_canonical_business_data.sql)
   - [`supabase/migrations/006_profile_kyc_storage.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/006_profile_kyc_storage.sql)
   - [`supabase/migrations/007_booking_payment_transactions.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/007_booking_payment_transactions.sql)
   - [`supabase/migrations/008_runtime_finance_and_delivery.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/008_runtime_finance_and_delivery.sql)
4. In Storage -> Buckets:
   - Create bucket `kyc-documents` (Private).
   - Create bucket `profile-photos` (Public read for approved avatars, Private for raw submissions).
5. Verification: Check that table count matches 23 tables, RLS is active on all tables, and database functions compile without errors.

---

### Task 03 & 06: APITXT SMS & Banking Activation
1. Sign in to [APITXT Portal](https://apitxt.com).
2. Complete DLT registration for entity and SMS header.
3. Fund wallet balance with adequate credits.
4. Retrieve live API key.
5. In Banking section, verify Penny-less account verification is enabled.
6. Verification: Execute a single test curl command from a secure shell to confirm HTTP 200 response.

---

### Task 04 & 05: Razorpay Gateway & Webhooks
1. Sign in to [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Complete business KYC verification to enable Live mode.
3. Generate Live API Key ID (`rzp_live_...`) and Secret.
4. Go to Settings -> Webhooks -> Add New Webhook:
   - Webhook URL: `https://pairuptoday.com/api/payments/razorpay/webhook`
   - Secret: Generate a 32+ character random string (`RAZORPAY_WEBHOOK_SECRET`).
   - Events:
     - `order.paid`
     - `payment.authorized`
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`
5. Verification: Trigger test webhook from Razorpay dashboard and confirm backend returns HTTP 200.

---

### Task 07: Firebase Configuration
1. In Firebase Console, create project `pairuptoday-prod`.
2. Enable Realtime Database (Location: `asia-southeast1`).
3. Deploy rules from [`database.rules.json`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/database.rules.json) (`.read: false`, `.write: false` to force all access through backend Admin SDK).
4. In Project Settings -> Service Accounts -> Generate New Private Key -> Save service account JSON safely for Cloud Run Secret Manager.

---

### Task 08: Google Maps Platform
1. In Google Cloud Console, enable:
   - Places API (New)
   - Geocoding API
   - Distance Matrix API
2. Create API Key `pairuptoday-maps-backend`.
3. Restrict key to backend server IP / HTTP referrer if applicable, and restrict API usage to the 3 enabled APIs.

---

### Task 09 & 10: Cloud Run & Secret Manager
1. In Google Cloud Secret Manager, create the required secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OTP_HMAC_SECRET` (generate random 32+ chars)
   - `SESSION_SECRET` (generate random 32+ chars)
   - `BANK_ACCOUNT_ENCRYPTION_KEY` (generate random 32 chars)
   - `APITXT_API_KEY`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_DATABASE_URL`
   - `GOOGLE_MAPS_API_KEY`
2. Grant `roles/secretmanager.secretAccessor` to the Cloud Run service account.
3. Deploy Cloud Run service `pairuptoday-api` via [`deploy/cloudrun-api.yaml`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/deploy/cloudrun-api.yaml).

---

### Task 11: Domain & Subdomain Routing
1. In DNS Management (Cloudflare / Route53 / Namecheap):
   - `pairuptoday.com` -> Points to Cloud Run custom domain mapping / CDN.
   - `admin.pairuptoday.com` -> Points to Cloud Run custom domain mapping.
2. Confirm SSL certificates are issued and active (HTTPS enforced).
