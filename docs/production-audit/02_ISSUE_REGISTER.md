# PairUpToday — Production Issue Register

**Audit Date:** 2026-11-13  
**Project Root:** `C:\Users\ADMIN\Downloads\pairup-today-ai-2ai`  
**Standard:** PairUpToday Approved Blueprint  

---

## Issue Summary Matrix

| ID | Title | Severity | Category | File Location | Launch Blocking? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Admin Portal API endpoints bypass Supabase & throw HTTP 503 in production | **CRITICAL** | Database / API / Admin | `server.ts#L3624-L3657`, `server.ts#L4014-L4177`, `server.ts#L1394-L1460` | **YES** |
| **ISS-02** | `POST /api/payments/razorpay/create-order` blocked with 503 in production & reads in-memory DB | **HIGH** | Payment / API | `server.ts#L2398-L2451`, `server.ts#L1394-L1460` | **YES** |
| **ISS-03** | Client-side and server-side Supabase client initialization error on empty env vars during development | **HIGH** | Database / Startup | `server/services/supabase.ts#L16-L21` | **YES** |
| **ISS-04** | Deprecated `__dirname` in Vite configs causes build warnings | **LOW** | Build / Tooling | `vite.config.ts#L11`, `vite.admin.config.ts#L11` | **NO** |
| **ISS-05** | Large installer executable binaries stored in project root | **LOW** | Repository Hygiene | Root directory (`edb_*.exe`, `postgresql_*.exe`, etc.) | **NO** |
| **ISS-06** | Test Harness lacks automated assertion for Supabase Admin Portal endpoints | **MEDIUM** | Testing / QA | `tests/production-readiness.test.ts` | **NO** |

---

## Detailed Issue Records

---

### ISS-01: Admin Portal API Endpoints Bypass Supabase & Throw HTTP 503 in Production

* **Severity:** **CRITICAL**
* **Category:** Database / Backend API / Admin Portal
* **File References:**
  - [`server.ts` Lines 3624–3657](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L3624-L3657) (`GET /api/admin/overview`)
  - [`server.ts` Lines 4014–4016](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4014-L4177) (`GET /api/admin/staff`)
  - [`server.ts` Lines 4018–4047](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4018-L4047) (`POST /api/admin/staff/create`)
  - [`server.ts` Lines 4050–4052](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4050-L4052) (`GET /api/admin/audit-logs`)
  - [`server.ts` Lines 4055–4072](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4055-L4072) (`GET /api/admin/clients`)
  - [`server.ts` Lines 4075–4100](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4075-L4100) (`GET /api/admin/companions`)
  - [`server.ts` Lines 4103–4122](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4103-L4122) (`GET /api/admin/memberships`)
  - [`server.ts` Lines 4125–4135](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4125-L4135) (`GET /api/admin/bookings`)
  - [`server.ts` Lines 4138–4177](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L4138-L4177) (`GET /api/admin/payments`)
  - [`server.ts` Lines 1394–1460](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L1394-L1460) (`isSupabaseBackedProductionRoute()`)
  - [`src/admin/AdminPortal.tsx` Lines 116–127](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/src/admin/AdminPortal.tsx#L116-L127)

#### Description & Evidence:
1. In `server.ts`, nine major Admin Portal API endpoints directly access in-memory data structures (`db.users`, `db.bookings`, `db.companionProfiles`, `db.companionWallets`, `db.adminUsers`, `db.auditLogs`, `db.kycSubmissions`) instead of calling the canonical database adapter `databaseAdapter`.
2. Furthermore, function `isSupabaseBackedProductionRoute(req)` in `server.ts` does not include these endpoints in its whitelist.
3. In `server.ts` line 1488:
   ```ts
   if (process.env.NODE_ENV === 'production' && !isSupabaseBackedProductionRoute(req)) {
     return res.status(503).json({
       error: 'This endpoint is unavailable until its business-data operation is backed by Supabase.'
     });
   }
   ```
4. When `NODE_ENV === 'production'`, every single call made by the Admin Portal upon loading ([`AdminPortal.tsx#L116-L127`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/src/admin/AdminPortal.tsx#L116-L127)) is immediately rejected with HTTP 503.

#### Impact:
- **Catastrophic in production:** The Admin Portal is completely inoperable on Google Cloud Run. Admins cannot review overview analytics, approve/manage clients or companions, inspect memberships, view bookings, review payments, manage staff, or view audit logs.

#### Remediation Plan:
1. Implement the Supabase adapter calls inside each of the 9 admin endpoints using `databaseAdapter`:
   - `/api/admin/overview`: Aggregate counts and financial sums via `databaseAdapter.listUsers()`, `databaseAdapter.listBookings()`, and `databaseAdapter.listKycSubmissions()`.
   - `/api/admin/staff`: Call `await databaseAdapter.listAdminUsers()`.
   - `/api/admin/staff/create`: Call `await databaseAdapter.createAdminUser()`.
   - `/api/admin/audit-logs`: Call `await databaseAdapter.listAuditLogs()`.
   - `/api/admin/clients`: Query clients via `await databaseAdapter.listUsers({ role: 'CLIENT' })`.
   - `/api/admin/companions`: Query companions and join profiles via `databaseAdapter.listCompanionProfiles()`.
   - `/api/admin/memberships`: Call `await databaseAdapter.listMemberships()`.
   - `/api/admin/bookings`: Call `await databaseAdapter.listBookings()`.
   - `/api/admin/payments`: Extract verified payment records from `databaseAdapter.listBookings()` and `databaseAdapter.listMemberships()`.
2. Add all 9 endpoints to `isSupabaseBackedProductionRoute(req)` in `server.ts`.

---

### ISS-02: `POST /api/payments/razorpay/create-order` Blocked With 503 in Production & Reads In-Memory DB

* **Severity:** **HIGH**
* **Category:** Payment / API / Security
* **File References:**
  - [`server.ts` Lines 2398–2451](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L2398-L2451)
  - [`server.ts` Lines 1394–1460](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server.ts#L1394-L1460)

#### Description & Evidence:
1. `POST /api/payments/razorpay/create-order` is missing from `isSupabaseBackedProductionRoute(req)`.
2. Line 2406 directly reads `db.companionProfiles[targetCompId]?.isInitialListing` from in-memory state:
   ```ts
   const targetCompId = req.body.companionId || notes?.companionId;
   if (targetCompId && db.companionProfiles[targetCompId]?.isInitialListing) {
     return res.status(400).json({ error: 'This profile is currently unavailable for booking.' });
   }
   ```

#### Impact:
- If called in production, the endpoint immediately returns HTTP 503.
- When evaluating whether a companion is an initial demo listing, it checks in-memory `db` which is not synced with Supabase.

#### Remediation Plan:
1. Replace `db.companionProfiles[targetCompId]` with `await databaseAdapter.getCompanionProfile(targetCompId)`.
2. Add `'POST /api/payments/razorpay/create-order'` to the whitelist in `isSupabaseBackedProductionRoute(req)`.

---

### ISS-03: Supabase Client Instantiation Safety on Empty Environment Variables

* **Severity:** **HIGH**
* **Category:** Database / Configuration / Startup
* **File References:**
  - [`server/services/supabase.ts` Lines 16–21](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/server/services/supabase.ts#L16-L21)

#### Description & Evidence:
1. In `server/services/supabase.ts`:
   ```ts
   export const supabase = createClient(supabaseUrl, supabaseServiceKey, ...);
   ```
2. When running tests or local builds where `SUPABASE_URL` is an empty string, newer `@supabase/supabase-js` throws an unhandled exception (`supabaseUrl is required.`).
3. While production must strictly require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (fail-fast), development and test harness environments require a safe fallback dummy URL/key (e.g. `https://placeholder.supabase.co` and `placeholder-service-key`) so modules can import without crashing during unit tests and offline builds.

#### Remediation Plan:
1. In `server/services/supabase.ts`, maintain the strict production check:
   ```ts
   if (process.env.NODE_ENV === 'production' && (!supabaseUrl || !supabaseServiceKey)) {
     throw new Error('Production startup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
   }
   ```
2. For non-production environments when keys are empty, supply a placeholder URL (`https://placeholder.supabase.co`) and placeholder key (`placeholder-service-key`) to permit clean module imports during tests.

---

### ISS-04: Deprecated `__dirname` Usage in Vite Configurations

* **Severity:** **LOW**
* **Category:** Build Tooling
* **File References:**
  - [`vite.config.ts` Line 11](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/vite.config.ts#L11)
  - [`vite.admin.config.ts` Line 11](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/vite.admin.config.ts#L11)

#### Description & Evidence:
- Vite emits build warnings:
  ```
  (!) Your Vite config uses features that are unsupported by `configLoader: 'native'`:
    - `__dirname` (vite.config.ts:11:27). Use `import.meta.dirname` instead
  ```

#### Remediation Plan:
- Update `vite.config.ts` and `vite.admin.config.ts` to use `fileURLToPath(new URL('.', import.meta.url))` or `import.meta.dirname`.

---

### ISS-05: Installer Binary Debris in Project Root

* **Severity:** **LOW**
* **Category:** Repository Hygiene & Docker Build Optimization
* **File References:**
  - Project root folder: `edb_*.exe`, `postgresql_*.exe`, `postgis_*.exe`, `pemhttpd.exe` (~3 GB total)
  - [`.dockerignore`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/.dockerignore)
  - [`.gitignore`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/.gitignore)

#### Description & Evidence:
- Large third-party database installer `.exe` files reside in the root directory.
- While they do not affect runtime execution, they can accidentally bloat Docker build contexts if `.dockerignore` does not exclude them.

#### Remediation Plan:
- Verify and ensure `.dockerignore` and `.gitignore` contain `*.exe` to prevent unnecessary overhead during container builds.

---

### ISS-06: Test Harness Lacks Automated Coverage for Admin Supabase Routes

* **Severity:** **MEDIUM**
* **Category:** Testing / QA
* **File References:**
  - [`tests/production-readiness.test.ts`](file:///C:/Users/ADMIN/Downloads/pairup-today-ai-2ai/tests/production-readiness.test.ts)

#### Description & Evidence:
- The existing test harness verifies 33 scenarios covering OTP, APITXT, Razorpay HMAC, financial splits, late penalties, 48-hour locks, and Capacitor configurations.
- However, it does not explicitly assert that all Admin routes are backed by Supabase and present in `isSupabaseBackedProductionRoute`.

#### Remediation Plan:
- Add a new automated scenario to `tests/production-readiness.test.ts` asserting that all Admin routes are backed by Supabase and verified in `isSupabaseBackedProductionRoute`.
