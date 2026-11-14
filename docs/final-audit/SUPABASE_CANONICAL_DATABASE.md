# Supabase Canonical Database — Implementation Status

## Production behavior

- Production startup fails if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
- The database adapter selects the JSON adapter only outside `NODE_ENV=production`.
- Production `server.ts` startup does not load or seed `data/pairuptoday_db.json`.
- Production JSON writes throw explicitly.
- A default-deny production route gate returns HTTP 503 for API endpoints that still depend on the legacy `db` object. It does not report a successful empty result or attempt a JSON fallback.
- Supabase REST access is performed by the server service-role client. Migration 005 revokes application-table privileges from `PUBLIC`, `anon`, and `authenticated` and grants them to `service_role`.

The API is not yet a complete production application. The route allowlist must remain aligned to verified handlers; unmigrated legacy routes fail closed rather than reading or writing JSON.

## Routes backed by Supabase

These are the current API routes allowed through the production gate:

| Route | Supabase operation |
|---|---|
| `POST /api/auth/check-phone` | User lookup by canonical phone |
| `POST /api/auth/request-otp` | Durable challenge reservation and delivery result through migration 003 RPCs |
| `POST /api/auth/register-with-otp` | One-use OTP verification and UUID user insert |
| `POST /api/auth/verify-otp` | User lookup and one-use OTP verification |
| `GET /api/auth/session` | User lookup for verified backend session subject |
| `POST /api/auth/login` | User lookup by phone and password hash comparison |
| `POST /api/auth/select-role` | Server-derived user ID and database update |
| `POST /api/admin/login` | Active Admin lookup from `admin_users` and durable migration 004 MFA reservation |
| `POST /api/admin/verify-mfa` | Durable migration 004 MFA verification and active Admin lookup |
| `POST /api/kyc/submit` | Private Storage uploads followed by transactional `submit_profile_kyc` RPC |
| `POST /api/companion/services-rates` | Authenticated companion profile upsert/update plus membership and bank eligibility checks |
| `POST /api/companion/membership/subscribe` | Creates a pending membership and server-side Razorpay order; does not activate before captured payment |
| `POST /api/companion/bank/verify` | APITXT verification, encrypted account storage, masked last four, and audit record |
| `GET /api/companion/status/:userId` | Authenticated owner-only profile, membership, bank-status, and wallet-ledger reads |
| `POST /api/companion/availability/toggle` | Owner-only companion profile pause/resume with activation eligibility checks |
| `GET /api/companions/search` | Supabase live profiles and approved users, with active paid membership and verified-bank checks |
| `POST /api/bookings/create` | Atomic Supabase availability/overlap reservation and server-priced booking; creates a Razorpay order but leaves status pending |
| `GET /api/bookings/my/:userId` | Participant-only Supabase booking query; OTP secrets are removed from companion responses |
| `POST /api/bookings/:bookingId/arrived` | Companion-owned Supabase arrival transition |
| `POST /api/bookings/:bookingId/verify-start-otp` | Atomic OTP attempt and state transition; exact delay penalty applied in the database |
| `POST /api/bookings/:bookingId/complete` | Atomic completion, one-time wallet earning insert, and 48-hour settlement lock |
| `POST /api/payments/razorpay/verify-payment` | Signature validation, Razorpay captured-payment lookup, amount/order validation, and atomic Supabase finalization |
| `POST /api/payments/razorpay/webhook` | Signature validation, durable webhook claims, captured/failed payment processing, and provider refund reconciliation |
| `GET/POST /api/chat/:bookingId` and `GET /api/chat/:bookingId/stream` | Booking-participant Supabase chat history, message persistence, and authenticated SSE polling |
| `POST/GET /api/support/*` | Supabase support conversations/messages with conversation ownership enforcement and authenticated user/Admin SSE polling |
| `GET /api/notifications/:userId`, notification read and device-token routes | Persistent Supabase notifications, durable push-delivery claims/retries, and FCM token registry |
| `/api/location/*` and `/api/presence/*` | Supabase booking-consent authorization with booking-scoped Firebase RTDB data; no JSON fallback |
| `/api/admin/finance/*` | Finance-role authorization, durable sensitive-action MFA, settlements, manual payouts, and Razorpay refunds |
| `GET /api/admin/kyc/list` | `SUPER_ADMIN`/`KYC_ADMIN` review queue from `kyc_submissions` and `users` |
| `GET /api/admin/kyc/:id/documents` | `SUPER_ADMIN`/`KYC_ADMIN` short-lived signed URLs for private Storage objects |
| `POST /api/admin/kyc/:id/action` | `SUPER_ADMIN`/`KYC_ADMIN` transactional `review_profile_kyc` RPC and audit insert |

Maps endpoints are also allowed in production because they call the Maps service rather than the application JSON database; provider availability is not a database integration claim. Nearby discovery uses private server-side profile coordinates only for distance calculation and does not return them. `/health` is process health only. Migration 008, provider credentials, and live service configuration are not verified.

## Routes still gated in production

APIs outside the allowlist above return 503 in production pending Supabase route migration. Remaining examples include:

- Booking cancellation and unlisted booking lifecycle operations.
- Admin overview, staff provisioning, and unlisted Admin operations.
- Legacy JSON-only routes that are not in the route authorization inventory.

Local development continues to use the JSON adapter and existing JSON-backed routes. That local behavior is not used as production persistence.

## Profile and KYC implementation

`POST /api/kyc/submit` derives the account role from the authenticated backend user (and `activeRole` for `DUAL` accounts), validates image data URLs as JPEG/PNG/WebP under 5 MiB, uploads required documents to role-specific private buckets, and stores object paths through the `submit_profile_kyc` RPC. The RPC updates user profile/KYC state and submission rows transactionally. Uploaded objects are removed if the database write fails. The browser no longer substitutes placeholder documents.

Admin KYC list responses omit storage paths. Authorized review users request 300-second signed URLs only when opening a submission. Approve/reject decisions use the server-resolved Admin UUID and `review_profile_kyc`; the RPC enforces active `SUPER_ADMIN`/`KYC_ADMIN` roles and writes the audit record. Companion activation checks an approved `COMPANION`-role KYC submission, a paid unexpired membership, and verified bank details; resuming a paused profile is denied unless all conditions hold. For `DUAL` accounts, Companion KYC review/submission does not overwrite the account-level Client KYC status used by Client booking eligibility. Migration 006 was corrected before execution; the API discovery/status/availability paths also query KYC by the requested role.

Migration 006 prepares private storage buckets, transactional KYC RPCs, and a database activation trigger. It has not been executed. Private bucket existence, RPC availability, and live signed URL behavior are therefore externally unverified until the migration is applied in the intended Supabase project.

There is no separate client profile-edit API in the repository. The profile fields submitted through KYC (`legal_name`, `dob`, `bio`, `photos`, and `city`) are the profile fields currently persisted by this workflow; no broader client profile surface is claimed as migrated.

## Adapter and schema alignment

`server/services/database.ts` maps camel-case domain fields to the actual SQL columns in migrations 001–008 for users, KYC submissions, companion profiles, memberships, bank verifications, bookings, wallet entries, payouts, chat/support messages, Admin users, audit logs, notifications, locations, and presence. Database errors are thrown rather than converted to missing records or zero balances for the updated Supabase operations. Admin authentication and token validation resolve Admin identities from `admin_users`, not the JSON seed object.

Migration 005 adds:

- Booking fee/share/penalty, settlement, OTP-attempt and payout linkage fields missing from migration 001.
- A GiST exclusion constraint to prevent overlapping active bookings for a Companion under concurrent requests.
- Idempotency columns/indexes for wallet entries and payouts, and one earning entry per booking.
- Dedicated `user_locations` and `user_presence` tables.
- Admin-user foreign-key columns for payout attribution, support assignment/messages, and audit records. Existing `*_id` references to `users` remain for compatibility.
- `reserve_booking_payout`, a single-transaction settlement reservation with booking row locking, eligibility checks, UTR attribution, and wallet-ledger state update.
- Migration 007 adds expiring slot reservations, resource-bound Razorpay order IDs, server-calculated booking rates, payment finalization, encrypted client-only Start/Completion OTP fields, bank last-four metadata, and atomic arrival/OTP/settlement RPCs. It must follow migrations 001–006.
- Migration 008 adds distributed API rate limits, session revocation, webhook claims, refund reservation/reconciliation, one-use finance MFA, FCM device tokens and retry state, booking-scoped location consent, idempotent maintenance runs, settlement release, and 24-hour booking reminder insertion.
- Explicit database grants for backend service-role access only.

The existing schema's user IDs and business-row IDs are UUIDs. The adapter omits non-UUID supplied IDs where the database can generate an ID. Do not pass prefixed legacy IDs into UUID foreign-key columns.

## Remaining gaps and blockers

1. The operator reports that migrations 003–008 have not been executed in Production; this has not been independently queried. Migration 008 is required by the global `/api` rate-limit middleware. Until it is applied after review and in order, API requests fail closed with 503. Do not remove or bypass that protection.
2. Razorpay webhook/refund reconciliation, finance MFA, booking chat/support, notification persistence, location authorization, and scheduled maintenance are implemented in code but have not been verified against live providers or a migrated database.
3. Cloud Scheduler must use an OIDC identity with `roles/run.invoker`; Firebase RTDB rules and IAM must be applied and verified.
4. APITXT account approval/contract enablement, Razorpay live account settings, Supabase Storage bucket/RPC behavior, Google Maps quotas, and all live provider operations remain externally unverified.
5. Native Android wrapper and complete iOS Xcode/signing setup remain incomplete. Some Admin and booking lifecycle routes remain blocked.
6. Local JSON files remain for development: `data/pairuptoday_db.json`, `data/otp_challenges.json`, and `data/admin_mfa_challenges.json`. Production startup does not read or write them.

No Supabase connection, SQL migration, production deployment, live provider request, or production payment was performed.
