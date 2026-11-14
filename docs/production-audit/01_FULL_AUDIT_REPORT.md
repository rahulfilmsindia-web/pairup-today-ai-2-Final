# PairUpToday — A–Z Technical, Security, Database, Business-Logic, API & Integration Audit Report

**Date:** 2026-11-13  
**Audited Canonical Root:** `C:\Users\ADMIN\Downloads\pairup-today-ai-2ai`  
**Application Classification:** Companion Service Platform (Strictly NOT a taxi, transport, or ride-hailing application)  
**Execution Environment:** Node.js (v20+), Express, React 19, Vite, TypeScript, Supabase PostgreSQL, Firebase RTDB/FCM, Razorpay, APITXT SMS, Google Maps  

---

## 1. Executive Summary

This report presents the evidence-based findings of the comprehensive Phase 1 (Local Project Inspection) and Phase 2 (A–Z Technical and Business Audit) performed directly on the confirmed local project root `C:\Users\ADMIN\Downloads\pairup-today-ai-2ai`.

The existing codebase implements an advanced Companion Service Platform architecture with strong domain boundaries, strict cryptographic verifications (HMAC-SHA256, scrypt), enforced 15% platform / 85% companion commission splits, mandatory 48-hour settlement locks, integer paise accounting, and a 33-scenario automated verification suite.

However, the audit revealed a **Critical Production Blocker**: multiple core Admin Portal management and overview API routes in `server.ts` completely bypass the canonical Supabase database adapter and read/write to legacy in-memory/JSON store (`db.*`). Furthermore, because these routes were omitted from the production route whitelist `isSupabaseBackedProductionRoute()`, any deployment to Google Cloud Run (`NODE_ENV=production`) actively causes the entire Admin Portal dashboard (`admin.pairuptoday.com`) to fail immediately with **HTTP 503 Service Unavailable**.

---

## 2. Blueprint & Architectural Alignment

| Component | Target Blueprint | Existing Implementation | Audit Finding |
| :--- | :--- | :--- | :--- |
| **Domain Identity** | Companion Service Platform | 24 defined companion services ([`src/constants/services.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/src/constants/services.ts)) | **COMPLIANT**: Strictly companionship; no taxi/ride-hailing terms. Initial seed companion profiles protected. |
| **Primary Database** | Supabase PostgreSQL | Migrations `001` through `008` in [`supabase/migrations/`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/) | **PARTIAL / DEFECT IDENTIFIED**: User auth, OTP, KYC, booking reservations, refunds, and rate-limits use Supabase, but Admin analytics, client list, companion list, memberships, bookings list, payments, and staff routes fall back to local JSON memory. |
| **Realtime Transport** | Firebase Realtime Database | [`server/services/firebase.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/firebase.ts) | **COMPLIANT**: Scoped booking location sharing, presence tracking, automatic TTL cleanup. Does NOT compete with Supabase business tables. |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | [`server/services/fcm.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/fcm.ts) & [`server/jobs/maintenance.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/jobs/maintenance.ts) | **COMPLIANT**: Concurrency-safe queueing (`SKIP LOCKED`), dead-token deletion, durable push status tracking. |
| **SMS Gateway** | APITXT | [`server/services/apitxt.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/apitxt.ts) | **COMPLIANT**: 6-digit OTP delivery with `template_id` strictly omitted per APITXT spec; penny-less bank account verification; no mock success in absence of credentials. |
| **Payment Gateway** | Razorpay | [`server/services/razorpay.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/razorpay.ts) | **COMPLIANT**: Constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`); server-side order generation; webhook verification; zero hardcoded fallback secrets. |
| **Location / Mapping** | Google Maps Platform | [`server/services/googlemaps.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/googlemaps.ts) | **COMPLIANT**: All Places autocomplete, geocode, reverse-geocode, and distance matrix calls run isolated on backend; frontend key exposure prevented; rate limits enforced. |
| **Admin Portal** | Separate Subdomain (`admin.pairuptoday.com`) | [`src/admin/AdminPortal.tsx`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/src/admin/AdminPortal.tsx), [`vite.admin.config.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/vite.admin.config.ts) | **COMPLIANT UI / BLOCKED API**: Separate bundle build exists (`dist-admin/admin.html`); exact 5 admin roles enforced; SMS MFA enforced; but API routes blocked by 503 whitelist bug. |
| **Scheduled Tasks** | Cloud Run Jobs | [`server/jobs/maintenance.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/jobs/maintenance.ts), [`deploy/cloudrun-maintenance-job.yaml`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/deploy/cloudrun-maintenance-job.yaml) | **COMPLIANT**: Distributed idempotency locking via `public.scheduled_job_runs`, expired location cleanup, push processing. |

---

## 3. Business Rules & Financial Integrity Audit

1. **Commission Split (15% Platform / 85% Companion):**
   - Verified in database migration [`007_booking_payment_transactions.sql`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/007_booking_payment_transactions.sql#L85-L89):
     ```sql
     v_admin_platform_fee_paise := FLOOR(v_booking_amount_paise * 15 / 100);
     v_companion_net_share_paise := v_booking_amount_paise - v_admin_platform_fee_paise;
     ```
   - Verified in [`tests/production-readiness.test.ts#L433`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/tests/production-readiness.test.ts#L433) (Scenario 14).
   - Integrity confirmed: Exact integer paise arithmetic, rounding differences assigned to companion share.

2. **Delay Penalty Formula:**
   - Formula: `(Booking Amount / Slot Minutes) × Delay Minutes`.
   - Verified in SQL function `public.verify_booking_otp` ([`007_booking_payment_transactions.sql#L330-L335`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/007_booking_payment_transactions.sql#L330-L335)) and verified in Scenario 15 test.
   - Result deducted from companion net share before settlement.

3. **48-Hour Settlement Escrow Lock:**
   - Companion earnings are locked in `LOCKED_ESCROW` status for at least 48 hours post-completion.
   - Verified in SQL query `WHERE b.status = 'COMPLETED' AND b.completed_at <= NOW() - INTERVAL '48 hours'`.
   - Companions cannot withdraw funds directly; payouts are strictly manual and controlled by `FINANCE_ADMIN` / `SUPER_ADMIN`.

4. **Membership Fee Rules:**
   - Clients are 100% FREE (never charged membership).
   - Authoritative Companion Membership tiers:
     - `STARTER`: ₹449 (44,900 paise, 30 days)
     - `PROFESSIONAL`: ₹1,099 (109,900 paise, 90 days)
     - `PREMIUM`: ₹5,999 (599,900 paise, 365 days)
   - Membership fees are platform revenue and never credited to Companion wallets. Enforced server-side ([`server.ts#L2413-L2423`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L2413-L2423)).

---

## 4. Booking Lifecycle Audit

| Step | Blueprint Requirement | Code Implementation | Security / Integrity Finding |
| :--- | :--- | :--- | :--- |
| **1. Service Selection** | Client selects service, duration (1-24h), date, time, location | Validated in [`server.ts#L2955-L2980`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L2955-L2980) | **PASS**: Validates date format, start/end minutes, strictly prevents past dates. |
| **2. Availability Check** | Companion must not have overlapping confirmed bookings | Enforced via `public.reserve_booking_payment` in [`007_booking_payment_transactions.sql#L65-L84`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/supabase/migrations/007_booking_payment_transactions.sql#L65-L84) | **PASS**: Transactional reservation table `public.booking_slot_reservations` with exclusion checks prevents race conditions. |
| **3. Razorpay Order** | Server-side order creation tied to booking | [`server.ts#L3008-L3016`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L3008-L3016) | **PASS**: Order receipt and notes linked to unique `bookingCode`. |
| **4. Payment Verification** | Cryptographic HMAC signature check before confirming booking | Handled in [`server.ts#L2454-L2540`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L2454-L2540) via `public.finalize_razorpay_payment` | **PASS**: Front-end confirmation is never trusted; payment order status checked; double payment prevented. |
| **5. OTP Confidentiality** | Start & Completion OTPs generated on server, never revealed to Companion | Handled in [`server.ts#L3038-L3050`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L3038-L3050) | **PASS**: Start and completion OTPs are sanitized/deleted from companion responses. Client receives OTP in their booking dashboard. |
| **6. Companion Arrival** | Companion marks arrival; status changes to `COMPANION_ARRIVED` | Handled via `public.mark_booking_companion_arrived` ([`server.ts#L3071`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L3071)) | **PASS**: Enforces companion ownership and booking state. |
| **7. OTP Verification** | Companion enters Start OTP; server verifies HMAC hash | Handled via `public.verify_booking_otp` ([`server.ts#L3110`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L3110)) | **PASS**: Max attempts bounded; rate-limited; delay penalties calculated. |
| **8. Completion & Lock** | Client provides Completion OTP; booking marked `COMPLETED` | Handled via `public.verify_booking_otp(..., 'COMPLETION')` | **PASS**: Wallet ledger entry created with `LOCKED_ESCROW` status; 48-hour lock timer begins. |

---

## 5. Security & Authentication Audit

1. **Password Hashing:**
   - Uses versioned `scrypt$` hashing (`crypto.scryptSync`) with 32-byte cryptographically secure salts.
   - Transparent upgrade path supported for legacy SHA-256 hashes ([`server/services/passwords.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/passwords.ts)).
   - Password minimum length (12 characters for Admin, 8 for Users) strictly enforced.

2. **Session Security & IDOR:**
   - Authenticated sessions use cryptographically random 32-character tokens signed with `SESSION_SECRET`.
   - Token revocation table `public.session_revocations` queried on every authenticated request.
   - User identity is extracted from verified bearer token `(req as AuthenticatedRequest).authUser.id`.
   - Request body `userId`, `clientId`, and `senderId` are strictly overwritten by the server session ID ([`server.ts#L1553-L1560`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L1553-L1560)), preventing IDOR and privilege escalation.

3. **Admin SMS Multi-Factor Authentication (MFA):**
   - Step 1: Admin logs in with Email + Password.
   - Step 2: System sends 6-digit SMS OTP to admin's registered phone via APITXT.
   - Step 3: Admin enters SMS OTP to obtain high-privilege bearer session.
   - Re-auth MFA required for high-risk operations (revealing full unmasked bank account numbers or approving payouts).
   - Exact 5 admin roles supported: `SUPER_ADMIN`, `KYC_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, `AUDITOR`.

4. **Rate Limiting & Security Headers:**
   - Distributed rate limiting via `public.consume_api_rate_limit`:
     - Global: 180 requests/min per IP
     - Auth: 15 requests/min per IP
     - Maps search: 10 requests/min per IP
   - Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and strict CORS whitelist.

---

## 6. Database & Supabase Integration Audit

### Migration Files Verified:
1. `001_initial_schema.sql` (14.8 KB) — Canonical business tables: `users`, `kyc_submissions`, `companion_profiles`, `companion_memberships`, `bank_verifications`, `bookings`, `wallet_ledger`, `payouts`, `chat_conversations`, `chat_messages`, `support_conversations`, `support_messages`, `admin_users`, `admin_mfa_store`, `audit_logs`, `notifications`, `payment_webhook_events`.
2. `002_rls_policies.sql` (2.95 KB) — RLS policies for table security.
3. `003_auth_otp_challenges.sql` (6.56 KB) — Challenge rate limiting and OTP storage.
4. `004_admin_mfa_challenges.sql` (6.62 KB) — Admin SMS MFA challenge lifecycle.
5. `005_canonical_business_data.sql` (11.1 KB) — Production schema hardening & view definitions.
6. `006_profile_kyc_storage.sql` (10.2 KB) — KYC review function, role-specific KYC separation, companion activation 3-gate trigger.
7. `007_booking_payment_transactions.sql` (18.4 KB) — Slot reservation, double-booking prevention, Razorpay payment finalization, arrival and OTP verification functions.
8. `008_runtime_finance_and_delivery.sql` (37.5 KB) — Payouts, refunds, webhook deduplication, FCM push queue (`SKIP LOCKED`), and scheduled maintenance.

### Critical Discrepancy Found:
`SupabaseDatabaseAdapter` in [`server/services/database.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/database.ts) implements complete methods for `listUsers`, `listCompanionProfiles`, `listMemberships`, `listBookings`, `listAdminUsers`, `createAdminUser`, and `listAuditLogs`. However, the route handlers in `server.ts` for Admin Overview, Clients, Companions, Memberships, Bookings, Payments, Staff, and Audit Logs were left directly accessing the local JSON state `db.*`. This causes severe database bifurcation in staging and fatal 503 errors in production.

---

## 7. Frontend, Admin & Mobile Audit

1. **User Application:**
   - React 19 + Tailwind CSS + Lucide Icons.
   - Complete pages: Home, Hero, Services Grid (24 services), Companion Discovery, About, How It Works, Safety & Trust, Client Dashboard, Companion Dashboard.
   - Modals: Auth Gateway (Login / Signup), KYC Wizard (Client / Companion), Role Selection Modal.
   - Tested responsive layout, mobile meta viewport, zero horizontal overflow.

2. **Admin Portal:**
   - Located at [`src/admin/AdminPortal.tsx`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/src/admin/AdminPortal.tsx).
   - Dedicated build config [`vite.admin.config.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/vite.admin.config.ts) emitting to `dist-admin/admin.html`.
   - Hostname detection routes `admin.pairuptoday.com` directly to `AdminPortal`.
   - Role-based tab permissions for all 5 admin roles.

3. **Capacitor Mobile Applications:**
   - Android package: `com.pairuptoday.app` ([`android/app/src/main/AndroidManifest.xml`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/android/app/src/main/AndroidManifest.xml)).
   - iOS bundle: `com.pairuptoday.app` ([`ios/App/App/Info.plist`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/ios/App/App/Info.plist)).
   - Permissions configured: Camera (KYC capture & selfie), Fine/Coarse Location (Companion discovery), Network. Cleartext traffic disabled.

---

## 8. Build & Test Baseline

The existing test suite was executed in PowerShell on the local system:
```powershell
npm.cmd test
```
**Output:**
```
===============================================================
  PAIRUPTODAY PRODUCTION READINESS TEST HARNESS
===============================================================
  RESULTS: 33 / 33 SCENARIOS PASSED
===============================================================
```

Type checking and production builds were verified:
```powershell
npm.cmd run lint          # tsc --noEmit -> Exit code 0
npm.cmd run build         # Vite client bundle -> Exit code 0 (1.43s)
npm.cmd run build:admin   # Vite admin bundle -> Exit code 0 (0.98s)
npx.cmd esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js # Exit code 0
npx.cmd esbuild server/jobs/maintenance.ts --bundle --platform=node --format=esm --packages=external --outfile=maintenance-job.js # Exit code 0
```

---

## 9. Conclusion & Transition to Phase 3 / Phase 4

The local project is structurally robust, well-tested, and adheres closely to the business rules. Resolving the identified Admin Supabase integration gaps and route whitelisting defects will bring the application to full production-ready code status.
