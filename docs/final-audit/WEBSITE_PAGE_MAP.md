# Website Page Map

## Public website flow
The public website is controlled by [src/App.tsx](../../src/App.tsx) via local state rather than a router library. The page state controls which section renders.

| Page state | Source | Description |
|---|---|---|
| `home` | [src/App.tsx](../../src/App.tsx) | default landing page |
| `about` | [src/pages/AboutPage.tsx](../../src/pages/AboutPage.tsx) | About PairUpToday |
| `how-it-works` | [src/pages/HowItWorksPage.tsx](../../src/pages/HowItWorksPage.tsx) | onboarding and usage steps |
| `safety-trust` | [src/pages/SafetyTrustPage.tsx](../../src/pages/SafetyTrustPage.tsx) | safety and trust information |
| `client-dashboard` | [src/pages/ClientDashboard.tsx](../../src/pages/ClientDashboard.tsx) | client view after login |
| `companion-dashboard` | [src/pages/CompanionDashboard.tsx](../../src/pages/CompanionDashboard.tsx) | companion view after login |

## Major components
- Header: [src/components/Header.tsx](../../src/components/Header.tsx)
- Hero: [src/components/Hero.tsx](../../src/components/Hero.tsx)
- Service grid: [src/components/ServicesGrid.tsx](../../src/components/ServicesGrid.tsx)
- Companion listing: [src/components/CompanionListing.tsx](../../src/components/CompanionListing.tsx)
- Footer: [src/components/Footer.tsx](../../src/components/Footer.tsx)

## Auth and onboarding modals
- Auth gateway: [src/pages/AuthGatewayModal.tsx](../../src/pages/AuthGatewayModal.tsx)
- KYC wizard: [src/pages/KycWizardModal.tsx](../../src/pages/KycWizardModal.tsx)
- Role selection modal: [src/pages/RoleSelectionModal.tsx](../../src/pages/RoleSelectionModal.tsx)

## Admin page
The admin portal is rendered as an isolated mode when the host is admin or the `/admin` path is active. Source: [src/App.tsx](../../src/App.tsx) and [src/admin/AdminPortal.tsx](../../src/admin/AdminPortal.tsx).

## Audit status by page
| Page | Status | Evidence |
|---|---|---|
| Home | COMPLETE (local UI) | [src/App.tsx](../../src/App.tsx), [src/components/Hero.tsx](../../src/components/Hero.tsx) |
| About | COMPLETE (local UI) | [src/pages/AboutPage.tsx](../../src/pages/AboutPage.tsx) |
| How It Works | COMPLETE (local UI) | [src/pages/HowItWorksPage.tsx](../../src/pages/HowItWorksPage.tsx) |
| Safety & Trust | COMPLETE (local UI) | [src/pages/SafetyTrustPage.tsx](../../src/pages/SafetyTrustPage.tsx) |
| Client dashboard | PARTIAL | [src/pages/ClientDashboard.tsx](../../src/pages/ClientDashboard.tsx) |
| Companion dashboard | PARTIAL | [src/pages/CompanionDashboard.tsx](../../src/pages/CompanionDashboard.tsx) |
| Admin portal | PARTIAL | [src/admin/AdminPortal.tsx](../../src/admin/AdminPortal.tsx) |

## Observed gap
The website pages are implemented as a local front-end shell, but the real backend flows and provider-backed data are not live-connected yet.
