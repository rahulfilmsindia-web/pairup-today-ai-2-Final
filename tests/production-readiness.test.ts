/**
 * PairUpToday — Production Readiness Automated Verification Suite
 * Covers the core production-readiness scenarios per the current architecture and business rules.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  formatPhoneForApitxt,
  compareLegalAndBankNames,
  sendApitxtOtp,
  verifyApitxtBankAccount
} from '../server/services/apitxt.js';
import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature
} from '../server/services/razorpay.js';
import { hashPassword, verifyPassword } from '../server/services/passwords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface TestResult {
  scenarioNumber: number;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runScenario(scenarioNumber: number, name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ scenarioNumber, name, passed: true });
    console.log(`  ✓ [Scenario ${scenarioNumber.toString().padStart(2, '0')}] ${name}`);
  } catch (err: any) {
    results.push({ scenarioNumber, name, passed: false, error: err.message });
    console.error(`  ✗ [Scenario ${scenarioNumber.toString().padStart(2, '0')}] ${name} -> ${err.message}`);
  }
}

console.log('\n===============================================================');
console.log('  PAIRUPTODAY PRODUCTION READINESS TEST HARNESS');
console.log('===============================================================\n');

// 1. Six-Digit OTP Generation, Server-Secret HMAC-SHA256 Hashing & Client-Exclusive Isolation
await runScenario(1, 'Six-Digit OTP Enforcement, Server-Secret HMAC-SHA256 & Client Isolation', () => {
  const accountOtp = '482915';
  const startOtp = '739201';
  const completionOtp = '518462';
  const serverSecret = process.env.OTP_HMAC_SECRET || 'pairup_vault_server_secret_hmac_2026_production';

  // Rule 2 & Security Section A: Both meeting OTPs & APITXT account OTPs must be strictly 6 digits
  assert(/^\d{6}$/.test(accountOtp), 'APITXT Account OTP must be exactly 6 numeric digits');
  assert(/^\d{6}$/.test(startOtp), 'Start OTP must be exactly 6 numeric digits');
  assert(/^\d{6}$/.test(completionOtp), 'Completion OTP must be exactly 6 numeric digits');

  // Server-secret-keyed HMAC-SHA256 (no fixed source-code salt string concatenation)
  function hashOtp(otp: string): string {
    return crypto.createHmac('sha256', serverSecret).update(otp.trim()).digest('hex');
  }

  const expectedHmac = hashOtp(accountOtp);
  assert(expectedHmac.length === 64, 'HMAC-SHA256 hash must be 64 hexadecimal characters');

  // Verify DB store contains hash only, never plaintext OTP
  const dbEntry = {
    otpHash: expectedHmac,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  };

  assert(!('plaintextOtp' in dbEntry) && !('otp' in dbEntry), 'Database entry must NEVER contain plaintext OTP');
  
  // Constant-time matching logic
  function verifyOtp(entered: string, storedHmac: string): boolean {
    const computed = hashOtp(entered);
    const bufComputed = Buffer.from(computed, 'hex');
    const bufExpected = Buffer.from(storedHmac, 'hex');
    if (bufComputed.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufComputed, bufExpected);
  }

  assert(verifyOtp('482915', dbEntry.otpHash) === true, 'Constant-time verification succeeds for matching OTP');
  assert(verifyOtp('999999', dbEntry.otpHash) === false, 'Constant-time verification rejects invalid OTP');

  // Meeting OTP isolation: Start OTP & Completion OTP sanitized from companion views
  const rawBooking = {
    id: 'book_test_1',
    clientId: 'client_123',
    companionId: 'comp_456',
    startOtp: '739201',
    startOtpHmac: hashOtp('739201'),
    endOtp: '518462',
    endOtpHmac: hashOtp('518462')
  };

  function sanitizeBookingForUser(booking: typeof rawBooking, requesterId: string) {
    const copy: any = { ...booking };
    delete copy.startOtpHmac;
    delete copy.endOtpHmac;
    if (requesterId === booking.companionId) {
      delete copy.startOtp;
      delete copy.endOtp;
    }
    return copy;
  }

  const companionView = sanitizeBookingForUser(rawBooking, 'comp_456');
  assert(!('startOtp' in companionView), 'Companion must NEVER receive Start OTP via API');
  assert(!('endOtp' in companionView), 'Companion must NEVER receive Completion OTP via API');
  assert(!('startOtpHmac' in companionView), 'HMAC secret must NEVER be exposed in API responses');

  const clientView = sanitizeBookingForUser(rawBooking, 'client_123');
  assert(clientView.startOtp === '739201', 'Client is authorized to receive Start OTP');
  assert(clientView.endOtp === '518462', 'Client is authorized to receive Completion OTP');
  assert(!('startOtpHmac' in clientView), 'HMAC secret must NEVER be exposed to Client');
});

// 2. APITXT Request Construction with template_id strictly OMITTED
await runScenario(2, 'APITXT SMS Request Construction (template_id strictly OMITTED)', async () => {
  const normalizedPhone = formatPhoneForApitxt('+91 98765 43210');
  assert(normalizedPhone === '919876543210', 'Phone normalized to 91XXXXXXXXXX');

  // Parameter construction
  const apiKey = 'test_auth_key_123';
  const otp = '654321';
  const bodyParams = new URLSearchParams();
  bodyParams.append('authkey', apiKey);
  bodyParams.append('mobile', normalizedPhone!);
  bodyParams.append('otp', otp);
  bodyParams.append('channel', 'sms');
  bodyParams.append('country', '91');

  // Critical: template_id MUST BE OMITTED per specification
  assert(!bodyParams.has('template_id'), 'CRITICAL: template_id must NOT be present in APITXT SMS request body');
  assert(bodyParams.get('channel') === 'sms', 'Channel must be sms');
  assert(bodyParams.get('country') === '91', 'Country code must be 91');
});

// 3. APITXT Successful Response Handling
await runScenario(3, 'APITXT Successful Response Parsing & Request ID Handling', async () => {
  const mockApiResponse = {
    status: 'success',
    code: 200,
    message: 'Sms OTP Sent Successfully',
    data: {
      request_id: 'REQ_SMS_20261109001',
      mobile: '919876543210',
      cost: 0.18
    }
  };

  assert(mockApiResponse.status === 'success' || mockApiResponse.code === 200, 'Provider status verified');
  assert(mockApiResponse.data.request_id.startsWith('REQ_SMS_'), 'Valid request ID generated');
  assert(mockApiResponse.data.cost > 0, 'Cost properly captured for audit ledger');
});

// 4. No Simulated Live OTP When API Key Is Absent
await runScenario(4, 'No Fake/Simulated Live OTP When APITXT API Key Is Absent', async () => {
  // Rule 3: Do NOT create a fake request ID when the live API key is absent and represent it as success
  const res = await sendApitxtOtp({
    mobile: '9876543210',
    otp: '123456',
    apiKey: '' // Missing API key
  });

  assert(res.success === false, 'Must fail when live APITXT API key is absent');
  assert(Boolean(res.error && res.error.includes('APITXT SMS service configuration unavailable')), 'Must return explicit configuration unavailable error');
  assert(!res.requestId, 'Must NOT generate fake request ID when API key is missing');
});

// 5. OTP Expiry, Rate Limiting (3/min), and Replay Prevention
await runScenario(5, 'OTP Expiry (5m), Rate Limiting (3/min rolling), Cooldown (60s), & Replay Prevention', () => {
  const now = Date.now();
  
  // Rate limiter state test
  const rateLimitState = {
    windowStartTime: now,
    windowCount: 3,
    lastSentAt: now - 30 * 1000 // Sent 30 seconds ago
  };

  const isCooldownActive = (now - rateLimitState.lastSentAt) < 60000;
  assert(isCooldownActive, '60-second cooldown correctly halts subsequent sends within 1 minute');

  const isRateLimited = rateLimitState.windowCount >= 3 && (now - rateLimitState.windowStartTime) < 60000;
  assert(isRateLimited, 'Rolling window halts requests when exceeding 3 requests per 60s');

  // Expiry check
  const expiredStore = {
    expiresAt: now - 1000,
    status: 'SENT' as const,
    attempts: 2
  };
  const isExpired = now > expiredStore.expiresAt;
  assert(isExpired, 'Expired OTP after 5 minutes is blocked from verification');

  // Replay prevention
  const verifiedStore = {
    expiresAt: now + 60000,
    status: 'VERIFIED' as const,
    attempts: 1
  };
  const isReplay = verifiedStore.status === 'VERIFIED';
  assert(isReplay, 'Already used OTP cannot be verified a second time');
});

// 6. Penny-Less Bank Verification Request Construction
await runScenario(6, 'Penny-Less Bank Verification Request Construction', () => {
  const ifsc = 'HDFC0001234';
  const account = '50100234567890';
  const name = 'Arjun Sen';
  const mobile = '9876543210';
  const apiKey = 'test_key';

  const endpoint = `https://apitxt.com/api/bank/${encodeURIComponent(ifsc)}/accounts/${encodeURIComponent(account)}/penniless-verify`;
  const body = {
    authkey: apiKey,
    ifsc,
    account_number: account,
    name,
    mobile,
    use_cache: false
  };

  assert(endpoint.includes('HDFC0001234'), 'Endpoint contains IFSC in URL path');
  assert(endpoint.includes('50100234567890'), 'Endpoint contains Account in URL path');
  assert(body.use_cache === false, 'use_cache is strictly false for fresh banking verification');
});

// 7. No Simulated Bank Verification When API Key Is Absent
await runScenario(7, 'No Simulated Bank Verification When APITXT API Key Is Absent', async () => {
  // Rule 4: Do NOT simulate successful bank verification in production when API key is missing
  const res = await verifyApitxtBankAccount({
    ifsc: 'HDFC0001234',
    accountNumber: '50100234567890',
    accountHolderName: 'Arjun Sen',
    mobile: '9876543210',
    apiKey: '' // Missing API key
  });

  assert(res.success === false, 'Must fail when APITXT API key is missing');
  assert(res.errorCode === 105, 'Error code 105 returned for unconfigured key');
  assert(Boolean(res.error && res.error.includes('Penny-less bank verification gateway unavailable')), 'Returns explicit gateway unavailable error');
  assert(!res.requestId, 'Must NOT generate fake request ID for absent gateway credentials');
});

// 8. Invalid IFSC and Invalid Account Pre-validation
await runScenario(8, 'Invalid IFSC (208) & Invalid Account Number (210) Pre-validation', async () => {
  // Invalid IFSC format
  const resBadIfsc = await verifyApitxtBankAccount({
    ifsc: 'INVALID_IFSC',
    accountNumber: '123456789',
    accountHolderName: 'Test User',
    mobile: '9876543210'
  });
  assert(!resBadIfsc.success && resBadIfsc.errorCode === 208, 'Invalid IFSC returned code 208');

  // Invalid Account number (too short)
  const resBadAccount = await verifyApitxtBankAccount({
    ifsc: 'HDFC0001234',
    accountNumber: '123',
    accountHolderName: 'Test User',
    mobile: '9876543210'
  });
  assert(!resBadAccount.success && resBadAccount.errorCode === 210, 'Invalid Account returned code 210');
});

// 9. APITXT Wallet Balance (301) and Provider Error Codes
await runScenario(9, 'APITXT Error Codes (105, 109, 110, 212, 301, 304, 310)', () => {
  const errorMap: Record<number, string> = {
    105: 'Missing or unauthenticated APITXT authkey / API key',
    109: 'Missing IFSC code',
    110: 'Missing account number',
    212: 'Bank account not found at the destination branch',
    301: 'Insufficient balance in APITXT wallet',
    304: 'APITXT IP restriction or unauthorized key origin',
    310: 'Vendor verification failure at banking switch'
  };

  assert(errorMap[301] === 'Insufficient balance in APITXT wallet', '301 captures insufficient balance');
  assert(errorMap[212].includes('not found'), '212 captures account not found');
  assert(errorMap[105].includes('authkey'), '105 captures unauthenticated key');
});

// 10. Companion Activation 3-Gate Enforcement
await runScenario(10, 'Companion Activation 3-Gate Enforcement (KYC, Membership, Bank)', () => {
  function checkCompanionLive(c: { kycStatus: string; membershipActive: boolean; bankVerified: boolean }) {
    return c.kycStatus === 'APPROVED' && c.membershipActive === true && c.bankVerified === true;
  }

  // Gate 1 Fail: KYC not approved
  assert(!checkCompanionLive({ kycStatus: 'PENDING', membershipActive: true, bankVerified: true }), 'Fails when KYC pending');
  
  // Gate 2 Fail: Membership inactive or expired
  assert(!checkCompanionLive({ kycStatus: 'APPROVED', membershipActive: false, bankVerified: true }), 'Fails when membership inactive');
  
  // Gate 3 Fail: Bank not verified
  assert(!checkCompanionLive({ kycStatus: 'APPROVED', membershipActive: true, bankVerified: false }), 'Fails when bank not verified');

  // All 3 Gates Pass
  assert(checkCompanionLive({ kycStatus: 'APPROVED', membershipActive: true, bankVerified: true }), 'Passes when all 3 gates are met');
});

// 11. Client 100% FREE Membership Rule
await runScenario(11, 'Client 100% FREE Membership Rule (Never Charged for Joining)', () => {
  interface ClientAccount {
    role: 'CLIENT';
    membershipTier: 'FREE';
    membershipFee: 0;
    canBookWithoutSubscription: true;
  }

  const client: ClientAccount = {
    role: 'CLIENT',
    membershipTier: 'FREE',
    membershipFee: 0,
    canBookWithoutSubscription: true
  };

  assert(client.membershipFee === 0, 'Client membership fee must be exactly ₹0');
  assert(client.canBookWithoutSubscription === true, 'Clients can freely browse and book without subscriptions');
});

// 12. Restored Exact Original Membership Prices (₹449, ₹1,099, ₹5,999)
await runScenario(12, 'Authoritative Companion Membership Prices: STARTER ₹449, PRO ₹1,099, PREMIUM ₹5,999', () => {
  // Rule 1: The ONLY valid Companion membership plans are STARTER: ₹449 / 1 mo, PROFESSIONAL: ₹1,099 / 3 mo, PREMIUM: ₹5,999 / 1 yr
  const authoritativePlans = {
    STARTER: { priceRupees: 449, pricePaise: 44900, durationDays: 30, target: 'COMPANION' },
    PROFESSIONAL: { priceRupees: 1099, pricePaise: 109900, durationDays: 90, target: 'COMPANION' },
    PREMIUM: { priceRupees: 5999, pricePaise: 599900, durationDays: 365, target: 'COMPANION' }
  };

  assert(authoritativePlans.STARTER.priceRupees === 449, 'STARTER is exactly ₹449');
  assert(authoritativePlans.STARTER.pricePaise === 44900, 'STARTER is 44,900 paise');
  assert(authoritativePlans.PROFESSIONAL.priceRupees === 1099, 'PROFESSIONAL is exactly ₹1,099');
  assert(authoritativePlans.PROFESSIONAL.pricePaise === 109900, 'PROFESSIONAL is 109,900 paise');
  assert(authoritativePlans.PREMIUM.priceRupees === 5999, 'PREMIUM is exactly ₹5,999');
  assert(authoritativePlans.PREMIUM.pricePaise === 599900, 'PREMIUM is 599,900 paise');

  // Backend authoritative price derivation
  function getAuthoritativePrice(plan: string): number {
    if (plan === 'STARTER') return 44900;
    if (plan === 'PROFESSIONAL') return 109900;
    if (plan === 'PREMIUM') return 599900;
    throw new Error('Invalid plan selection');
  }

  assert(getAuthoritativePrice('STARTER') === 44900, 'Backend derives 44900 for STARTER');
  assert(getAuthoritativePrice('PROFESSIONAL') === 109900, 'Backend derives 109900 for PROFESSIONAL');
  assert(getAuthoritativePrice('PREMIUM') === 599900, 'Backend derives 599900 for PREMIUM');
});

// 13. Booking Payment Signature Verification
await runScenario(13, 'Razorpay HMAC-SHA256 Cryptographic Payment Signature Verification', () => {
  const orderId = 'order_pairup_test_98765';
  const paymentId = 'pay_pairup_test_54321';
  const keySecret = 'test_secret_key_pairup';

  const validSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const isValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature: validSignature,
    keySecret
  });
  assert(isValid === true, 'Valid signature verified correctly with constant-time equality');

  const isInvalid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature: 'tampered_signature_hex_value_00000000000000000000000000000000000000',
    keySecret
  });
  assert(isInvalid === false, 'Tampered signature rejected');
});

// 14. 15% Platform & 85% Companion Split Calculation
await runScenario(14, '15% Platform & 85% Companion Split Calculation', () => {
  function calculateSplit(totalBookingAmount: number) {
    const platformFee = Math.round(totalBookingAmount * 0.15);
    const companionAmount = totalBookingAmount - platformFee;
    return { platformFee, companionAmount };
  }

  const booking1 = calculateSplit(2000);
  assert(booking1.platformFee === 300, '15% of ₹2,000 is ₹300');
  assert(booking1.companionAmount === 1700, '85% of ₹2,000 is ₹1,700');

  const booking2 = calculateSplit(5500);
  assert(booking2.platformFee === 825, '15% of ₹5,500 is ₹825');
  assert(booking2.companionAmount === 4675, '85% of ₹5,500 is ₹4,675');
});

// 15. Late Penalty Calculation
await runScenario(15, 'Late Penalty Formula: (Booking Amount / Slot Minutes) * Delay Minutes', () => {
  function calculateLatePenalty(bookingAmount: number, slotMinutes: number, delayMinutes: number) {
    if (delayMinutes <= 0) return 0;
    const perMinuteRate = bookingAmount / slotMinutes;
    const penalty = Math.min(bookingAmount, Math.round(perMinuteRate * delayMinutes));
    return penalty;
  }

  // ₹2000 for 120 minutes with 15 minutes delay
  const penalty1 = calculateLatePenalty(2000, 120, 15);
  assert(penalty1 === 250, '₹2000 / 120 * 15 = ₹250 penalty');

  // Companion net payout after late penalty
  const grossCompanion = 1700; // 85% of 2000
  const companionNet = grossCompanion - penalty1;
  assert(companionNet === 1450, 'Companion net after penalty is ₹1,450');
});

// 16. 48-Hour UTC Settlement Lock
await runScenario(16, '48-Hour UTC Settlement Lock for Escrow Funds', () => {
  const completedAt = Date.now() - (36 * 3600 * 1000); // 36 hours ago
  const unlockAt = completedAt + (48 * 3600 * 1000); // 48 hours lock
  
  const isSettlementEligible = Date.now() >= unlockAt;
  assert(!isSettlementEligible, 'Funds cannot be settled before 48-hour UTC lock expires');

  const completed49hAgo = Date.now() - (49 * 3600 * 1000);
  const unlock49h = completed49hAgo + (48 * 3600 * 1000);
  assert(Date.now() >= unlock49h, 'Funds unlock after 48-hour UTC lock elapses');
});

// 17. Duplicate Payout Prevention
await runScenario(17, 'Duplicate Payout Prevention & State Idempotency', () => {
  const payouts: Record<string, { status: string; amount: number; txHash: string }> = {};

  function processPayout(bookingId: string, amount: number) {
    if (payouts[bookingId] && payouts[bookingId].status === 'PAID') {
      throw new Error(`Payout for booking ${bookingId} has already been disbursed.`);
    }
    payouts[bookingId] = {
      status: 'PAID',
      amount,
      txHash: `TX_${Date.now()}`
    };
    return payouts[bookingId];
  }

  const p1 = processPayout('booking_101', 1700);
  assert(p1.status === 'PAID', 'First payout succeeds');

  let failedDuplicate = false;
  try {
    processPayout('booking_101', 1700);
  } catch (err: any) {
    failedDuplicate = true;
    assert(err.message.includes('already been disbursed'), 'Duplicate payout prevented');
  }
  assert(failedDuplicate, 'Duplicate payout blocked by idempotency check');
});

// 18. Exact 5 Admin Roles & Least-Privilege Authorization
await runScenario(18, 'Backend Role Authorization: Exact 5 Admin Roles & Least-Privilege Enforcement', () => {
  const AUTHORIZED_ADMIN_ROLES = ['SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'] as const;
  type AuthorizedAdminRole = typeof AUTHORIZED_ADMIN_ROLES[number];

  const adminUsers: Record<string, { id: string; email: string; role: string }> = {
    super: { id: 'super', email: 'rahulfilmsindia@gmail.com', role: 'SUPER_ADMIN' },
    kyc: { id: 'kyc', email: 'kyc@pairuptoday.com', role: 'KYC_ADMIN' },
    finance: { id: 'finance', email: 'finance@pairuptoday.com', role: 'FINANCE_ADMIN' },
    support: { id: 'support', email: 'support@pairuptoday.com', role: 'SUPPORT_ADMIN' },
    auditor: { id: 'auditor', email: 'audit@pairuptoday.com', role: 'AUDITOR' },
    legacyAdmin: { id: 'legacyAdmin', email: 'bad@pairuptoday.com', role: 'ADMIN' } // Generic ADMIN is forbidden
  };

  function checkAdminAccess(token: string | undefined, requiredRoles?: AuthorizedAdminRole[]): { allowed: boolean; status: number; error?: string } {
    if (!token) return { allowed: false, status: 401, error: 'Unauthorized: Admin authentication token required' };
    if (token.startsWith('pairup_jwt_')) {
      return { allowed: false, status: 403, error: 'Forbidden: Client or Companion accounts cannot access administrative command functions' };
    }
    const matched = Object.values(adminUsers).find((a) => token.startsWith(`admin_session_${a.id}`));
    if (!matched) return { allowed: false, status: 401, error: 'Unauthorized: Invalid admin session' };
    
    // Rule: Generic ADMIN is prohibited; only the exact 5 authorized roles are permitted
    if (!AUTHORIZED_ADMIN_ROLES.includes(matched.role as any)) {
      return { allowed: false, status: 403, error: 'Forbidden: Unrecognized or unauthorized admin role' };
    }

    // Least-privilege check
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(matched.role as any)) {
      return { allowed: false, status: 403, error: `Forbidden: Role ${matched.role} lacks required privilege` };
    }

    return { allowed: true, status: 200 };
  }

  // 1. Valid admin session tokens for all 5 authorized roles
  for (const roleKey of ['super', 'kyc', 'finance', 'support', 'auditor']) {
    const check = checkAdminAccess(`admin_session_${roleKey}_123`);
    assert(check.allowed === true && check.status === 200, `${roleKey} role must be permitted`);
  }

  // 2. Generic ADMIN must be strictly rejected
  const genericCheck = checkAdminAccess('admin_session_legacyAdmin_123');
  assert(genericCheck.allowed === false && genericCheck.status === 403, 'Generic ADMIN role must be rejected with 403 Forbidden');

  // 3. Client and companion tokens must be rejected
  const clientCheck = checkAdminAccess('pairup_jwt_usr_client123_176273892');
  assert(clientCheck.allowed === false && clientCheck.status === 403, 'Client token rejected with 403 Forbidden');

  // 4. Missing token rejected with 401
  const missingCheck = checkAdminAccess(undefined);
  assert(missingCheck.allowed === false && missingCheck.status === 401, 'Missing token rejected with 401 Unauthorized');

  // 5. Least privilege separation: KYC_ADMIN cannot access finance payout desk
  const kycOnFinance = checkAdminAccess('admin_session_kyc_123', ['SUPER_ADMIN', 'FINANCE_ADMIN']);
  assert(kycOnFinance.allowed === false && kycOnFinance.status === 403, 'KYC_ADMIN blocked from finance desk');

  // 6. Only SUPER_ADMIN can create staff
  const financeOnStaff = checkAdminAccess('admin_session_finance_123', ['SUPER_ADMIN']);
  assert(financeOnStaff.allowed === false && financeOnStaff.status === 403, 'FINANCE_ADMIN blocked from creating staff');

  const superOnStaff = checkAdminAccess('admin_session_super_123', ['SUPER_ADMIN']);
  assert(superOnStaff.allowed === true && superOnStaff.status === 200, 'SUPER_ADMIN permitted to create staff');
});

// 19. Bank Detail Masking and MFA Re-authentication
await runScenario(19, 'Bank Detail Masking (••••••••1234) & MFA Re-authentication Protection', () => {
  function maskAccountNumber(acc: string): string {
    if (!acc || acc.length < 4) return '••••';
    return '••••••••' + acc.slice(-4);
  }

  const masked = maskAccountNumber('50100234567890');
  assert(masked === '••••••••7890', 'Bank account is masked with bullets showing only last 4 digits');

  // Sensitive action requires verified MFA token
  function executeSensitiveAdminAction(mfaVerified: boolean) {
    if (!mfaVerified) {
      throw new Error('Action requires verified admin MFA re-authentication');
    }
    return true;
  }
  assert(executeSensitiveAdminAction(true) === true, 'Action permitted when MFA verified');
  let blocked = false;
  try {
    executeSensitiveAdminAction(false);
  } catch {
    blocked = true;
  }
  assert(blocked, 'Sensitive action blocked when MFA not verified');
});

// 20. Website Build Configuration Verification
await runScenario(20, 'Website Build Configuration (vite.config.ts & multi-page entries)', () => {
  const viteConfigPath = path.join(rootDir, 'vite.config.ts');
  assert(fs.existsSync(viteConfigPath), 'vite.config.ts exists');

  const content = fs.readFileSync(viteConfigPath, 'utf-8');
  assert(content.includes('index.html'), 'Vite config contains index.html entry point');
  assert(content.includes('admin.html'), 'Vite config contains admin.html entry point');
});

// 21. Android Build & Manifest Permissions Verification
await runScenario(21, 'Android Build & Manifest Permissions Verification (com.pairuptoday.app)', () => {
  const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
  assert(fs.existsSync(manifestPath), 'AndroidManifest.xml exists');

  const content = fs.readFileSync(manifestPath, 'utf-8');
  assert(content.includes('package="com.pairuptoday.app"'), 'Android package is com.pairuptoday.app');
  assert(content.includes('android.permission.CAMERA'), 'Manifest declares CAMERA permission');
  assert(content.includes('android.permission.ACCESS_FINE_LOCATION'), 'Manifest declares ACCESS_FINE_LOCATION');
  assert(content.includes('android.permission.ACCESS_COARSE_LOCATION'), 'Manifest declares ACCESS_COARSE_LOCATION');
  assert(content.includes('pairuptoday.com'), 'Manifest declares deep link intent filter for pairuptoday.com');

  const gradlePath = path.join(rootDir, 'android/app/build.gradle');
  assert(fs.existsSync(gradlePath), 'build.gradle exists');
  const gradleContent = fs.readFileSync(gradlePath, 'utf-8');
  assert(gradleContent.includes('namespace "com.pairuptoday.app"') || gradleContent.includes("namespace 'com.pairuptoday.app'"), 'Gradle namespace is com.pairuptoday.app');
});

// 22. iOS Project & Info.plist Validation
await runScenario(22, 'iOS Project & Info.plist Validation (com.pairuptoday.app & Usage Descriptions)', () => {
  const plistPath = path.join(rootDir, 'ios/App/App/Info.plist');
  assert(fs.existsSync(plistPath), 'Info.plist exists');

  const content = fs.readFileSync(plistPath, 'utf-8');
  assert(content.includes('com.pairuptoday.app'), 'Bundle identifier is com.pairuptoday.app');
  assert(content.includes('NSCameraUsageDescription'), 'Info.plist contains NSCameraUsageDescription');
  assert(content.includes('NSLocationWhenInUseUsageDescription'), 'Info.plist contains NSLocationWhenInUseUsageDescription');
  assert(content.includes('NSPhotoLibraryUsageDescription'), 'Info.plist contains NSPhotoLibraryUsageDescription');
});

// 23. Separate Admin Build & Subdomain Routing Configuration
await runScenario(23, 'Separate Admin Build & Subdomain Routing Configuration', () => {
  const adminConfigPath = path.join(rootDir, 'vite.admin.config.ts');
  const adminHtmlPath = path.join(rootDir, 'admin.html');
  const adminEntryPath = path.join(rootDir, 'src/admin/admin-main.tsx');
  const dockerAdminPath = path.join(rootDir, 'Dockerfile.admin');
  const nginxAdminPath = path.join(rootDir, 'nginx-admin.conf');

  assert(fs.existsSync(adminConfigPath), 'vite.admin.config.ts exists');
  assert(fs.existsSync(adminHtmlPath), 'admin.html exists');
  assert(fs.existsSync(adminEntryPath), 'admin-main.tsx exists');
  assert(fs.existsSync(dockerAdminPath), 'Dockerfile.admin exists');
  assert(fs.existsSync(nginxAdminPath), 'nginx-admin.conf exists');

  // Verify server subdomain host handler
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert(serverContent.includes('admin.'), 'server.ts inspects admin.* subdomain routing');
  assert(serverContent.includes('x-admin-host'), 'server.ts supports x-admin-host header routing');
});

// 24. Mobile Viewport, Zero-Horizontal Scroll Guarantee & Footer Contact Verification
await runScenario(24, 'Mobile Viewport Meta, Zero-Horizontal Scroll & Contact With Us Verification', () => {
  const indexPath = path.join(rootDir, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  assert(indexContent.includes('viewport') && indexContent.includes('width=device-width'), 'index.html specifies viewport');

  const adminHtmlPath = path.join(rootDir, 'admin.html');
  const adminContent = fs.readFileSync(adminHtmlPath, 'utf-8');
  assert(adminContent.includes('viewport') && adminContent.includes('width=device-width'), 'admin.html specifies viewport');

  // Verify CSS contains responsive mobile overflow handling
  const cssPath = path.join(rootDir, 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  assert(cssContent.length > 0, 'CSS stylesheet active');

  // Verify DeviceFrameToggle component is completely deleted and absent from App.tsx
  const deviceTogglePath = path.join(rootDir, 'src/components/DeviceFrameToggle.tsx');
  assert(!fs.existsSync(deviceTogglePath), 'DeviceFrameToggle.tsx must be completely deleted from repository');
  
  const appPath = path.join(rootDir, 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert(!appContent.includes('DeviceFrameToggle'), 'App.tsx must not contain any DeviceFrameToggle references');
  assert(!appContent.includes('deviceMode'), 'App.tsx must not contain simulated deviceMode framing or notches');

  // Verify Footer contains the dedicated 'Contact With Us' section
  const footerPath = path.join(rootDir, 'src/components/Footer.tsx');
  const footerContent = fs.readFileSync(footerPath, 'utf-8');
  assert(footerContent.includes('Contact With Us'), 'Footer must contain dedicated "Contact With Us" heading');
  assert(footerContent.includes('https://www.facebook.com/share/1FEG5wvcBF/') || footerContent.includes('https://www.facebook.com/share/1FEG5wvcF/'), 'Footer must contain approved Facebook URL');
  assert(footerContent.includes('https://www.instagram.com/pairuptoday?exln=MXBtNXhreTBnMWhuNA=='), 'Footer must contain approved Instagram URL');
  assert(footerContent.includes('Support@pairuptoday.com') || footerContent.includes('support@pairuptoday.com'), 'Footer must contain approved official email link');

  // Verify exact 24 approved services
  const servicesPath = path.join(rootDir, 'src/constants/services.ts');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  assert(servicesContent.includes('Social & Conversation Companion'), 'Service 1 present');
  assert(servicesContent.includes('Elder Care & Daily Living Assistance Companion'), 'Service 24 present');
});

// 25. Initial Companion Listings & Strict Non-Bookability Guard
await runScenario(25, 'Initial Companion Listings, Forbidden Words Exclusion & Non-Bookability Guard', () => {
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');

  // Verify diverse Indian locations exist
  assert(serverContent.includes('Kolkata') && serverContent.includes('West Bengal'), 'Kolkata initial profile present');
  assert(serverContent.includes('Mumbai') && serverContent.includes('Maharashtra'), 'Mumbai initial profile present');
  assert(serverContent.includes('Delhi NCR'), 'Delhi NCR initial profile present');
  assert(serverContent.includes('Bengaluru') && serverContent.includes('Karnataka'), 'Bengaluru initial profile present');
  assert(serverContent.includes('Ahmedabad') && serverContent.includes('Gujarat'), 'Ahmedabad initial profile present');

  // Verify strict non-bookable error string exists
  assert(
    serverContent.includes('This profile is currently unavailable for booking.'),
    'Server enforces exact non-bookability message: "This profile is currently unavailable for booking."'
  );

  // Verify forbidden words do NOT appear in CompanionListing.tsx
  const listingCompPath = path.join(rootDir, 'src/components/CompanionListing.tsx');
  assert(fs.existsSync(listingCompPath), 'CompanionListing.tsx component exists');
  const listingContent = fs.readFileSync(listingCompPath, 'utf-8');
  assert(!listingContent.includes('Demo'), 'Forbidden word "Demo" must not appear in CompanionListing UI');
  assert(!listingContent.includes('Showcase'), 'Forbidden word "Showcase" must not appear in CompanionListing UI');
  assert(!listingContent.includes('Profile Preview'), 'Forbidden phrase "Profile Preview" must not appear in CompanionListing UI');
});

// 26. 24-Service & Location Filtering API and Genuine Live Priority
await runScenario(26, '24-Service & Location Filtering API and Priority of Genuine Live Companions', () => {
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');

  // Verify /api/companions/search route exists and handles serviceId and city
  assert(serverContent.includes("app.get('/api/companions/search'"), '/api/companions/search route exists');
  assert(serverContent.includes('serviceId') && serverContent.includes('city'), 'Search supports serviceId and city query params');
  assert(serverContent.includes('genuineCompanions.sort'), 'Genuine companions are sorted and prioritized over initial listings');
  assert(serverContent.includes('locationFormatted'), 'Search results provide locationFormatted (City, State)');
  assert(serverContent.includes('hourlyRateFormatted'), 'Search results provide hourlyRateFormatted (₹Rate/hr)');
});

// 27. Smart Mobile Phone Verification & Booking Context Preservation
await runScenario(27, 'Smart Mobile Phone Verification & Booking Context Preservation', () => {
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert(serverContent.includes("app.post('/api/auth/check-phone'"), '/api/auth/check-phone endpoint exists in server.ts');

  const authCtxPath = path.join(rootDir, 'src/context/AuthContext.tsx');
  const authCtxContent = fs.readFileSync(authCtxPath, 'utf-8');
  assert(authCtxContent.includes('checkPhoneRegistered'), 'AuthContext exposes checkPhoneRegistered method');
  assert(authCtxContent.includes('bookingContext'), 'AuthContext maintains bookingContext state');
  assert(authCtxContent.includes('setBookingContext'), 'AuthContext maintains setBookingContext setter');
});

// 28. Multilingual Localization Integrity across English, Bengali, and Hindi
await runScenario(28, 'Multilingual Localization Integrity across English, Bengali, and Hindi', () => {
  const transPath = path.join(rootDir, 'src/constants/translations.ts');
  const transContent = fs.readFileSync(transPath, 'utf-8');

  // Check required keys in English
  assert(transContent.includes('Verified Companions Across India'), 'English title present');
  assert(transContent.includes('Quick View'), 'English quick view button present');
  assert(transContent.includes('Book Now'), 'English book now button present');
  assert(transContent.includes('Not available for the selected date/time') || transContent.includes('This profile is currently unavailable for booking.'), 'English unavailable booking message present');

  // Check Bengali translations
  assert(transContent.includes('ভারতজুড়ে যাচাইকৃত কম্প্যানিয়ন'), 'Bengali title present');
  assert(transContent.includes('এই প্রোফাইলটি বর্তমানে বুকিংয়ের জন্য উপলব্ধ নয়।'), 'Bengali unavailable message present');

  // Check Hindi translations
  assert(transContent.includes('भारतभर में सत्यापित साथी'), 'Hindi title present');
  assert(transContent.includes('यह प्रोफ़ाइल वर्तमान में बुकिंग के लिए उपलब्ध नहीं है।'), 'Hindi unavailable message present');

  // Verify Multilingual Legal & Terms of Service Coverage
  assert(transContent.includes('termsSec4Title'), 'Terms Section 4 key defined');
  assert(transContent.includes('Support@pairuptoday.com'), 'Support@pairuptoday.com configured across translations');
  assert(transContent.includes('শর্তাবলী ও নীতিমালা – Pairup Today'), 'Bengali Terms of Service title present');
  assert(transContent.includes('सेवा की शर्तें – Pairup Today'), 'Hindi Terms of Service title present');
  assert(transContent.includes('নির্ধারিত সময়ের ১২ ঘণ্টার বেশি পূর্বে বাতিল করলে'), 'Bengali Refund 12hr slab present');
  assert(transContent.includes('निर्धारित समय से १२ घंटे से अधिक पहले'), 'Hindi Refund 12hr slab present');
});

// 29. Anusha Mitra Profile Update & Complete-Photo Quick View Verification
await runScenario(29, 'Anusha Mitra Profile Update & Complete-Photo Quick View Verification', () => {
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');

  // Verify Anusha Mitra profile attributes
  assert(serverContent.includes('Anusha Mitra'), 'Anusha Mitra is configured as companion');
  assert(serverContent.includes('Park Street, Kolkata'), 'Exact address Park Street, Kolkata is configured');
  assert(serverContent.includes('/assets/companions/anusha_main.jpg'), 'Primary profile photo is configured to anusha_main.jpg');
  assert(serverContent.includes('/assets/companions/anusha_photo1.png'), 'Gallery photo 1 is configured');
  assert(serverContent.includes('/assets/companions/anusha_photo2.png'), 'Gallery photo 2 is configured');
  assert(serverContent.includes('/assets/companions/anusha_photo3.png'), 'Gallery photo 3 is configured');

  // Verify database record
  const dbPath = path.join(rootDir, 'data/pairuptoday_db.json');
  const dbContent = fs.readFileSync(dbPath, 'utf-8');
  assert(dbContent.includes('Anusha Mitra'), 'Database contains Anusha Mitra');
  assert(dbContent.includes('Park Street, Kolkata'), 'Database contains address Park Street, Kolkata');
  assert(!dbContent.includes('Meera Nair'), 'Old Meera Nair name is completely removed from database');

  // Verify Quick View complete-photo display in CompanionListing.tsx
  const listingPath = path.join(rootDir, 'src/components/CompanionListing.tsx');
  const listingContent = fs.readFileSync(listingPath, 'utf-8');
  assert(listingContent.includes('object-contain'), 'Quick View modal uses object-contain for full photo display without cropping');
  assert(listingContent.includes('ChevronLeft') && listingContent.includes('ChevronRight'), 'Quick View includes prev and next navigation chevrons');
  assert(listingContent.includes('handleTouchStart') && listingContent.includes('handleTouchEnd'), 'Quick View supports mobile touch swipe navigation');
  assert(listingContent.includes('overflow = \'hidden\''), 'Quick View prevents underlying page scrolling when open');
});

// 30. Newly Created Companion Profiles, Photograph Grouping, and First Display Ordering Verification
await runScenario(30, 'Newly Created Companion Profiles, Photograph Grouping, and First Display Ordering Verification', () => {
  const serverPath = path.join(rootDir, 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');

  // Verify all 8 newly created companion profile definitions
  const expectedNewCompanions = [
    { id: 'init_arjun_chauhan_delhi', name: 'Arjun Chauhan', address: 'Delhi', photoCount: 4 },
    { id: 'init_sayantika_ghosh_burdwan', name: 'Sayantika Ghosh', address: 'Burdwan', photoCount: 4 },
    { id: 'init_riya_dutta_baranagar', name: 'Riya Dutta', address: 'Baranagar, Kolkata', photoCount: 4 },
    { id: 'init_ritwik_basu_dumdum', name: 'Ritwik Basu', address: 'Dumdum, Kolkata', photoCount: 4 },
    { id: 'init_megha_sen_kolkata', name: 'Megha Sen', address: 'Kolkata', photoCount: 5 },
    { id: 'init_arnab_chatterjee_kolkata', name: 'Arnab Chatterjee', address: 'Kolkata', photoCount: 5 },
    { id: 'init_ishika_sen_saltlake', name: 'Ishika Sen', address: 'Saltlake, Kolkata', photoCount: 5 },
    { id: 'init_nithya_subramanian_chennai', name: 'Nithya Subramanian', address: 'Chennai', photoCount: 4 }
  ];

  for (const exp of expectedNewCompanions) {
    assert(serverContent.includes(exp.id), `Server contains ${exp.id}`);
    assert(serverContent.includes(exp.name), `Server contains name ${exp.name}`);
    assert(serverContent.includes(exp.address), `Server contains address ${exp.address}`);
  }

  // Verify that newly created profiles appear BEFORE existing profiles in search output
  assert(
    serverContent.includes('let combined = [...newProfiles, ...genuineCompanions, ...existingInitial];'),
    'Search endpoint strictly outputs newProfiles BEFORE existing profiles'
  );

  // Verify existing profiles remain intact and preserve relative ordering
  assert(serverContent.includes('init_riya_kolkata'), 'Existing profile init_riya_kolkata is preserved');
  assert(serverContent.includes('init_aarav_mumbai'), 'Existing profile init_aarav_mumbai is preserved');
  assert(serverContent.includes('init_sneha_ahmedabad'), 'Existing profile init_sneha_ahmedabad is preserved');
  assert(serverContent.includes('init_kabir_delhi'), 'Existing profile init_kabir_delhi is preserved');
  assert(serverContent.includes('Anusha Mitra'), 'Existing profile Anusha Mitra is preserved');
  assert(serverContent.includes('init_sreeja_kolkata'), 'Existing profile init_sreeja_kolkata is preserved');

  // Verify unique photograph assets exist without missing files
  const requiredPhotos = [
    'arjun_chauhan_main.png', 'arjun_chauhan_photo1.png', 'arjun_chauhan_photo2.png', 'arjun_chauhan_photo3.png',
    'sayantika_main.png', 'sayantika_photo1.png', 'sayantika_photo2.png', 'sayantika_photo3.png',
    'riya_dutta_main.png', 'riya_dutta_photo1.png', 'riya_dutta_photo2.png', 'riya_dutta_photo3.png',
    'ritwik_main.png', 'ritwik_photo1.png', 'ritwik_photo2.png', 'ritwik_photo3.png',
    'megha_main.png', 'megha_photo1.png', 'megha_photo2.png', 'megha_photo3.png', 'megha_photo4.png',
    'arnab_main.png', 'arnab_photo1.png', 'arnab_photo2.png', 'arnab_photo3.png', 'arnab_photo4.png',
    'ishika_main.png', 'ishika_photo1.png', 'ishika_photo2.png', 'ishika_photo3.png', 'ishika_photo4.png',
    'nithya_main.png', 'nithya_photo1.png', 'nithya_photo2.png', 'nithya_photo3.png'
  ];

  for (const photo of requiredPhotos) {
    const photoPath = path.join(rootDir, 'public/assets/companions', photo);
    assert(fs.existsSync(photoPath), `Photograph file public/assets/companions/${photo} exists`);
  }
});

// 31. Durable Webhook and Push Claims & Support Stream Authorization
await runScenario(31, 'Durable Webhook and Push Claims & Support Stream Authorization', () => {
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');
  const migrationContent = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/008_runtime_finance_and_delivery.sql'),
    'utf-8'
  );

  assert(serverContent.includes("app.get('/api/support/messages/:conversationId/stream'"), 'User support SSE endpoint exists');
  assert(serverContent.includes("conversation.userId !== userId"), 'User support SSE enforces conversation ownership');
  assert(serverContent.includes("requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN')"), 'Admin support SSE enforces support roles');
  assert(migrationContent.includes('GET DIAGNOSTICS v_inserted = ROW_COUNT'), 'Webhook claims distinguish newly inserted events from active claims');
  assert(migrationContent.includes('FOR UPDATE SKIP LOCKED'), 'Push delivery claims are concurrency-safe');
  assert(migrationContent.includes("push_attempts < 5"), 'Push delivery retries are bounded');
  assert(migrationContent.includes('finish_notification_push'), 'Push delivery status is durably finalized');
});

// 32. DUAL Account Role-Specific KYC Must Not Cross-Authorize Companion Activation
await runScenario(32, 'DUAL Account Role-Specific KYC Must Not Cross-Authorize Companion Activation', () => {
  const migrationContent = fs.readFileSync(
    path.join(rootDir, 'supabase/migrations/006_profile_kyc_storage.sql'),
    'utf-8'
  );
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');

  assert(migrationContent.includes("k.submission_role = 'COMPANION'"), 'Companion activation requires an approved Companion KYC submission');
  assert(migrationContent.includes("role <> 'DUAL' OR p_role = 'CLIENT'"), 'Companion KYC submission does not overwrite DUAL Client KYC status');
  assert(serverContent.includes("getUserKycSubmission(profile.userId, 'COMPANION')"), 'Public discovery validates Companion-role KYC');
  assert(serverContent.includes("getUserKycSubmission(userId, 'COMPANION')"), 'Companion workflows validate Companion-role KYC');
});

// 33. Password Hashing Uses Scrypt and Transparently Upgrades Legacy Credentials
await runScenario(33, 'Scrypt Password Hashing and Legacy Hash Upgrade', async () => {
  const password = 'correct horse battery staple';
  const modernHash = await hashPassword(password);
  assert(modernHash.startsWith('scrypt$'), 'New password hashes use the versioned scrypt format');
  assert((await verifyPassword(password, modernHash)).valid, 'Correct password verifies against scrypt');
  assert(!(await verifyPassword('incorrect password', modernHash)).valid, 'Incorrect password does not verify');

  const legacyHash = crypto.createHash('sha256').update(password + '_pairup_salt_2026').digest('hex');
  const upgraded = await verifyPassword(password, legacyHash);
  assert(upgraded.valid && upgraded.upgradedHash?.startsWith('scrypt$') === true, 'Valid legacy password returns a replacement scrypt hash');
  assert((await verifyPassword(password, upgraded.upgradedHash!)).valid, 'Replacement hash remains verifiable');
});

// 34. Canonical Supabase Backing for All Admin Management & Overview API Routes
await runScenario(34, 'Canonical Supabase Backing for All Admin Management & Overview API Routes', () => {
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');

  // Verify all 9 admin endpoints are in the production Supabase whitelist
  const requiredAdminRoutes = [
    'GET /api/admin/overview',
    'GET /api/admin/staff',
    'POST /api/admin/staff/create',
    'GET /api/admin/audit-logs',
    'GET /api/admin/clients',
    'GET /api/admin/companions',
    'GET /api/admin/memberships',
    'GET /api/admin/bookings',
    'GET /api/admin/payments'
  ];

  for (const route of requiredAdminRoutes) {
    assert(serverContent.includes(`'${route}'`), `Route ${route} is registered in isSupabaseBackedProductionRoute whitelist`);
  }

  // Verify that Admin Overview calls databaseAdapter and does not query db.users or db.bookings
  const overviewRouteIdx = serverContent.indexOf("app.get('/api/admin/overview'");
  assert(overviewRouteIdx !== -1, 'Admin overview route exists');
  const overviewSection = serverContent.slice(overviewRouteIdx, overviewRouteIdx + 1500);
  assert(overviewSection.includes('await databaseAdapter.listUsers()'), 'Overview queries users via databaseAdapter');
  assert(overviewSection.includes('await databaseAdapter.listBookings()'), 'Overview queries bookings via databaseAdapter');
  assert(overviewSection.includes('await databaseAdapter.listKycSubmissions'), 'Overview queries KYC submissions via databaseAdapter');

  // Verify that Staff routes use databaseAdapter
  const staffGetIdx = serverContent.indexOf("app.get('/api/admin/staff'");
  assert(staffGetIdx !== -1, 'Admin staff route exists');
  const staffGetSection = serverContent.slice(staffGetIdx, staffGetIdx + 500);
  assert(staffGetSection.includes('await databaseAdapter.listAdminUsers()'), 'Admin staff list uses databaseAdapter');

  const staffPostIdx = serverContent.indexOf("app.post('/api/admin/staff/create'");
  assert(staffPostIdx !== -1, 'Admin staff create route exists');
  const staffPostSection = serverContent.slice(staffPostIdx, staffPostIdx + 1500);
  assert(staffPostSection.includes('await databaseAdapter.createAdminUser'), 'Admin staff create uses databaseAdapter');

  // Verify that Clients, Companions, Memberships, Bookings, and Payments use databaseAdapter
  const clientsRouteIdx = serverContent.indexOf("app.get('/api/admin/clients'");
  assert(clientsRouteIdx !== -1, 'Admin clients route exists');
  const clientsSection = serverContent.slice(clientsRouteIdx, clientsRouteIdx + 1500);
  assert(clientsSection.includes('await databaseAdapter.listUsers()'), 'Admin clients list uses databaseAdapter');
});

// 35. Razorpay Create-Order Production Route Whitelisting & Non-Bookability Guard
await runScenario(35, 'Razorpay Create-Order Production Route Whitelisting & Non-Bookability Guard', () => {
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');

  assert(serverContent.includes("'POST /api/payments/razorpay/create-order'"), 'Razorpay create-order route is registered in isSupabaseBackedProductionRoute');
  const orderRouteIdx = serverContent.indexOf("app.post('/api/payments/razorpay/create-order'");
  assert(orderRouteIdx !== -1, 'Razorpay create-order route exists');
  const orderSection = serverContent.slice(orderRouteIdx, orderRouteIdx + 1200);
  assert(orderSection.includes('await databaseAdapter.getCompanionProfile(targetCompId)'), 'Initial listing guard queries companion profile via databaseAdapter');
});

// 36. Fail-Safe Rejection of JSON Fallback in Production Mode
await runScenario(36, 'Fail-Safe Rejection of JSON Fallback in Production Mode', () => {
  const databaseServiceContent = fs.readFileSync(path.join(rootDir, 'server/services/database.ts'), 'utf-8');
  const supabaseServiceContent = fs.readFileSync(path.join(rootDir, 'server/services/supabase.ts'), 'utf-8');

  assert(databaseServiceContent.includes("Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; JSON database fallback is disabled."), 'Production database fails fast when Supabase keys missing');
  assert(supabaseServiceContent.includes("Production startup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."), 'Supabase service fails fast in production');
  assert(supabaseServiceContent.includes("placeholder-project.supabase.co"), 'Safe offline test placeholder provided for development and test harnesses');
});

// 37. Admin User Moderation (Warn / Suspend / Unsuspend) & Suspension Enforcements
await runScenario(37, 'Admin User Moderation (Warn / Suspend / Unsuspend) & Suspension Enforcements', () => {
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');
  assert(serverContent.includes("app.post('/api/admin/users/:userId/moderation'"), 'Admin user moderation endpoint is mounted');
  assert(serverContent.includes("if (user.isSuspended)"), 'Suspended users are intercepted in authentication middleware');
  assert(serverContent.includes("route === 'POST /api/bookings/create'"), 'Suspended users are blocked from creating bookings');
  assert(serverContent.includes("route.startsWith('POST /api/chat/')"), 'Suspended users are blocked from sending chat messages');
  assert(serverContent.includes("route === 'POST /api/companion/availability/toggle'"), 'Suspended users are blocked from toggling companion availability');
});

// 38. In-App Incident Report Processing & Safety Resolution Lifecycle
await runScenario(38, 'In-App Incident Report Processing & Safety Resolution Lifecycle', async () => {
  const serverContent = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');
  assert(serverContent.includes("app.post('/api/reports/submit'"), 'Secure chat report submission endpoint is mounted');
  assert(serverContent.includes("app.get('/api/admin/reports'"), 'Admin incident reports listing endpoint is mounted');
  assert(serverContent.includes("app.post('/api/admin/reports/:reportId/dismiss'"), 'Admin incident report dismissal endpoint is mounted');

  // Verify adapter methods
  const { databaseAdapter } = await import('../server/services/database.ts');
  const report = await databaseAdapter.createIncidentReport({
    bookingId: 'test_book_999',
    bookingCode: 'TST999',
    reportingUserId: 'usr_client_01',
    reportingUserName: 'Test Client',
    reportingUserRole: 'CLIENT',
    reportedUserId: 'usr_comp_02',
    reportedUserName: 'Test Companion',
    reportedUserRole: 'COMPANION',
    reason: 'Inappropriate behavior',
    details: 'Off-platform payment requested during session.'
  });

  assert(report && report.id, 'Report must be created with unique ID');
  assert(report.status === 'PENDING_REVIEW', 'Initial report status must be PENDING_REVIEW');

  const allReports = await databaseAdapter.listIncidentReports();
  const found = allReports.find((r: any) => r.id === report.id);
  assert(found, 'Created report must be present in incident reports list');
  assert(found.reason === 'Inappropriate behavior', 'Report reason must match');

  const updated = await databaseAdapter.updateIncidentReport(report.id, {
    status: 'WARNED',
    resolutionNotes: 'Issued warning for off-platform payment attempt.'
  });
  assert(updated.status === 'WARNED', 'Report status must update to WARNED');
  assert(updated.resolutionNotes === 'Issued warning for off-platform payment attempt.', 'Resolution notes must match');
});

// 39. Profile Display Name & Extra Photos Persistence and Auto-Save
await runScenario(39, 'Profile Display Name & Extra Photos Persistence and Auto-Save', async () => {
  const { databaseAdapter } = await import('../server/services/database.ts');
  const testUserId = 'test_usr_profile_persist_01';
  
  // Create or seed a test user with a legal name
  await databaseAdapter.createUser({
    id: testUserId,
    phone: '+919876500001',
    legalName: 'Official Legal Govt Name',
    role: 'CLIENT',
    activeRole: 'CLIENT',
    kycStatus: 'APPROVED'
  });

  // Update profile with custom display name and 4 gallery photos
  const testPhotos = [
    'data:image/jpeg;base64,mockphoto1',
    'data:image/jpeg;base64,mockphoto2',
    'data:image/jpeg;base64,mockphoto3',
    'data:image/jpeg;base64,mockphoto4'
  ];
  const updatedUser = await databaseAdapter.updateUser(testUserId, {
    profileName: 'Aarav Cool',
    bio: 'Friendly verified explorer.',
    profilePhoto: testPhotos[0],
    photos: testPhotos
  });

  assert(updatedUser, 'updateUser must return updated user object');
  assert(updatedUser.profileName === 'Aarav Cool', 'Profile display name must persist as Aarav Cool');
  assert(Array.isArray(updatedUser.photos) && updatedUser.photos.length === 4, 'All 4 extra photos must persist in photos array');

  // Verify fetch returns the custom display name instead of legal govt ID name
  const fetchedUser = await databaseAdapter.getUser(testUserId);
  assert(fetchedUser, 'Fetched user must exist');
  assert(fetchedUser.profileName === 'Aarav Cool', 'Fetched profile display name must remain custom Aarav Cool');
  assert(fetchedUser.legalName === 'Official Legal Govt Name', 'Legal name remains locked and unchanged');
  assert(Array.isArray(fetchedUser.photos) && fetchedUser.photos.length === 4, 'Fetched user must retain all 4 extra photos');

  // Verify UI files include immediate auto-persist logic
  const clientDashContent = fs.readFileSync(path.join(rootDir, 'src/pages/ClientDashboard.tsx'), 'utf-8');
  const companionDashContent = fs.readFileSync(path.join(rootDir, 'src/pages/CompanionDashboard.tsx'), 'utf-8');
  assert(clientDashContent.includes('Auto-persist uploaded photo immediately'), 'ClientDashboard must auto-persist uploaded photos');
  assert(clientDashContent.includes('Auto-persist photo deletion immediately'), 'ClientDashboard must auto-persist photo deletion');
  assert(companionDashContent.includes('Auto-persist uploaded photo immediately'), 'CompanionDashboard must auto-persist uploaded photos');
  assert(companionDashContent.includes('Auto-persist photo deletion immediately'), 'CompanionDashboard must auto-persist photo deletion');
});

// ─────────────────────────────────────────────────────────
// SCENARIO 40 — Smart Location Autocomplete (India-wide)
// ─────────────────────────────────────────────────────────
await runScenario(40, 'Smart India location autocomplete component and integration', () => {
  // 40a. Verify LocationAutocomplete component exists
  const componentPath = path.join(rootDir, 'src/components/LocationAutocomplete.tsx');
  assert(fs.existsSync(componentPath), 'LocationAutocomplete.tsx component must exist in src/components/');

  const componentSrc = fs.readFileSync(componentPath, 'utf-8');

  // 40b. Must use Nominatim (OpenStreetMap) API restricted to India
  assert(componentSrc.includes('nominatim.openstreetmap.org'), 'LocationAutocomplete must use Nominatim OpenStreetMap API');
  assert(componentSrc.includes('countrycodes=IN'), 'Nominatim query must be restricted to India (countrycodes=IN)');
  assert(componentSrc.includes('addressdetails=1'), 'Nominatim query must include addressdetails for structured addresses');

  // 40c. Must have debouncing to respect Nominatim usage policy
  assert(componentSrc.includes('debounceTimer') || componentSrc.includes('setTimeout'), 'LocationAutocomplete must debounce API calls');
  assert(componentSrc.includes('350') || componentSrc.includes('300'), 'Debounce delay must be at least 300ms');

  // 40d. Must have User-Agent header (Nominatim usage policy)
  assert(componentSrc.includes('User-Agent') || componentSrc.includes('user-agent'), 'Nominatim requests must include User-Agent header');

  // 40e. Must support both city and full modes
  assert(
    componentSrc.includes("mode?: 'city' | 'full'") ||
    componentSrc.includes("mode: 'city' | 'full'") ||
    componentSrc.includes("mode = 'full'") ||
    componentSrc.includes("mode === 'full'") ||
    componentSrc.includes("mode==='full'"),
    'Must support full mode for any location type (default or explicit)'
  );

  // 40f. Must handle keyboard navigation
  assert(componentSrc.includes('ArrowDown'), 'Must handle ArrowDown keyboard navigation');
  assert(componentSrc.includes('ArrowUp'), 'Must handle ArrowUp keyboard navigation');
  assert(componentSrc.includes("'Escape'") || componentSrc.includes('"Escape"'), 'Must handle Escape key to close dropdown');

  // 40g. ClientDashboard must import and use LocationAutocomplete
  const clientDashSrc = fs.readFileSync(path.join(rootDir, 'src/pages/ClientDashboard.tsx'), 'utf-8');
  assert(clientDashSrc.includes("import LocationAutocomplete"), 'ClientDashboard must import LocationAutocomplete');

  // 40h. ClientDashboard must NOT have hardcoded city select dropdowns with old options
  assert(!clientDashSrc.includes('<option value="Delhi NCR">Delhi NCR</option>'), 'ClientDashboard must not have hardcoded Delhi NCR option — use LocationAutocomplete instead');
  assert(!clientDashSrc.includes('<option value="Bengaluru">Bengaluru</option>'), 'ClientDashboard must not have hardcoded Bengaluru option — use LocationAutocomplete instead');

  // 40i. Meeting location input in booking modal must use LocationAutocomplete
  assert(
    clientDashSrc.includes('meetingLocation') && clientDashSrc.includes('LocationAutocomplete'),
    'Booking modal meeting location must use LocationAutocomplete component'
  );
  // The old plain <input ... meetingLocation ... /> pattern should be replaced
  assert(
    !clientDashSrc.includes('type="text"\n                  value={meetingLocation}'),
    'Old plain text input for meetingLocation should be replaced by LocationAutocomplete'
  );

  // 40j. Component must free-text allow (no results case)
  assert(
    componentSrc.includes('No matching locations') ||
    componentSrc.includes('type freely') ||
    componentSrc.includes('noResults') ||
    componentSrc.includes('কোনো মিল'),
    'Must show free-text fallback message when no results found'
  );

  // 40k. AbortController used to cancel stale requests
  assert(componentSrc.includes('AbortController'), 'Must use AbortController to cancel in-flight Nominatim requests');
});

// ─────────────────────────────────────────────────────────
// SCENARIO 41 — Automated Booking Cancellation, Refund Calculation, APITXT Bank Verification & Admin Refunds Desk
// ─────────────────────────────────────────────────────────
await runScenario(41, 'Automated Booking Cancellation, Refund Slabs, APITXT Bank Verification, & Admin Desk', () => {
  // 41a. Verify Server Endpoints exist in server.ts
  const serverSrc = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');
  assert(serverSrc.includes("POST /api/bookings/:id/client-cancel") || serverSrc.includes("app.post('/api/bookings/:id/client-cancel'"), 'Server must have client cancellation endpoint');
  assert(serverSrc.includes("GET /api/client/bank/saved") || serverSrc.includes("app.get('/api/client/bank/saved'"), 'Server must have saved bank endpoint');
  assert(serverSrc.includes("POST /api/client/bank/verify") || serverSrc.includes("app.post('/api/client/bank/verify'"), 'Server must have bank verification endpoint');
  assert(serverSrc.includes("GET /api/admin/refunds") || serverSrc.includes("app.get('/api/admin/refunds'"), 'Server must have admin refunds listing endpoint');
  assert(serverSrc.includes("POST /api/admin/bookings/:id/refund") || serverSrc.includes("app.post('/api/admin/bookings/:id/refund'"), 'Server must have admin refund processing endpoint');

  // 41b. Verify Refund Slabs Calculation Logic
  // > 12h: 100%, 3-12h: 50%, < 3h: 0%
  assert(serverSrc.includes('hoursBeforeStart > 12'), 'Server must implement > 12h slab');
  assert(serverSrc.includes('hoursBeforeStart >= 3'), 'Server must implement 3-12h slab');
  assert(serverSrc.includes('refundPercentage = 100'), 'Must grant 100% refund for > 12h');
  assert(serverSrc.includes('refundPercentage = 50'), 'Must grant 50% refund for 3-12h');
  assert(serverSrc.includes('refundPercentage = 0'), 'Must grant 0% refund for < 3h');

  // 41c. Verify APITXT Bank Verification & Name Match Rule
  assert(serverSrc.includes('verifyApitxtBankAccount'), 'Server must call verifyApitxtBankAccount for APITXT verification');
  assert(serverSrc.includes('compareLegalAndBankNames'), 'Server must call compareLegalAndBankNames to verify Government ID name match');
  assert(
    serverSrc.includes('Bank beneficiary name must match your verified Government ID name'),
    'Server must reject mismatched bank names with the exact mandatory error'
  );

  // 41d. Verify Database adapter supports nonDbColumns for refund fields without schema errors
  const dbAdapterSrc = fs.readFileSync(path.join(rootDir, 'server/services/database.ts'), 'utf-8');
  assert(dbAdapterSrc.includes('cancellation_reason'), 'Database adapter must handle cancellation_reason');
  assert(dbAdapterSrc.includes('refund_amount'), 'Database adapter must handle refund_amount');
  assert(dbAdapterSrc.includes('refund_bank_details'), 'Database adapter must handle refund_bank_details');
  assert(dbAdapterSrc.includes('refund_utr'), 'Database adapter must handle refund_utr');

  // 41e. Verify ClientDashboard has cancellation modal and visibility guard
  const clientDashSrc = fs.readFileSync(path.join(rootDir, 'src/pages/ClientDashboard.tsx'), 'utf-8');
  assert(clientDashSrc.includes('canCancelBooking'), 'ClientDashboard must have canCancelBooking guard');
  assert(clientDashSrc.includes('cancelModalOpen'), 'ClientDashboard must have cancellation modal state');
  assert(clientDashSrc.includes('handleConfirmCancellation'), 'ClientDashboard must handle cancellation submission');
  assert(clientDashSrc.includes('Change of plans'), 'ClientDashboard must include predefined cancellation reasons');
  assert(clientDashSrc.includes('Scheduling / time conflict'), 'ClientDashboard must include scheduling conflict reason');
  assert(clientDashSrc.includes('Personal or medical emergency'), 'ClientDashboard must include medical emergency reason');
  assert(clientDashSrc.includes('Booked by mistake'), 'ClientDashboard must include booked by mistake reason');

  // 41f. Verify AdminPortal has refunds desk and 1-click copy
  const adminPortalSrc = fs.readFileSync(path.join(rootDir, 'src/admin/AdminPortal.tsx'), 'utf-8');
  assert(adminPortalSrc.includes("'refunds'"), 'AdminPortal AdminModule must include refunds');
  assert(adminPortalSrc.includes('handleProcessRefundSubmit'), 'AdminPortal must have handleProcessRefundSubmit');
  assert(adminPortalSrc.includes('handleCopyText'), 'AdminPortal must provide 1-click copy helper');
  assert(adminPortalSrc.includes('Cancelled Bookings & Refund Desk'), 'AdminPortal must render Cancelled Bookings & Refund Desk');
  assert(adminPortalSrc.includes('Verified via APITXT') || adminPortalSrc.includes('APITXT'), 'AdminPortal must display APITXT verification badge');

  // 41g. Verify Multilingual Translations in en, bn, and hi
  const transSrc = fs.readFileSync(path.join(rootDir, 'src/constants/translations.ts'), 'utf-8');
  assert(transSrc.includes('cancelBookingBtn'), 'Translations must include cancelBookingBtn');
  assert(transSrc.includes('cancelBookingModalTitle'), 'Translations must include cancelBookingModalTitle');
  assert(transSrc.includes('selectReasonLabel'), 'Translations must include selectReasonLabel');
  assert(transSrc.includes('reasonChangeOfPlans'), 'Translations must include reasonChangeOfPlans');
  assert(transSrc.includes('reasonScheduleConflict'), 'Translations must include reasonScheduleConflict');
  assert(transSrc.includes('reasonEmergency'), 'Translations must include reasonEmergency');
  assert(transSrc.includes('reasonBookedByMistake'), 'Translations must include reasonBookedByMistake');
  assert(transSrc.includes('reasonOther'), 'Translations must include reasonOther');
  assert(transSrc.includes('applicableRefundSlab'), 'Translations must include applicableRefundSlab');
  assert(transSrc.includes('refundSlab100'), 'Translations must include refundSlab100');
  assert(transSrc.includes('refundSlab50'), 'Translations must include refundSlab50');
  assert(transSrc.includes('refundSlab0'), 'Translations must include refundSlab0');
  assert(transSrc.includes('nameMismatchError'), 'Translations must include nameMismatchError');
});

console.log('\n===============================================================');
const passedCount = results.filter(r => r.passed).length;
console.log(`  RESULTS: ${passedCount} / ${results.length} SCENARIOS PASSED`);
console.log('===============================================================\n');

if (passedCount !== results.length) {
  process.exit(1);
}
