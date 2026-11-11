# Business Rules and Financial Flow

## 1. Product rules implemented in the code
The financial and business rules are documented in the local tests and encoded in server logic.

### Membership
- Client membership is free.
- Companion membership plans remain part of the app logic and not changed.
- Activation requires KYC approval, active membership, and bank verification.

Evidence:
- [server.ts](../../server.ts)
- [tests/production-readiness.test.ts](../../tests/production-readiness.test.ts)

### Commission structure
- Platform fee: 15%
- Companion gross share: 85%

Evidence: scenario 14 in [tests/production-readiness.test.ts](../../tests/production-readiness.test.ts)

### Delay penalty formula
The required formula is:
`(Booking Amount / Slot Minutes) * Delay Minutes`

Evidence: scenario 15 in [tests/production-readiness.test.ts](../../tests/production-readiness.test.ts)

### Settlement lock
- minimum 48-hour lock after completion
- integer paise accounting
- settlement balance lock handling in wallet ledger schema

Evidence:
- [supabase/migrations/001_initial_schema.sql](../../supabase/migrations/001_initial_schema.sql)
- [server.ts](../../server.ts)

### Payout logic
- payouts are stored and processed with `UTR`
- admin manual payout flow exists
- companion cannot self-withdraw
- membership fees are not treated as companion earnings

Evidence:
- [server.ts](../../server.ts)
- [supabase/migrations/001_initial_schema.sql](../../supabase/migrations/001_initial_schema.sql)

## 2. Financial engine behavior
The project defines local rules for the following:
- booking amount calculation
- platform commission
- companion net share
- delay penalty
- escrow/locked settlement balance
- payout eligibility
- idempotent payout processing

## 3. Actual route and source evidence
| Business rule | Actual source |
|---|---|
| KYC + membership + bank activation gate | [server.ts](../../server.ts) |
| Razorpay order creation | [server/services/razorpay.ts](../../server/services/razorpay.ts) |
| APITXT bank verification | [server/services/apitxt.ts](../../server/services/apitxt.ts) |
| schema for wallet and payout flow | [supabase/migrations/001_initial_schema.sql](../../supabase/migrations/001_initial_schema.sql) |
| security and validation tests | [tests/production-readiness.test.ts](../../tests/production-readiness.test.ts) |

## 4. Implementation status
| Rule | Status |
|---|---|
| Client membership free | COMPLETE (local business rule) |
| Companion membership plans | COMPLETE (local business rule) |
| KYC, membership and bank activation gate | COMPLETE (local logic) |
| 15% / 85% split | COMPLETE (local logic and test) |
| Delay penalty formula | COMPLETE (local logic and test) |
| 48h lock | COMPLETE (schema + logic) |
| Integer paise accounting | COMPLETE (schema + logic) |
| Idempotent payout processing | PARTIAL |
| Manual admin payout | PARTIAL |
| Live provider payment processing | EXTERNAL BLOCKED |

## 5. Critical caveat
The rules are present in code and tests, but the live financial rails are not active. Real Razorpay and APITXT credentials are needed before any real booking payment, bank verification, or payout can be trusted in production.
