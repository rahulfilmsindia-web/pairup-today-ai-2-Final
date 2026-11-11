# API Reference

## Base backend
The main backend is the Express app in [server.ts](../../server.ts). All routes below are defined there unless explicitly noted.

## Authentication and registration
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/auth/check-phone` | POST | [server.ts](../../server.ts) | Check if a phone number is registered | Public |
| `/api/auth/request-otp` | POST | [server.ts](../../server.ts) | Send OTP to a phone number | Public |
| `/api/auth/register-with-otp` | POST | [server.ts](../../server.ts) | Register a user using OTP | Public |
| `/api/auth/verify-otp` | POST | [server.ts](../../server.ts) | Verify OTP challenge | Public |
| `/api/auth/login` | POST | [server.ts](../../server.ts) | Login with phone/password | Public |
| `/api/auth/select-role` | POST | [server.ts](../../server.ts) | Select active role | Authenticated user |

## KYC and onboarding
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/kyc/submit` | POST | [server.ts](../../server.ts) | Submit KYC | Authenticated user |
| `/api/companion/services-rates` | POST | [server.ts](../../server.ts) | Save service pricing and rates | Authenticated companion |
| `/api/companion/membership/subscribe` | POST | [server.ts](../../server.ts) | Create companion membership | Authenticated companion |
| `/api/companion/bank/verify` | POST | [server.ts](../../server.ts) | Verify bank account and compare names | Authenticated companion |
| `/api/companion/availability/toggle` | POST | [server.ts](../../server.ts) | Toggle availability | Authenticated companion |

## Payment APIs
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/payments/razorpay/create-order` | POST | [server.ts](../../server.ts), [server/services/razorpay.ts](../../server/services/razorpay.ts) | Create Razorpay order | Authenticated user |
| `/api/payments/razorpay/verify-payment` | POST | [server.ts](../../server.ts) | Verify Razorpay signature | Public callback handler |
| `/api/payments/razorpay/webhook` | POST | [server.ts](../../server.ts) | Verify and process webhook event | Public webhook |

## Discovery and booking
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/companions/search` | GET | [server.ts](../../server.ts) | Search companions by service and city | Public or authenticated |
| `/api/bookings/create` | POST | [server.ts](../../server.ts) | Create a booking | Authenticated client |

## Admin APIs
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/admin/login` | POST | [server.ts](../../server.ts) | Admin login | Public |
| `/api/admin/verify-mfa` | POST | [server.ts](../../server.ts) | MFA step verification | Admin session |
| `/api/admin/overview` | GET | [server.ts](../../server.ts) | Overview metrics | role-gated admin route |
| `/api/admin/kyc/list` | GET | [server.ts](../../server.ts) | KYC lists | KYC_ADMIN or SUPER_ADMIN |
| `/api/admin/finance/settlements` | GET | [server.ts](../../server.ts) | Settlement ledger | FINANCE_ADMIN or SUPER_ADMIN |
| `/api/admin/finance/reveal-bank` | POST | [server.ts](../../server.ts) | Reveal masked bank details | FINANCE_ADMIN or SUPER_ADMIN |
| `/api/admin/finance/process-payout` | POST | [server.ts](../../server.ts) | Process payout | FINANCE_ADMIN or SUPER_ADMIN |
| `/api/admin/staff` | GET | [server.ts](../../server.ts) | Staff list | SUPER_ADMIN |
| `/api/admin/staff/create` | POST | [server.ts](../../server.ts) | Create staff/admin | SUPER_ADMIN |
| `/api/admin/audit-logs` | GET | [server.ts](../../server.ts) | Audit log listing | SUPER_ADMIN or AUDITOR |
| `/api/admin/clients` | GET | [server.ts](../../server.ts) | Client list | SUPER_ADMIN, KYC_ADMIN, SUPPORT_ADMIN |
| `/api/admin/companions` | GET | [server.ts](../../server.ts) | Companion list | SUPER_ADMIN, KYC_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN |
| `/api/admin/memberships` | GET | [server.ts](../../server.ts) | Membership records | SUPER_ADMIN, FINANCE_ADMIN, AUDITOR |
| `/api/admin/bookings` | GET | [server.ts](../../server.ts) | Booking records | SUPER_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN, AUDITOR |
| `/api/admin/payments` | GET | [server.ts](../../server.ts) | Payment records | SUPER_ADMIN, FINANCE_ADMIN, AUDITOR |

## Support and messaging
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/support/conversation` | POST | [server.ts](../../server.ts) | Start support conversation | Authenticated user |
| `/api/support/message` | POST | [server.ts](../../server.ts) | Send support message | Authenticated user |
| `/api/admin/support/conversations` | GET | [server.ts](../../server.ts) | List support conversations | SUPPORT_ADMIN or SUPER_ADMIN |
| `/api/admin/support/reply` | POST | [server.ts](../../server.ts) | Admin reply | SUPPORT_ADMIN or SUPER_ADMIN |

## Location and presence
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/location/update` | POST | [server.ts](../../server.ts), [server/services/firebase.ts](../../server/services/firebase.ts) | Update live location | Authorized booking participant |
| `/api/location/sharing/start` | POST | [server.ts](../../server.ts) | Start booking-specific sharing | Authorized participant |
| `/api/location/sharing/stop` | POST | [server.ts](../../server.ts) | Stop location sharing | Authorized participant |
| `/api/presence` | POST | [server.ts](../../server.ts), [server/services/firebase.ts](../../server/services/firebase.ts) | Set presence status | Authenticated user |

## Maps APIs
| Route | Method | Source | Purpose | Auth requirement |
|---|---|---|---|---|
| `/api/maps/autocomplete` | GET | [server.ts](../../server.ts), [server/services/googlemaps.ts](../../server/services/googlemaps.ts) | autocomplete predictions | Public |
| `/api/maps/geocode` | GET | [server.ts](../../server.ts), [server/services/googlemaps.ts](../../server/services/googlemaps.ts) | geocode address | Public |
| `/api/maps/reverse-geocode` | GET | [server.ts](../../server.ts), [server/services/googlemaps.ts](../../server/services/googlemaps.ts) | reverse geocoding | Public |
| `/api/maps/distance` | GET | [server.ts](../../server.ts), [server/services/googlemaps.ts](../../server/services/googlemaps.ts) | distance calculations | Public |

## Implementation status by endpoint family
| Endpoint family | Status |
|---|---|
| Auth and OTP | PARTIAL |
| KYC and onboarding | PARTIAL |
| Booking and discovery | PARTIAL |
| Payment and webhook | PARTIAL |
| Admin and RBAC | PARTIAL |
| Maps, Firebase, and provider APIs | EXTERNAL BLOCKED |

## Evidence caveat
The route surface exists, but the live external dependencies remain unconfigured. A route existing does not prove that a real production provider is connected or that live transactions are functioning.
