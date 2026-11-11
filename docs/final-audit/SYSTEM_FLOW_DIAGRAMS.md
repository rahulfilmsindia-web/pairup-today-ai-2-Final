# System Flow Diagrams

## 1. Client registration flow
```mermaid
sequenceDiagram
participant U as User
participant FE as Frontend
participant BE as Express Server
participant DB as Local JSON / Supabase
U->>FE: Enter phone and password
FE->>BE: /api/auth/check-phone
BE->>DB: Check user existence
DB-->>BE: Result
BE-->>FE: Registration or login decision
FE->>BE: /api/auth/request-otp
BE-->>FE: OTP challenge sent or local dev code
U->>FE: Submit OTP
FE->>BE: /api/auth/register-with-otp
BE->>DB: Create user record
DB-->>BE: User created
BE-->>FE: Success + session token
```

## 2. Companion activation flow
```mermaid
flowchart TD
A[User chooses COMPANION role] --> B[Submit KYC]
B --> C[Admin KYC review]
C --> D{Approved?}
D -- Yes --> E[Create membership]
D -- No --> F[Resubmission required]
E --> G[Run bank verification]
G --> H{Verified?}
H -- Yes --> I[Companion active]
H -- No --> J[Activation blocked]
```

## 3. Booking lifecycle
```mermaid
flowchart TD
A[Client searches companions] --> B[Server returns matches]
B --> C[Client creates booking]
C --> D[Create Razorpay order]
D --> E[Payment verified]
E --> F[Booking confirmed]
F --> G[Chat and location sharing enabled]
G --> H[Start OTP / completion OTP]
H --> I[Settlement and payout process]
```

## 4. Admin review workflow
```mermaid
flowchart TD
A[Admin logs in] --> B[Verify MFA]
B --> C[Role check]
C --> D[View KYC / finance / support / bookings]
D --> E[Approve, reject, reveal bank, or process payout]
E --> F[Audit log entry]
```

## 5. Location sharing flow
```mermaid
sequenceDiagram
participant C as Client/Companion
participant FE as Frontend
participant BE as Backend
participant FB as Firebase RTDB
C->>FE: Enable location sharing
FE->>BE: /api/location/sharing/start
BE->>FB: Set booking participant sharing flag
FB-->>BE: Confirmation
BE-->>FE: Ready for live tracking
C->>FE: Update current position
FE->>BE: /api/location/update
BE->>FB: Write location
```

## 6. Payment and settlement flow
```mermaid
flowchart TD
A[Booking created] --> B[Razorpay order created]
B --> C[Payment verification]
C --> D[Booking status confirmed]
D --> E[Completion OTP]
E --> F[Settlement calculation]
F --> G[48h lock applied]
G --> H[Admin manual payout]
```
