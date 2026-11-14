# Express API Authentication and Authorization Inventory

## Enforcement model

The route rows below describe route-level session/role/ownership checks. In production, a canonical-database gate permits only inspected Supabase-backed routes, including authentication, KYC/profile, membership, bookings/payments, chat/support/notifications, finance, location consent, discovery, Admin review, and configured Maps operations. Other API routes return 503 before their handler runs. Provider, migration, native build, and deployment verification are still outstanding.

`server.ts` installs a default-deny middleware on `/api` before route registration. All API requests require either a valid bearer session or an explicitly listed public route. User tokens are HMAC-SHA256 signed by `SESSION_SECRET`, expire after seven days, and resolve the current user from `databaseAdapter`; the token subject, not a client-provided ID or role, establishes identity. Missing, invalid, expired, or unknown-user sessions return 401. Role and ownership denials return 403. Admin bearer tokens are separately signed, expire after eight hours, and resolve the current role from the server-side administrator record; old ID-prefix tokens and `X-Admin-Token` are no longer accepted.

The five allowed Admin roles remain `SUPER_ADMIN`, `KYC_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, and `AUDITOR`. Per-route least-privilege checks remain in `requireAdminRoles`. User role checks derive `role` and `activeRole` from the backend user record; `DUAL` accounts must select the active role for KYC submission.

`src/utils/api.ts` attaches the persisted user or Admin bearer token for protected browser requests. Public discovery, Maps, auth entry, and payment webhook requests remain callable without a user session. Webhook authenticity is separately checked by Razorpay signature verification.

## Public routes

| Route | Authorization | Important caveat |
|---|---|---|
| `POST /api/auth/check-phone` | Public | Reveals registration status; vulnerable to account enumeration until response behavior is made non-enumerable/rate-limited. |
| `POST /api/auth/request-otp` | Public | APITXT key, HMAC secret, and persistent production storage required; per-phone rate limits apply. |
| `POST /api/auth/register-with-otp` | Public | Requires valid one-use OTP; user record and UUID creation use database adapter. |
| `POST /api/auth/verify-otp` | Public | Requires valid one-use OTP; account must already exist. |
| `POST /api/auth/login` | Public | Credential entry; successful response issues signed user token. |
| `POST /api/admin/login` | Public | Credential entry followed by real APITXT MFA; challenge state is durable in Supabase in production. |
| `POST /api/admin/verify-mfa` | Public | One-use, short-lived, rate-limited persistent challenge; only then issues signed Admin token. |
| `POST /api/payments/razorpay/webhook` | Public ingress | Raw-body signature verification, durable event claims, provider payment/refund reconciliation, and idempotent database finalization; requires Razorpay webhook configuration and migration 008. |
| `GET /api/companions/search` | Public discovery | Supabase live profiles; when valid coordinates are supplied, Google Distance Matrix ranks companions with saved discovery coordinates. Precise coordinates are not returned. Requires migration 008's distributed rate-limit RPC before route dispatch. |
| `GET /api/maps/autocomplete` | Public | Google Maps provider configuration and quotas required. |
| `GET /api/maps/geocode` | Public | Google Maps provider configuration and quotas required. |
| `GET /api/maps/reverse-geocode` | Public | Google Maps provider configuration and quotas required. |
| `GET /api/maps/distance` | Public | Google Maps provider configuration and quotas required. |
| `GET /health` | Public, outside `/api` | Reports process health, not readiness of external providers. |

## Protected user routes

| Route | Required authorization | Ownership enforcement | Storage/status |
|---|---|---|---|
| `GET /api/auth/session` | Any valid user bearer | Token subject resolves user | User lookup via adapter; protected. |
| `POST /api/auth/select-role` | Any valid user bearer | User ID replaced by token subject; allowed role checked against account role | Supabase adapter update in production; JSON adapter is local-development only. |
| `POST /api/kyc/submit` | Any valid user bearer; role must be `CLIENT`/`COMPANION` or selected `DUAL.activeRole` | Identity is the token subject; conflicting user ID/role requests are denied | Supabase user/KYC update via RPC and private Storage in production; local JSON adapter in development. |
| `POST /api/companion/services-rates` | Authenticated `COMPANION` | User ID is the token subject | Supabase `companion_profiles`, role-specific approved KYC, active `companion_memberships`, and `bank_verifications` in production. |
| `POST /api/companion/membership/subscribe` | Authenticated `COMPANION` | User ID comes from the session | Supabase pending membership plus server-created Razorpay order; activation requires the captured-payment RPC. |
| `POST /api/companion/bank/verify` | Authenticated `COMPANION` | User ID comes from the session; account number encrypted before provider call and stored only after APITXT approves | Supabase bank record and audit log; requires APITXT and `BANK_ACCOUNT_ENCRYPTION_KEY`; live provider behavior is not verified. |
| `POST /api/payments/razorpay/create-order` | Route role logic exists | N/A | Blocked in production; first-party booking and membership endpoints create resource-bound orders. |
| `POST /api/payments/razorpay/verify-payment` | `CLIENT` for a booking, `COMPANION` for a membership | Ownership and order ID are checked against the session-owned Supabase record | HMAC signature plus Razorpay captured-payment lookup, amount/currency/order comparison, then transactional Supabase finalization. |
| `GET /api/companion/status/:userId` | Authenticated `COMPANION` | Path user ID must match token subject | Supabase user/profile/membership/bank status and wallet ledger in production; account number is not returned. |
| `POST /api/bookings/create` | Authenticated `CLIENT` | Client ID comes from the session; companion is a selected target | Supabase slot reservation and server-priced pending booking; returns a Razorpay order and does not confirm before capture. |
| `GET /api/bookings/my/:userId` | Any valid user bearer | Path ID must equal the session user; query returns only participant bookings | Supabase; only the Client receives decryptable OTPs; hashes and ciphertext are stripped from responses. |
| `POST /api/bookings/:bookingId/arrived` | Authenticated `COMPANION` | Atomic RPC requires the session user to be the booking Companion | Supabase state transition. |
| `POST /api/bookings/:bookingId/verify-start-otp` | Authenticated `COMPANION` | Atomic RPC requires the session user to be the booking Companion | Supabase hash verification, attempt limit, exact delay penalty, one-use invalidation. |
| `POST /api/bookings/:bookingId/complete` | Authenticated `COMPANION` | Atomic RPC requires the session user to be the booking Companion | Supabase one-use completion OTP and idempotent wallet earning locked for 48 hours. |
| `GET /api/chat/:bookingId` | Any valid user bearer | Caller must be active or completed booking participant | Supabase `chat_conversations` and `chat_messages`. |
| `POST /api/chat/:bookingId` | Any valid user bearer | Caller must be active booking participant; sender ID replaced by token subject | Supabase `chat_conversations` and `chat_messages`. |
| `GET /api/chat/:bookingId/stream` | Any valid user bearer | Caller must be active or completed booking participant | Authenticated server-sent event polling over Supabase chat history. |
| `POST /api/companion/availability/toggle` | Authenticated `COMPANION` | User ID is the token subject; resuming requires approved `COMPANION`-role KYC, active paid membership, and verified bank details | Supabase `companion_profiles` in production. |
| `GET /api/notifications/:userId` | Any valid user bearer | Path ID must equal token subject | Persistent Supabase notifications. |
| `POST /api/notifications/read` | Any valid user bearer | Notification update constrained by token subject | Supabase read state. |
| `POST /api/notifications/device-token` | Any valid user bearer | Token registered to token subject | Supabase device token registry; FCM delivery only after provider configuration. |
| `DELETE /api/notifications/device-token` | Any valid user bearer | Only the caller's token can be removed | Supabase device token registry. |
| `POST /api/support/conversation` | Any valid user bearer | User ID replaced by token subject | Supabase support conversations. |
| `GET /api/support/conversations/:userId` | Any valid user bearer | Path ID must equal token subject | Supabase support conversations. |
| `GET /api/support/messages/:conversationId` | Any valid user bearer | Conversation must belong to token subject | Supabase support messages. |
| `GET /api/support/messages/:conversationId/stream` | Any valid user bearer | Conversation must belong to token subject | Authenticated server-sent event polling over Supabase support messages. |
| `POST /api/support/message` | Any valid user bearer | Conversation ownership checked; sender ID replaced by token subject | Supabase support messages. |
| `POST /api/location/update` | Any valid user bearer | Active booking participant; persisted booking consent required; user ID from token | Booking-scoped Firebase path; no JSON fallback. |
| `GET /api/location/:userId?bookingId=...` | Any valid user bearer | Both parties must belong to the active booking and target must have consented | Booking-scoped Firebase path; precise location returned only to participant. |
| `POST /api/location/sharing/start` | Any valid user bearer | Active booking participant; user ID from token | Consent persisted in Supabase before access is enabled. |
| `POST /api/location/sharing/stop` | Any valid user bearer | Booking participant; user ID from token | Supabase consent disabled before Firebase location removal. |
| `POST /api/presence` | Any valid user bearer | User ID from token | Firebase presence; no JSON fallback. |
| `GET /api/presence/:userId?bookingId=...` | Any valid user bearer | Active booking participant and target's booking consent required | Firebase presence; no JSON fallback. |

## Protected Admin routes and roles

All routes below require a signed Admin bearer token and the current server-side Admin role. A user token cannot satisfy the Admin gate.

| Route | Allowed roles |
|---|---|
| `GET /api/admin/overview` | All five authorized roles |
| `GET /api/admin/kyc/list` | `SUPER_ADMIN`, `KYC_ADMIN`; response omits private object paths |
| `GET /api/admin/kyc/:id/documents` | `SUPER_ADMIN`, `KYC_ADMIN`; short-lived signed URLs |
| `POST /api/admin/kyc/:id/action` | `SUPER_ADMIN`, `KYC_ADMIN`; actor UUID from authenticated Admin, transactional RPC and audit insert |
| `GET /api/admin/finance/settlements` | `SUPER_ADMIN`, `FINANCE_ADMIN` |
| `GET /api/admin/finance/payouts` | `SUPER_ADMIN`, `FINANCE_ADMIN` |
| `GET /api/admin/finance/refunds` | `SUPER_ADMIN`, `FINANCE_ADMIN` |
| `POST /api/admin/finance/re-auth` | `SUPER_ADMIN`, `FINANCE_ADMIN`; registered Admin phone, APITXT SMS, persistent action-specific challenge |
| `POST /api/admin/finance/re-auth/verify` | `SUPER_ADMIN`, `FINANCE_ADMIN`; one-use six-digit action challenge |
| `POST /api/admin/finance/reveal-bank` | `SUPER_ADMIN`, `FINANCE_ADMIN`; fresh MFA consumed before decrypting, audit attributed to session Admin |
| `POST /api/admin/finance/process-payout` | `SUPER_ADMIN`, `FINANCE_ADMIN`; fresh MFA consumed; payout and wallet reservation are transactional |
| `POST /api/admin/finance/refund` | `SUPER_ADMIN`, `FINANCE_ADMIN`; fresh MFA consumed; refund is reserved and Razorpay request is idempotent |
| `GET /api/admin/staff` | `SUPER_ADMIN` |
| `POST /api/admin/staff/create` | `SUPER_ADMIN` |
| `GET /api/admin/audit-logs` | `SUPER_ADMIN`, `AUDITOR` |
| `GET /api/admin/clients` | `SUPER_ADMIN`, `KYC_ADMIN`, `SUPPORT_ADMIN` |
| `GET /api/admin/companions` | `SUPER_ADMIN`, `KYC_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN` |
| `GET /api/admin/memberships` | `SUPER_ADMIN`, `FINANCE_ADMIN`, `AUDITOR` |
| `GET /api/admin/bookings` | `SUPER_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, `AUDITOR` |
| `GET /api/admin/payments` | `SUPER_ADMIN`, `FINANCE_ADMIN`, `AUDITOR` |
| `GET /api/admin/support/conversations` | `SUPER_ADMIN`, `SUPPORT_ADMIN` |
| `GET /api/admin/support/messages/:conversationId` | `SUPER_ADMIN`, `SUPPORT_ADMIN` |
| `GET /api/admin/support/messages/:conversationId/stream` | `SUPER_ADMIN`, `SUPPORT_ADMIN` |
| `POST /api/admin/support/reply` | `SUPER_ADMIN`, `SUPPORT_ADMIN` |
| `POST /api/admin/support/conversation/:id/status` | `SUPER_ADMIN`, `SUPPORT_ADMIN` |

Admin actor IDs/emails in request bodies are overwritten with the authenticated Admin record. Bank reveal is blocked rather than accepting the former fixed MFA code. The seeded development Admin is rejected in production.

## Legacy JSON state and remaining blockers

Unmigrated legacy JSON routes remain denied in production by the canonical-database gate. Among them:

- Role selection.
- Booking cancellation/refunds and other unlisted booking lifecycle endpoints.
- Admin overview, staff provisioning, and remaining non-finance Admin operations not listed above.
- Booking cancellation and other unlisted booking lifecycle operations.
- Any old JSON-only wallet/payout code paths not exposed through the Supabase-backed status and finance endpoints.
- Static demo fixture data remains in the local-development JSON adapter and must never be treated as production application data.

The inventory above does not imply live readiness. The operator reports migrations 003–008 have not been executed in Production; this has not been independently queried. Migration 008's distributed rate-limit RPC is a prerequisite for all API routes, and requests currently fail closed before dispatch. No Supabase, Firebase, APITXT, Razorpay, Google Maps, Cloud Run, or Scheduler integration has been verified against production. The native Android wrapper and complete Xcode project/signing configuration remain incomplete. Some Admin, booking lifecycle, and wallet surfaces still use legacy handlers and remain production-blocked. Review the migration SQL and run consolidated validation before any external rollout.
