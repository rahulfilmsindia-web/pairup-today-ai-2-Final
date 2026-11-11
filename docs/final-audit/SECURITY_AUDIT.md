# Security Audit

## 1. Security controls present
The codebase contains several important local security controls.

### OTP protection
- six-digit OTP format enforced in tests and code expectations
- server-secret HMAC-SHA256 hashing is used in [server.ts](../../server.ts)
- constant-time comparison is used in [server.ts](../../server.ts)
- OTP values are not stored in plaintext in the database structures defined in [server.ts](../../server.ts)

### API and request security
- CORS headers and origin filtering are configured in [server.ts](../../server.ts)
- security headers are set (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`)
- Express receives JSON and URL-encoded bodies with size limits

### Payment verification
- Razorpay signature verification is implemented in [server/services/razorpay.ts](../../server/services/razorpay.ts)
- webhook signature verification is also implemented

### Admin security model
- admin role gating is implemented in [server.ts](../../server.ts)
- five explicit roles are defined in the schema and tests
- MFA logic is modeled in the admin auth context and server logic

### Local DB safety
- JSON DB writes are atomic via temp file plus rename pattern in [server/services/database.ts](../../server/services/database.ts)

## 2. Gaps and risks
| Area | Current status | Risk |
|---|---|---|
| Real secret management | PARTIAL | .env is local-template only; no real Google Secret Manager or cloud secret management is connected |
| Supabase RLS enforcement | PARTIAL | real database not active |
| Firebase auth/notification security | PARTIAL | no real Firebase project active |
| Production rate limiting | PARTIAL | route-level rate limiting is not fully implemented in code |
| Auth session hardening | PARTIAL | local session model exists, but production auth backend is not live |
| KYC document storage controls | PARTIAL | storage bucket rules are prepared but not live |
| Live payment and webhook hardening | EXTERNAL BLOCKED | live Razorpay keys and env not connected |

## 3. Validation evidence
The harness in [tests/production-readiness.test.ts](../../tests/production-readiness.test.ts) validates many security rules, including:
- OTP hashing and replay prevention
- APITXT request omission of `template_id`
- Razorpay HMAC verification
- admin role constraints
- settlement rules

## 4. Reliability statement
The app includes substantial local security and reliability patterns, but it cannot be treated as production secure or production reliable without live external configuration and live provider controls.
