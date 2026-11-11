# Database Architecture

## 1. Canonical database design in Supabase
The SQL schema is defined in [supabase/migrations/001_initial_schema.sql](../../supabase/migrations/001_initial_schema.sql).

### Core tables
- `users`
- `kyc_submissions`
- `companion_profiles`
- `companion_memberships`
- `bank_verifications`
- `bookings`
- `wallet_ledger`
- `payouts`
- `chat_conversations`
- `chat_messages`
- `support_conversations`
- `support_messages`
- `admin_users`
- `admin_mfa_store`
- `audit_logs`
- `notifications`
- `payment_webhook_events`

### Key structural rules
- UUID primary keys
- foreign keys and cascade rules
- status enums and constraints
- triggers for `updated_at`
- indexes on high-value queries such as user phone, booking status, wallet status, admin role, and KYC status

## 2. Row-level security design
The RLS file is [supabase/migrations/002_rls_policies.sql](../../supabase/migrations/002_rls_policies.sql).

It includes policies for:
- users reading their own data
- companions reading/updating their profile and memberships
- clients reading their own bookings
- companions reading assigned bookings
- private KYC access by submitted user
- support messaging permissions
- service-role access for backend usage

## 3. Local implementation and fallback database
The fallback database adapter is implemented in [server/services/database.ts](../../server/services/database.ts).

It maintains a JSON file at:
- [data/pairuptoday_db.json](../../data/pairuptoday_db.json)

This is a local-only persistence layer used when Supabase is not configured. It includes:
- users
- kycSubmissions
- companionProfiles
- companionMemberships
- bookings
- companionWallets
- payouts
- chatMessages
- adminUsers
- supportConversations
- supportMessages
- bankVerifications
- userLocations
- userPresence
- otpStore
- adminMfaStore
- auditLogs

## 4. Operational DB responsibilities by domain
| Domain | Table(s) | Purpose |
|---|---|---|
| Account management | `users`, `admin_users` | base user/admin identity |
| KYC | `kyc_submissions`, `bank_verifications` | review and verification |
| Profile and availability | `companion_profiles`, `companion_memberships` | profile, rates, activation |
| Booking | `bookings` | booking lifecycle |
| Finance | `wallet_ledger`, `payouts` | settlement and payouts |
| Chat | `chat_conversations`, `chat_messages` | secure chat |
| Support | `support_conversations`, `support_messages` | support tickets |
| Audit | `audit_logs` | admin actions and compliance |
| Webhooks | `payment_webhook_events` | idempotency for payment events |

## 5. Provider-specific responsibilities
### Supabase responsibilities
- canonical persisted state for bookings, KYC, memberships, wallet, payouts, chat history, notifications, and admin logs
- source: [server/services/supabase.ts](../../server/services/supabase.ts)

### Firebase responsibilities
- real-time location and presence data, not canonical financial or booking records
- source: [server/services/firebase.ts](../../server/services/firebase.ts)

## 6. Status summary
| Component | Status |
|---|---|
| SQL schema | COMPLETE (local schema file) |
| RLS policies | COMPLETE (local schema file) |
| Local JSON fallback store | COMPLETE |
| Actual live Supabase migrations | EXTERNAL BLOCKED |
| Production DB access | EXTERNAL BLOCKED |

## 7. Evidence-based conclusion
The project contains a well-structured database blueprint and a clean local backup, but no real Supabase instance is live-connected. The schema and RLS are prepared for later execution in a real provider environment, but the actual database is not live-backed yet.
