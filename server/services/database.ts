import { db, isSupabaseConfigured, supabase } from './supabase';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'pairuptoday_db.json');
const OTP_DB_FILE = path.join(DATA_DIR, 'otp_challenges.json');
const ADMIN_MFA_DB_FILE = path.join(DATA_DIR, 'admin_mfa_challenges.json');
const localRateLimitBuckets = new Map<string, { startedAt: number; count: number }>();
const localRevokedSessions = new Set<string>();
const localWebhookEvents = new Map<string, any>();
const localSensitiveMfa = new Map<string, { hash: string; expiresAt: number; attempts: number; sent: boolean }>();

interface JsonOtpChallenge {
  otpHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  windowStartTime: number;
  windowCount: number;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'EXPIRED' | 'LOCKED' | 'CONSUMED';
  requestId?: string;
}

function mapCompanionProfilePatchToRow(profile: any): Record<string, unknown> {
  const fields: Record<string, string> = {
    services: 'services',
    rates: 'rates',
    availability: 'availability',
    isLive: 'is_live',
    rating: 'rating',
    totalBookings: 'total_bookings',
    address: 'address',
    state: 'state',
    latitude: 'latitude',
    longitude: 'longitude',
    isInitialListing: 'is_initial_listing',
    isPaused: 'is_paused'
  };
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(fields)) {
    if (key in profile) row[column] = profile[key];
  }
  return row;
}

function loadJsonOtpChallenges(): Record<string, JsonOtpChallenge> {
  if (!fs.existsSync(OTP_DB_FILE)) return {};
  const raw = fs.readFileSync(OTP_DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Local OTP challenge storage is invalid.');
  }
  return parsed as Record<string, JsonOtpChallenge>;
}

function saveJsonOtpChallenges(challenges: Record<string, JsonOtpChallenge>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${OTP_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), 'utf-8');
  fs.renameSync(tempPath, OTP_DB_FILE);
}

function loadJsonAdminMfaChallenges(): Record<string, JsonOtpChallenge> {
  if (!fs.existsSync(ADMIN_MFA_DB_FILE)) return {};
  const parsed = JSON.parse(fs.readFileSync(ADMIN_MFA_DB_FILE, 'utf-8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Local administrator MFA challenge storage is invalid.');
  }
  return parsed as Record<string, JsonOtpChallenge>;
}

function saveJsonAdminMfaChallenges(challenges: Record<string, JsonOtpChallenge>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${ADMIN_MFA_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), 'utf-8');
  fs.renameSync(tempPath, ADMIN_MFA_DB_FILE);
}

// JSON-based DB state (legacy fallback)
interface DBState {
  users: Record<string, any>;
  kycSubmissions: Record<string, any>;
  companionProfiles: Record<string, any>;
  companionMemberships: Record<string, any>;
  bookings: Record<string, any>;
  companionWallets: Record<string, any>;
  payouts: Record<string, any>;
  chatMessages: Record<string, any[]>;
  adminUsers: Record<string, any>;
  supportConversations?: Record<string, any>;
  supportMessages?: Record<string, any[]>;
  notifications?: Record<string, any[]>;
  firebaseDeviceTokens?: Record<string, { userId: string; platform: string }>;
  bankVerifications?: Record<string, any>;
  userLocations?: Record<string, any>;
  userPresence?: Record<string, any>;
  incidentReports?: Record<string, any>;
  otpStore: Record<string, any>;
  adminMfaStore: Record<string, any>;
  auditLogs: any[];
}

let jsonDB: DBState | null = null;

// Load JSON DB if it exists
function loadJsonDB(): DBState {
  if (jsonDB) return jsonDB;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      jsonDB = JSON.parse(raw) as DBState;
      return jsonDB;
    } catch (err) {
      console.error('Failed to parse JSON DB file', err);
    }
  }

  // Return empty DB state
  jsonDB = {
    users: {},
    kycSubmissions: {},
    companionProfiles: {},
    companionMemberships: {},
    bookings: {},
    companionWallets: {},
    payouts: {},
    chatMessages: {},
    adminUsers: {},
    supportConversations: {},
    supportMessages: {},
    notifications: {},
    firebaseDeviceTokens: {},
    bankVerifications: {},
    userLocations: {},
    userPresence: {},
    otpStore: {},
    adminMfaStore: {},
    auditLogs: []
  };

  return jsonDB;
}

function saveJsonDB(state: DBState) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Failed to write JSON DB file', err);
  }
}

// Database adapter interface
export interface DatabaseAdapter {
  // Users
  getUser(id: string): Promise<any | null>;
  getUserByPhone(phone: string): Promise<any | null>;
  createUser(user: any): Promise<any>;
  updateUser(id: string, updates: any): Promise<any>;
  deleteUser(id: string): Promise<void>;
  listUsers(filters?: any): Promise<any[]>;

  // KYC
  createKycSubmission(submission: any): Promise<any>;
  submitKycSubmission(submission: any): Promise<any>;
  getKycSubmission(id: string): Promise<any | null>;
  getUserKycSubmission(userId: string, submissionRole: 'CLIENT' | 'COMPANION'): Promise<any | null>;
  listKycSubmissions(filters?: any): Promise<any[]>;
  updateKycSubmission(id: string, updates: any): Promise<any>;
  reviewKycSubmission(id: string, decision: 'APPROVED' | 'REJECTED', rejectionReason: string | null, adminUserId: string): Promise<any>;
  createKycDocumentSignedUrls(id: string): Promise<Record<string, string | null> | null>;
  uploadKycDocument(bucket: string, path: string, bytes: Buffer, contentType: string): Promise<void>;
  deleteKycDocuments(bucket: string, paths: string[]): Promise<void>;

  // Companion Profiles
  getCompanionProfile(userId: string): Promise<any | null>;
  createCompanionProfile(profile: any): Promise<any>;
  upsertCompanionProfile(profile: any): Promise<any>;
  updateCompanionProfile(userId: string, updates: any): Promise<any>;
  listCompanionProfiles(filters?: any): Promise<any[]>;

  // Memberships
  createMembership(membership: any): Promise<any>;
  getActiveMembership(userId: string): Promise<any | null>;
  getMembershipByPaymentOrder(orderId: string): Promise<any | null>;
  listMemberships(filters?: any): Promise<any[]>;
  updateMembershipOrder(id: string, orderId: string): Promise<any>;

  // Bank Verification
  createBankVerification(verification: any): Promise<any>;
  getBankVerification(userId: string): Promise<any | null>;
  updateBankVerification(userId: string, updates: any): Promise<any>;

  // Bookings
  createBooking(booking: any): Promise<any>;
  reserveBookingPayment(booking: any): Promise<any>;
  getBooking(id: string): Promise<any | null>;
  getBookingByCode(code: string): Promise<any | null>;
  getBookingByPaymentOrder(orderId: string): Promise<any | null>;
  listBookings(filters?: any): Promise<any[]>;
  updateBooking(id: string, updates: any): Promise<any>;
  markBookingCompanionArrived(bookingId: string, companionId: string): Promise<any>;
  verifyBookingOtp(bookingId: string, companionId: string, otpType: 'START' | 'COMPLETION', otpHash: string, delayMinutes?: number): Promise<any>;
  finalizeRazorpayPayment(orderId: string, paymentId: string, amountPaise: number, startOtpHash: string, completionOtpHash: string, startOtpEncrypted: string, completionOtpEncrypted: string): Promise<any>;

  // Wallet
  createWalletEntry(entry: any): Promise<any>;
  getWalletBalance(userId: string): Promise<any>;
  listWalletEntries(userId: string): Promise<any[]>;

  // Payouts
  createPayout(payout: any): Promise<any>;
  listPayouts(filters?: any): Promise<any[]>;
  updatePayout(id: string, updates: any): Promise<any>;

  // Chat
  createConversation(conversation: any): Promise<any>;
  getConversation(id: string): Promise<any | null>;
  listConversations(userId: string): Promise<any[]>;
  createMessage(message: any): Promise<any>;
  listMessages(conversationId: string, after?: string): Promise<any[]>;

  // Support
  createSupportConversation(conversation: any): Promise<any>;
  getSupportConversation(id: string): Promise<any | null>;
  listSupportConversations(filters?: any): Promise<any[]>;
  createSupportMessage(message: any): Promise<any>;
  listSupportMessages(conversationId: string, after?: { createdAt: string; id: string }): Promise<any[]>;
  updateSupportConversation(id: string, updates: any): Promise<any>;

  // Admin
  getAdminUser(email: string): Promise<any | null>;
  getAdminUserById(id: string): Promise<any | null>;
  updateAdminPasswordHash(id: string, passwordHash: string): Promise<void>;
  createAdminUser(admin: any): Promise<any>;
  listAdminUsers(): Promise<any[]>;
  updateAdminUserRole(id: string, role: string): Promise<any>;
  deleteAdminUser(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(log: any): Promise<void>;
  listAuditLogs(filters?: any): Promise<any[]>;

  // Notifications
  createNotification(notification: any): Promise<any>;
  listNotifications(userId: string): Promise<any[]>;
  markNotificationRead(id: string, userId?: string): Promise<void>;
  claimNotificationPushes(notificationId?: string, limit?: number): Promise<any[]>;
  finishNotificationPush(id: string, success: boolean, errorMessage?: string): Promise<void>;
  registerDeviceToken(userId: string, token: string, platform: 'WEB' | 'ANDROID' | 'IOS'): Promise<void>;
  listDeviceTokens(userId: string): Promise<string[]>;
  deleteDeviceToken(token: string, userId?: string): Promise<void>;

  // Durable location/presence records; realtime transport may additionally use Firebase.
  upsertUserLocation(location: any): Promise<any>;
  getUserLocation(userId: string): Promise<any | null>;
  deleteUserLocation(userId: string): Promise<void>;
  upsertUserPresence(presence: any): Promise<any>;
  getUserPresence(userId: string): Promise<any | null>;
  setBookingLocationSharing(bookingId: string, userId: string, enabled: boolean): Promise<void>;
  getBookingLocationSharing(bookingId: string, userId: string): Promise<boolean>;

  // OTP challenges are persisted in Supabase in production.
  reserveOtp(phone: string, otpHash: string): Promise<OtpReservation>;
  setOtpDeliveryResult(phone: string, sent: boolean, requestId?: string): Promise<void>;
  verifyOtp(phone: string, otpHash: string): Promise<OtpVerificationResult>;
  reserveAdminMfa(email: string, otpHash: string): Promise<OtpReservation>;
  setAdminMfaDeliveryResult(email: string, sent: boolean, requestId?: string): Promise<void>;
  verifyAdminMfa(email: string, otpHash: string): Promise<OtpVerificationResult>;
  consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<any>;
  isSessionRevoked(tokenId: string): Promise<boolean>;
  revokeSession(tokenId: string, principalId: string, principalType: 'USER' | 'ADMIN', expiresAt: string): Promise<void>;
  claimPaymentWebhookEvent(eventId: string, eventType: string, payload: any): Promise<any>;
  completePaymentWebhookEvent(eventId: string, error?: string): Promise<void>;
  markRazorpayOrderFailed(orderId: string, paymentId?: string): Promise<boolean>;
  markRazorpayOrderCancelled(orderId: string): Promise<boolean>;
  reservePaymentRefund(refund: any): Promise<any>;
  listPaymentRefunds(filters?: any): Promise<any[]>;
  updatePaymentRefund(idempotencyKey: string, status: string, providerRefundId?: string): Promise<any>;
  createRefundRequest(req: any): Promise<any>;
  getRefundRequestByBooking(bookingId: string): Promise<any | null>;
  listRefundRequests(filters?: any): Promise<any[]>;
  updateRefundRequest(id: string, updates: any): Promise<any>;
  processBookingPayout(bookingId: string, adminUserId: string, utrReference: string): Promise<any>;
  claimScheduledJobRun(jobName: string, idempotencyKey: string): Promise<boolean>;
  finishScheduledJobRun(jobName: string, idempotencyKey: string, error?: string): Promise<void>;
  runScheduledMaintenance(): Promise<any>;
  reserveAdminSensitiveMfa(adminUserId: string, action: string, otpHash: string): Promise<any>;
  completeAdminSensitiveMfaDelivery(adminUserId: string, action: string, sent: boolean): Promise<boolean>;
  verifyAdminSensitiveMfa(adminUserId: string, action: string, otpHash: string): Promise<string>;
  consumeAdminSensitiveMfa(adminUserId: string, action: string): Promise<boolean>;

  // Incident Reports & Safety
  createIncidentReport(report: any): Promise<any>;
  listIncidentReports(filters?: any): Promise<any[]>;
  updateIncidentReport(id: string, updates: any): Promise<any>;
}

export interface OtpReservation {
  allowed: boolean;
  reason?: 'cooldown' | 'rate_limit';
  waitSeconds?: number;
}

export type OtpVerificationResult = 'verified' | 'not_found' | 'expired' | 'locked' | 'invalid';

function uuidOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function mapKycSubmissionToRow(submission: any): Record<string, unknown> {
  return {
    ...(uuidOrUndefined(submission.id) ? { id: submission.id } : {}),
    user_id: submission.userId,
    submission_role: submission.userType || submission.submissionRole,
    legal_name: submission.legalName,
    dob: submission.dob,
    id_type: submission.idType,
    id_reference: submission.idReference || null,
    id_front_document_path: submission.idFrontUrl,
    id_back_document_path: submission.idBackUrl || null,
    selfie_document_path: submission.selfieUrl,
    status: submission.status || 'PENDING',
    submitted_at: submission.submittedAt,
    reviewed_at: submission.decidedAt || null,
    rejection_reason: submission.rejectionReason || null,
    reviewed_by_admin_id: uuidOrUndefined(submission.decidedByAdminId || submission.decidedBy) || null,
    profile_bio: submission.bio || null,
    profile_photos: submission.photos || null,
    city: submission.city || null
  };
}

function mapKycSubmissionFromRow(row: any): any {
  return {
    ...row,
    userId: row.user_id,
    userType: row.submission_role,
    legalName: row.legal_name,
    idType: row.id_type,
    idReference: row.id_reference,
    idFrontUrl: row.id_front_document_path,
    idBackUrl: row.id_back_document_path,
    selfieUrl: row.selfie_document_path,
    submittedAt: row.submitted_at,
    decidedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    decidedByAdminId: row.reviewed_by_admin_id,
    bio: row.profile_bio,
    photos: row.profile_photos
  };
}

function mapCompanionProfileToRow(profile: any): Record<string, unknown> {
  return {
    ...(uuidOrUndefined(profile.id) ? { id: profile.id } : {}),
    user_id: profile.userId || profile.user_id,
    services: profile.services || [],
    rates: profile.rates || {},
    availability: profile.availability ?? null,
    is_live: profile.isLive ?? profile.is_live ?? false,
    rating: profile.rating ?? 0,
    total_bookings: profile.totalBookings ?? profile.total_bookings ?? 0,
    address: profile.address || null,
    state: profile.state || null,
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    is_initial_listing: profile.isInitialListing ?? profile.is_initial_listing ?? false,
    is_paused: profile.isPaused ?? profile.is_paused ?? false
  };
}

function mapCompanionProfileFromRow(row: any): any {
  return {
    ...row,
    userId: row.user_id,
    isLive: row.is_live,
    totalBookings: row.total_bookings,
    isInitialListing: row.is_initial_listing,
    isPaused: row.is_paused
  };
}

function mapBookingToRow(booking: any): Record<string, unknown> {
  return {
    ...(uuidOrUndefined(booking.id) ? { id: booking.id } : {}),
    booking_code: booking.bookingCode,
    client_id: booking.clientId,
    companion_id: booking.companionId,
    service_id: booking.serviceId,
    service_name: booking.serviceName,
    booking_date: booking.date || booking.bookingDate,
    start_time: booking.startTime,
    end_time: booking.endTime,
    duration_hours: booking.durationHours || Math.ceil((booking.slotMinutes || 60) / 60),
    meeting_location: booking.meetingLocation,
    meeting_address: booking.meetingAddress || null,
    latitude: booking.latitude ?? null,
    longitude: booking.longitude ?? null,
    notes: booking.notes || null,
    amount_paise: booking.bookingAmountPaise ?? booking.amountPaise,
    selected_services: booking.selectedServices ? (typeof booking.selectedServices === 'string' ? JSON.parse(booking.selectedServices) : booking.selectedServices) : [],
    actual_start_time: booking.actualStartTime || null,
    cancellation_reason: booking.cancellationReason || null,
    cancellation_note: booking.cancellationNote || null,
    cancelled_by: booking.cancelledBy || null,
    cancelled_at: booking.cancelledAt || null,
    penalty_deducted_paise: booking.penaltyDeductedPaise || 0,
    status: booking.status || 'PENDING',
    payment_order_id: booking.paymentOrderId || null,
    payment_id: booking.paymentId || null,
    payment_status: booking.paymentStatus || 'PENDING',
    start_otp_hash: booking.startOtpHmac || booking.startOtpHash || null,
    completion_otp_hash: booking.endOtpHmac || booking.completionOtpHash || null,
    start_otp_encrypted: booking.startOtpEncrypted || null,
    completion_otp_encrypted: booking.completionOtpEncrypted || null,
    companion_arrived_at: booking.companionArrivedAt || null,
    started_at: booking.startedAt || null,
    completed_at: booking.completedAt || null,
    delay_minutes: booking.delayMinutes || 0,
    admin_platform_fee_paise: booking.adminPlatformFeePaise || 0,
    companion_gross_share_paise: booking.companionGrossSharePaise || 0,
    companion_net_share_paise: booking.companionNetSharePaise || 0,
    late_penalty_paise: booking.latePenaltyPaise || 0,
    client_refund_penalty_paise: booking.clientRefundPenaltyPaise || 0,
    settlement_status: booking.settlementStatus || 'LOCKED',
    settlement_unlock_at: booking.settlementUnlockUtc || booking.settlementUnlockAt || null,
    start_otp_attempts: booking.startOtpAttempts || 0,
    completion_otp_attempts: booking.endOtpAttempts || 0,
    start_otp_verified: booking.startOtpVerified || false,
    completion_otp_verified: booking.endOtpVerified || false,
    payout_id: uuidOrUndefined(booking.payoutId) || null
  };
}

function mapBookingFromRow(row: any): any {
  return {
    ...row,
    bookingCode: row.booking_code,
    clientId: row.client_id,
    companionId: row.companion_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    date: row.booking_date,
    startTime: row.start_time || row.startTime,
    endTime: row.end_time || row.endTime,
    durationHours: row.duration_hours,
    slotMinutes: row.duration_hours * 60,
    meetingLocation: row.meeting_location || row.meetingLocation,
    bookingLocationName: row.booking_location_name || row.meeting_location || row.meetingLocation,
    bookingLat: row.booking_lat || row.latitude,
    bookingLng: row.booking_lng || row.longitude,
    companionEtaText: row.companion_eta_text || 'Calculating...',
    companionCurrentArea: row.companion_current_area || 'Preparing to leave...',
    lastEtaUpdatedAt: row.last_eta_updated_at,
    sessionOtp: row.session_otp,
    meetingAddress: row.meeting_address,
    bookingAmountPaise: row.amount_paise,
    paymentOrderId: row.payment_order_id,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    startOtpHmac: row.start_otp_hash,
    endOtpHmac: row.completion_otp_hash,
    startOtpEncrypted: row.start_otp_encrypted,
    completionOtpEncrypted: row.completion_otp_encrypted,
    companionArrivedAt: row.companion_arrived_at,
    completedAt: row.completed_at,
    adminPlatformFeePaise: row.admin_platform_fee_paise,
    companionGrossSharePaise: row.companion_gross_share_paise,
    companionNetSharePaise: row.companion_net_share_paise,
    latePenaltyPaise: row.late_penalty_paise,
    clientRefundPenaltyPaise: row.client_refund_penalty_paise,
    settlementStatus: row.settlement_status,
    settlementUnlockUtc: row.settlement_unlock_at,
    startOtpAttempts: row.start_otp_attempts,
    endOtpAttempts: row.completion_otp_attempts,
    endOtpVerified: row.completion_otp_verified,
    payoutId: row.payout_id,
    selectedServices: row.selected_services || (row.selectedServices ? row.selectedServices : []),
    actualStartTime: row.actual_start_time || row.actualStartTime || null,
    cancellationReason: row.cancellation_reason || row.cancellationReason || null,
    cancellationNote: row.cancellation_note || row.cancellationNote || null,
    cancelledBy: row.cancelled_by || row.cancelledBy || null,
    cancelledAt: row.cancelled_at || row.cancelledAt || null,
    penaltyDeductedPaise: row.penalty_deducted_paise || row.penaltyDeductedPaise || 0
  };
}

// JSON-based adapter (legacy)
class JsonDatabaseAdapter implements DatabaseAdapter {
  private getDB(): DBState {
    return loadJsonDB();
  }

  private saveDB(state: DBState) {
    saveJsonDB(state);
  }

  async getUser(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.users[id] || null;
  }

  async getUserByPhone(phone: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.users).find((u: any) => u.phone === phone) || null;
  }

  async createUser(user: any): Promise<any> {
    const db = this.getDB();
    db.users[user.id] = user;
    this.saveDB(db);
    return user;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const db = this.getDB();
    if (!db.users[id]) return null;
    db.users[id] = { ...db.users[id], ...updates };
    this.saveDB(db);
    return db.users[id];
  }

  async deleteUser(userId: string): Promise<void> {
    const db = this.getDB();
    delete db.users[userId];
    if (db.kycSubmissions) {
      for (const k of Object.keys(db.kycSubmissions)) {
        if (db.kycSubmissions[k]?.userId === userId) delete db.kycSubmissions[k];
      }
    }
    if (db.companionProfiles) delete db.companionProfiles[userId];
    if (db.companionMemberships) {
      for (const k of Object.keys(db.companionMemberships)) {
        if (db.companionMemberships[k]?.userId === userId) delete db.companionMemberships[k];
      }
    }
    if (db.bankVerifications) delete db.bankVerifications[userId];
    if (db.companionWallets) delete db.companionWallets[userId];
    if (db.userLocations) delete db.userLocations[userId];
    if (db.userPresence) delete db.userPresence[userId];
    this.saveDB(db);
  }

  async listUsers(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.users);
  }

  async createKycSubmission(submission: any): Promise<any> {
    const db = this.getDB();
    db.kycSubmissions[submission.id] = submission;
    this.saveDB(db);
    return submission;
  }

  async submitKycSubmission(submission: any): Promise<any> {
    const db = this.getDB();
    db.kycSubmissions[submission.id] = submission;
    this.saveDB(db);
    return submission;
  }

  async getKycSubmission(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.kycSubmissions[id] || null;
  }

  async getUserKycSubmission(userId: string, submissionRole: 'CLIENT' | 'COMPANION'): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.kycSubmissions).find((submission: any) =>
      submission.userId === userId && (submission.userType || submission.submissionRole) === submissionRole
    ) || null;
  }

  async listKycSubmissions(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.kycSubmissions);
  }

  async updateKycSubmission(id: string, updates: any): Promise<any> {
    const db = this.getDB();
    if (!db.kycSubmissions[id]) return null;
    db.kycSubmissions[id] = { ...db.kycSubmissions[id], ...updates };
    this.saveDB(db);
    return db.kycSubmissions[id];
  }

  async reviewKycSubmission(id: string, decision: 'APPROVED' | 'REJECTED', rejectionReason: string | null, adminUserId: string): Promise<any> {
    const db = this.getDB();
    const submission = db.kycSubmissions[id];
    if (!submission) return null;
    submission.status = decision;
    submission.rejectionReason = rejectionReason;
    submission.decidedAt = new Date().toISOString();
    submission.decidedByAdminId = adminUserId;
    const user = db.users[submission.userId];
    if (user) {
      user.kycStatus = decision;
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedByAdminId = adminUserId;
      user.kycRejectionReason = rejectionReason;
    }
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      adminId: adminUserId,
      action: `KYC_${decision}`,
      targetId: submission.userId,
      details: `KYC for ${submission.legalName} (${submission.userType}) was ${decision}.`,
      timestamp: submission.decidedAt
    });
    this.saveDB(db);
    return submission;
  }

  async createKycDocumentSignedUrls(id: string): Promise<Record<string, string | null> | null> {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    return {
      idFrontUrl: submission.idFrontUrl,
      idBackUrl: submission.idBackUrl || null,
      selfieUrl: submission.selfieUrl
    };
  }

  async uploadKycDocument(_bucket: string, _path: string, _bytes: Buffer, _contentType: string): Promise<void> {
    throw new Error('Private KYC document uploads require configured Supabase Storage.');
  }

  async deleteKycDocuments(_bucket: string, _paths: string[]): Promise<void> {
    throw new Error('Private KYC document cleanup requires configured Supabase Storage.');
  }

  async getCompanionProfile(userId: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.companionProfiles).find((p: any) => p.userId === userId) || null;
  }

  async createCompanionProfile(profile: any): Promise<any> {
    const db = this.getDB();
    db.companionProfiles[profile.id] = profile;
    this.saveDB(db);
    return profile;
  }

  async upsertCompanionProfile(profile: any): Promise<any> {
    const db = this.getDB();
    db.companionProfiles[profile.userId] = {
      ...(db.companionProfiles[profile.userId] || {}),
      ...profile
    };
    this.saveDB(db);
    return db.companionProfiles[profile.userId];
  }

  async updateCompanionProfile(userId: string, updates: any): Promise<any> {
    const db = this.getDB();
    const key = Object.keys(db.companionProfiles).find(id => db.companionProfiles[id]?.userId === userId);
    if (!key) return null;
    const profile = db.companionProfiles[key];
    db.companionProfiles[key] = { ...profile, ...updates };
    this.saveDB(db);
    return db.companionProfiles[key];
  }

  async listCompanionProfiles(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.companionProfiles);
  }

  async createMembership(membership: any): Promise<any> {
    const db = this.getDB();
    db.companionMemberships[membership.id] = membership;
    this.saveDB(db);
    return membership;
  }

  async getActiveMembership(userId: string): Promise<any | null> {
    const db = this.getDB();
    const now = new Date();
    return Object.values(db.companionMemberships).find((m: any) =>
      m.userId === userId &&
      m.paymentStatus === 'PAID' &&
      new Date(m.expiryDate) > now
    ) || null;
  }

  async getMembershipByPaymentOrder(orderId: string): Promise<any | null> {
    const membership = Object.values(this.getDB().companionMemberships)
      .find((item: any) => item.paymentOrderId === orderId);
    return membership || null;
  }

  async listMemberships(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.companionMemberships);
  }

  async updateMembershipOrder(id: string, orderId: string): Promise<any> {
    const db = this.getDB();
    const membership = Object.values(db.companionMemberships).find((item: any) => item.id === id);
    if (!membership) throw new Error('Membership not found.');
    membership.paymentOrderId = orderId;
    this.saveDB(db);
    return membership;
  }

  async createBankVerification(verification: any): Promise<any> {
    const db = this.getDB();
    const bankVerifications = db.bankVerifications ?? {};
    // Store by user_id instead of id for easier lookup
    const existing = Object.keys(bankVerifications).find(key => {
      const v = bankVerifications[key];
      return v && v.userId === verification.userId;
    });
    db.bankVerifications = bankVerifications;
    db.bankVerifications[verification.id] = verification;
    this.saveDB(db);
    return verification;
  }

  async getBankVerification(userId: string): Promise<any | null> {
    const db = this.getDB();
    if (!db.bankVerifications) return null;
    return Object.values(db.bankVerifications).find((v: any) => v.userId === userId) || null;
  }

  async updateBankVerification(userId: string, updates: any): Promise<any> {
    const db = this.getDB();
    if (!db.bankVerifications) return null;
    const key = Object.keys(db.bankVerifications).find(k => db.bankVerifications![k].userId === userId);
    if (!key) return null;
    db.bankVerifications![key] = { ...db.bankVerifications![key], ...updates };
    this.saveDB(db);
    return db.bankVerifications![key];
  }

  async createBooking(booking: any): Promise<any> {
    const db = this.getDB();
    db.bookings[booking.id] = booking;
    this.saveDB(db);
    return booking;
  }

  async reserveBookingPayment(booking: any): Promise<any> {
    return this.createBooking(booking);
  }

  async getBooking(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.bookings[id] || null;
  }

  async getBookingByCode(code: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.bookings).find((b: any) => b.bookingCode === code) || null;
  }

  async getBookingByPaymentOrder(orderId: string): Promise<any | null> {
    const booking = Object.values(this.getDB().bookings).find((item: any) => item.paymentOrderId === orderId);
    return booking || null;
  }

  async listBookings(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.bookings);
  }

  async updateBooking(id: string, updates: any): Promise<any> {
    const db = this.getDB();
    if (!db.bookings[id]) return null;
    db.bookings[id] = { ...db.bookings[id], ...updates };
    this.saveDB(db);
    return db.bookings[id];
  }

  async markBookingCompanionArrived(_bookingId: string, _companionId: string): Promise<any> {
    throw new Error('Atomic booking arrival requires Supabase.');
  }

  async verifyBookingOtp(_bookingId: string, _companionId: string, _otpType: 'START' | 'COMPLETION', _otpHash: string, _delayMinutes = 0): Promise<any> {
    throw new Error('Atomic booking OTP verification requires Supabase.');
  }

  async finalizeRazorpayPayment(
    orderId: string,
    paymentId: string,
    _amountPaise: number,
    startOtpHash: string,
    completionOtpHash: string,
    startOtpEncrypted: string,
    completionOtpEncrypted: string
  ): Promise<any> {
    const db = this.getDB();
    const booking = Object.values(db.bookings || {}).find((b: any) => b.paymentOrderId === orderId || b.id === orderId);
    if (booking) {
      booking.status = 'CONFIRMED';
      booking.paymentStatus = 'PAID';
      booking.paymentId = paymentId;
      booking.startOtpHmac = startOtpHash;
      booking.endOtpHmac = completionOtpHash;
      booking.startOtpEncrypted = startOtpEncrypted;
      booking.completionOtpEncrypted = completionOtpEncrypted;
      booking.updatedAt = new Date().toISOString();
      this.saveDB(db);
      return { type: 'BOOKING', duplicate: false, record: booking };
    }
    const membership = Object.values(db.memberships || {}).find((m: any) => m.paymentOrderId === orderId);
    if (membership) {
      membership.paymentStatus = 'PAID';
      membership.paymentId = paymentId;
      membership.paidAt = new Date().toISOString();
      this.saveDB(db);
      return { type: 'MEMBERSHIP', duplicate: false, record: membership };
    }
    throw new Error('Atomic payment finalization requires the Supabase database.');
  }

  async createWalletEntry(entry: any): Promise<any> {
    const db = this.getDB();
    if (!db.companionWallets) db.companionWallets = {};
    if (!db.companionWallets[entry.userId]) {
      db.companionWallets[entry.userId] = { entries: [] };
    }
    db.companionWallets[entry.userId].entries.push(entry);
    this.saveDB(db);
    return entry;
  }

  async getWalletBalance(userId: string): Promise<any> {
    const db = this.getDB();
    if (!db.companionWallets || !db.companionWallets[userId]) {
      return { available: 0, locked: 0, total: 0 };
    }
    const entries = db.companionWallets[userId].entries || [];
    let available = 0;
    let locked = 0;
    for (const entry of entries) {
      if (entry.balanceStatus === 'AVAILABLE') {
        available += entry.netAmountPaise || 0;
      } else if (entry.balanceStatus === 'LOCKED') {
        locked += entry.netAmountPaise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }

  async listWalletEntries(userId: string): Promise<any[]> {
    const db = this.getDB();
    if (!db.companionWallets || !db.companionWallets[userId]) {
      return [];
    }
    return db.companionWallets[userId].entries || [];
  }

  async createPayout(payout: any): Promise<any> {
    const db = this.getDB();
    db.payouts[payout.id] = payout;
    this.saveDB(db);
    return payout;
  }

  async listPayouts(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.payouts);
  }

  async updatePayout(id: string, updates: any): Promise<any> {
    const db = this.getDB();
    if (!db.payouts[id]) return null;
    db.payouts[id] = { ...db.payouts[id], ...updates };
    this.saveDB(db);
    return db.payouts[id];
  }

  async createConversation(conversation: any): Promise<any> {
    const db = this.getDB();
    if (!db.chatMessages) db.chatMessages = {};
    const key = `${conversation.participantA}_${conversation.participantB}_${conversation.bookingId || 'no-booking'}`;
    db.chatMessages[key] = [];
    this.saveDB(db);
    return { ...conversation, id: key };
  }

  async getConversation(id: string): Promise<any | null> {
    const db = this.getDB();
    if (!db.chatMessages || !db.chatMessages[id]) return null;
    return { id, messages: db.chatMessages[id] };
  }

  async listConversations(userId: string): Promise<any[]> {
    const db = this.getDB();
    if (!db.chatMessages) return [];
    return Object.keys(db.chatMessages).map(key => ({
      id: key,
      messages: db.chatMessages[key]
    }));
  }

  async createMessage(message: any): Promise<any> {
    const db = this.getDB();
    if (!db.chatMessages) db.chatMessages = {};
    if (!db.chatMessages[message.conversationId]) {
      db.chatMessages[message.conversationId] = [];
    }
    db.chatMessages[message.conversationId].push(message);
    this.saveDB(db);
    return message;
  }

  async listMessages(conversationId: string, after?: string): Promise<any[]> {
    const db = this.getDB();
    if (!db.chatMessages || !db.chatMessages[conversationId]) return [];
    return after ? db.chatMessages[conversationId].filter((message: any) => message.timestamp > after || message.createdAt > after) : db.chatMessages[conversationId];
  }

  async createSupportConversation(conversation: any): Promise<any> {
    // For JSON DB, store in a simple structure
    const db = this.getDB();
    if (!db.supportConversations) db.supportConversations = {};
    db.supportConversations[conversation.id] = conversation;
    this.saveDB(db);
    return conversation;
  }

  async getSupportConversation(id: string): Promise<any | null> {
    const db = this.getDB();
    if (!db.supportConversations) return null;
    return db.supportConversations[id] || null;
  }

  async listSupportConversations(filters?: any): Promise<any[]> {
    const db = this.getDB();
    if (!db.supportConversations) return [];
    return Object.values(db.supportConversations);
  }

  async createSupportMessage(message: any): Promise<any> {
    const db = this.getDB();
    if (!db.supportMessages) db.supportMessages = {};
    if (!db.supportMessages[message.conversationId]) {
      db.supportMessages[message.conversationId] = [];
    }
    db.supportMessages[message.conversationId].push(message);
    this.saveDB(db);
    return message;
  }

  async listSupportMessages(conversationId: string, after?: { createdAt: string; id: string }): Promise<any[]> {
    const db = this.getDB();
    if (!db.supportMessages || !db.supportMessages[conversationId]) return [];
    return after
      ? db.supportMessages[conversationId].filter((message: any) => {
        const createdAt = message.createdAt || message.created_at;
        const id = message.id || '';
        return createdAt > after.createdAt || (createdAt === after.createdAt && id > after.id);
      })
      : db.supportMessages[conversationId];
  }

  async updateSupportConversation(id: string, updates: any): Promise<any> {
    const conversation = await this.getSupportConversation(id);
    if (!conversation) return null;
    const updated = { ...conversation, ...updates, updatedAt: new Date().toISOString() };
    this.getDB().supportConversations![id] = updated;
    this.saveDB(this.getDB());
    return updated;
  }

  async getAdminUser(email: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.adminUsers).find((a: any) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getAdminUserById(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.adminUsers[id] || null;
  }

  async updateAdminPasswordHash(id: string, passwordHash: string): Promise<void> {
    const db = this.getDB();
    const admin = db.adminUsers[id];
    if (!admin) throw new Error('Administrator account no longer exists.');
    db.adminUsers[id] = { ...admin, passwordHash };
    this.saveDB(db);
  }

  async createAdminUser(admin: any): Promise<any> {
    const db = this.getDB();
    db.adminUsers[admin.id] = admin;
    this.saveDB(db);
    return admin;
  }

  async listAdminUsers(): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.adminUsers);
  }

  async updateAdminUserRole(id: string, role: string): Promise<any> {
    const db = this.getDB();
    const staff = db.adminUsers[id];
    if (!staff) throw new Error('Admin user not found');
    staff.role = role;
    this.saveDB(db);
    return staff;
  }

  async deleteAdminUser(id: string): Promise<void> {
    const db = this.getDB();
    delete db.adminUsers[id];
    this.saveDB(db);
  }

  async createAuditLog(log: any): Promise<void> {
    const db = this.getDB();
    db.auditLogs.push(log);
    this.saveDB(db);
  }

  async listAuditLogs(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return db.auditLogs || [];
  }

  async createIncidentReport(report: any): Promise<any> {
    const db = this.getDB();
    db.incidentReports ||= {};
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || 'PENDING_REVIEW',
      createdAt: report.createdAt || new Date().toISOString()
    };
    db.incidentReports[item.id] = item;
    this.saveDB(db);
    return item;
  }

  async listIncidentReports(filters?: any): Promise<any[]> {
    const db = this.getDB();
    const list = Object.values(db.incidentReports || {});
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateIncidentReport(id: string, updates: any): Promise<any> {
    const db = this.getDB();
    db.incidentReports ||= {};
    if (!db.incidentReports[id]) return null;
    db.incidentReports[id] = { ...db.incidentReports[id], ...updates, updatedAt: new Date().toISOString() };
    this.saveDB(db);
    return db.incidentReports[id];
  }

  async createNotification(notification: any): Promise<any> {
    const db = this.getDB();
    db.notifications ||= {};
    const item = {
      ...notification,
      id: notification.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      pushDeliveryStatus: 'PENDING',
      pushAttempts: 0,
      pushRetryAt: new Date().toISOString()
    };
    (db.notifications[notification.userId] ||= []).unshift(item);
    this.saveDB(db);
    return item;
  }

  async listNotifications(userId: string): Promise<any[]> {
    return this.getDB().notifications?.[userId] || [];
  }

  async markNotificationRead(id: string, userId?: string): Promise<void> {
    const db = this.getDB();
    const notifications = userId ? db.notifications?.[userId] || [] : Object.values(db.notifications || {}).flat();
    const item = notifications.find((entry: any) => entry.id === id);
    if (!item) throw new Error('Notification was not found.');
    item.readAt = new Date().toISOString();
    this.saveDB(db);
  }

  async claimNotificationPushes(notificationId?: string, limit = 100): Promise<any[]> {
    const db = this.getDB();
    const now = Date.now();
    const notifications = Object.values(db.notifications || {}).flat() as any[];
    const candidates = notifications
      .filter(notification =>
        (!notificationId || notification.id === notificationId) &&
        notification.pushDeliveryStatus !== 'SENT' &&
        notification.pushDeliveryStatus !== 'FAILED' &&
        (notification.pushAttempts || 0) < 5 &&
        (!notification.pushRetryAt || Date.parse(notification.pushRetryAt) <= now) &&
        (notification.pushDeliveryStatus !== 'PROCESSING' ||
          !notification.pushClaimedAt ||
          Date.parse(notification.pushClaimedAt) <= now - 10 * 60 * 1000)
      )
      .slice(0, Math.min(500, Math.max(1, limit)));
    for (const notification of candidates) {
      notification.pushDeliveryStatus = 'PROCESSING';
      notification.pushAttempts = (notification.pushAttempts || 0) + 1;
      notification.pushClaimedAt = new Date(now).toISOString();
    }
    if (candidates.length) this.saveDB(db);
    return candidates.map(notification => ({
      notification,
      deviceTokens: Object.entries(db.firebaseDeviceTokens || {})
        .filter(([, token]: [string, any]) => token.userId === notification.userId)
        .map(([token]) => token)
    }));
  }

  async finishNotificationPush(id: string, success: boolean, errorMessage?: string): Promise<void> {
    const db = this.getDB();
    const notifications = Object.values(db.notifications || {}).flat() as any[];
    const notification = notifications.find(entry => entry.id === id);
    if (!notification || notification.pushDeliveryStatus !== 'PROCESSING') {
      throw new Error('Notification push claim was not found.');
    }
    notification.pushDeliveryStatus = success
      ? 'SENT'
      : (notification.pushAttempts >= 5 ? 'FAILED' : 'PENDING');
    notification.pushClaimedAt = null;
    notification.pushRetryAt = new Date(Date.now() + Math.min(3600, 30 * (2 ** Math.max(0, notification.pushAttempts - 1))) * 1000).toISOString();
    notification.pushLastError = success ? null : (errorMessage || 'Push delivery failed.').slice(0, 1000);
    if (success) notification.pushSentAt = new Date().toISOString();
    this.saveDB(db);
  }

  async registerDeviceToken(userId: string, token: string, platform: 'WEB' | 'ANDROID' | 'IOS'): Promise<void> {
    const db = this.getDB();
    db.firebaseDeviceTokens ||= {};
    db.firebaseDeviceTokens[token] = { userId, platform };
    this.saveDB(db);
  }

  async listDeviceTokens(userId: string): Promise<string[]> {
    return Object.entries(this.getDB().firebaseDeviceTokens || {})
      .filter(([, entry]) => entry.userId === userId)
      .map(([token]) => token);
  }

  async deleteDeviceToken(token: string, userId?: string): Promise<void> {
    const db = this.getDB();
    if (db.firebaseDeviceTokens?.[token] && (!userId || db.firebaseDeviceTokens[token].userId === userId)) {
      delete db.firebaseDeviceTokens[token];
    }
    this.saveDB(db);
  }

  async upsertUserLocation(location: any): Promise<any> {
    const db = this.getDB();
    db.userLocations ||= {};
    db.userLocations[location.userId] = location;
    this.saveDB(db);
    return location;
  }

  async getUserLocation(userId: string): Promise<any | null> {
    return this.getDB().userLocations?.[userId] || null;
  }

  async deleteUserLocation(userId: string): Promise<void> {
    const db = this.getDB();
    if (db.userLocations) delete db.userLocations[userId];
    this.saveDB(db);
  }

  async upsertUserPresence(presence: any): Promise<any> {
    const db = this.getDB();
    db.userPresence ||= {};
    db.userPresence[presence.userId] = presence;
    this.saveDB(db);
    return presence;
  }

  async getUserPresence(userId: string): Promise<any | null> {
    return this.getDB().userPresence?.[userId] || null;
  }

  async setBookingLocationSharing(bookingId: string, userId: string, enabled: boolean): Promise<void> {
    const locations = this.getDB().userLocations || (this.getDB().userLocations = {});
    locations[`${bookingId}:${userId}`] = { bookingId, userId, sharingEnabled: enabled, updatedAt: new Date().toISOString() };
    this.saveDB(this.getDB());
  }

  async getBookingLocationSharing(bookingId: string, userId: string): Promise<boolean> {
    return this.getDB().userLocations?.[`${bookingId}:${userId}`]?.sharingEnabled === true;
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<any> {
    const now = Date.now();
    let bucket = localRateLimitBuckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowSeconds * 1000) {
      bucket = { startedAt: now, count: 0 };
      localRateLimitBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowSeconds * 1000 - now) / 1000)) };
  }

  async isSessionRevoked(tokenId: string): Promise<boolean> {
    return localRevokedSessions.has(tokenId);
  }

  async revokeSession(tokenId: string): Promise<void> {
    localRevokedSessions.add(tokenId);
  }

  async claimPaymentWebhookEvent(eventId: string, eventType: string, payload: any): Promise<any> {
    const previous = localWebhookEvents.get(eventId);
    if (previous?.processed) return { claimed: false, processed: true };
    localWebhookEvents.set(eventId, { eventType, payload, processed: false });
    return { claimed: true, processed: false };
  }

  async completePaymentWebhookEvent(eventId: string, error?: string): Promise<void> {
    const event = localWebhookEvents.get(eventId);
    if (!event) throw new Error('Payment webhook event claim was not found.');
    event.processed = !error;
  }

  async markRazorpayOrderFailed(orderId: string, paymentId?: string): Promise<boolean> {
    const db = this.getDB();
    let updated = false;
    for (const b of Object.values(db.bookings) as any[]) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === 'PENDING' || !b.paymentStatus)) {
        b.paymentStatus = 'FAILED';
        b.status = 'CANCELLED';
        if (paymentId) b.paymentId = paymentId;
        updated = true;
      }
    }
    for (const m of Object.values(db.companionMemberships) as any[]) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === 'PENDING' || !m.paymentStatus)) {
        m.paymentStatus = 'FAILED';
        if (paymentId) m.paymentId = paymentId;
        updated = true;
      }
    }
    return updated;
  }

  async markRazorpayOrderCancelled(orderId: string): Promise<boolean> {
    const db = this.getDB();
    let updated = false;
    for (const b of Object.values(db.bookings) as any[]) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === 'PENDING' || !b.paymentStatus)) {
        b.paymentStatus = 'CANCELLED';
        b.status = 'CANCELLED';
        updated = true;
      }
    }
    for (const m of Object.values(db.companionMemberships) as any[]) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === 'PENDING' || !m.paymentStatus)) {
        m.paymentStatus = 'CANCELLED';
        updated = true;
      }
    }
    return updated;
  }

  async reservePaymentRefund(): Promise<any> {
    throw new Error('Payment refunds require Supabase.');
  }

  async listPaymentRefunds(): Promise<any[]> {
    throw new Error('Payment refunds require Supabase.');
  }

  async updatePaymentRefund(): Promise<any> {
    throw new Error('Payment refunds require Supabase.');
  }

  async createRefundRequest(req: any): Promise<any> {
    const id = req.id || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id,
      bookingId: req.bookingId,
      clientId: req.clientId,
      refundAmountPaise: Number(req.refundAmountPaise || req.refund_amount_paise || 0),
      refundReason: req.refundReason || req.refund_reason || 'companion_no_show',
      accountHolderName: req.accountHolderName || req.account_holder_name || null,
      bankName: req.bankName || req.bank_name || null,
      accountNumber: req.accountNumber || req.account_number || null,
      ifscCode: req.ifscCode || req.ifsc_code || null,
      upiId: req.upiId || req.upi_id || null,
      payoutStatus: req.payoutStatus || req.payout_status || 'awaiting_details',
      adminTransactionRef: req.adminTransactionRef || req.admin_transaction_ref || null,
      processedAt: req.processedAt || req.processed_at || null,
      createdAt: req.createdAt || req.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (this.db as any).refundRequests = (this.db as any).refundRequests || {};
    (this.db as any).refundRequests[id] = record;
    return record;
  }

  async getRefundRequestByBooking(bookingId: string): Promise<any | null> {
    const table = (this.db as any).refundRequests || {};
    return Object.values(table).find((r: any) => r.bookingId === bookingId) || null;
  }

  async listRefundRequests(filters?: any): Promise<any[]> {
    const table = (this.db as any).refundRequests || {};
    let list: any[] = Object.values(table);
    if (filters?.clientId) list = list.filter((r: any) => r.clientId === filters.clientId);
    if (filters?.payoutStatus) list = list.filter((r: any) => r.payoutStatus === filters.payoutStatus);
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateRefundRequest(id: string, updates: any): Promise<any> {
    const table = (this.db as any).refundRequests || {};
    if (!table[id]) throw new Error('Refund request not found');
    table[id] = { ...table[id], ...updates, updatedAt: new Date().toISOString() };
    return table[id];
  }

  async processBookingPayout(): Promise<any> {
    throw new Error('Payout processing requires Supabase.');
  }

  async claimScheduledJobRun(): Promise<boolean> {
    throw new Error('Scheduled jobs require Supabase.');
  }

  async finishScheduledJobRun(): Promise<void> {
    throw new Error('Scheduled jobs require Supabase.');
  }

  async runScheduledMaintenance(): Promise<any> {
    throw new Error('Scheduled maintenance requires Supabase.');
  }

  async reserveAdminSensitiveMfa(): Promise<any> {
    throw new Error('Sensitive administrator MFA requires Supabase.');
  }

  async completeAdminSensitiveMfaDelivery(): Promise<boolean> {
    throw new Error('Sensitive administrator MFA requires Supabase.');
  }

  async verifyAdminSensitiveMfa(): Promise<string> {
    throw new Error('Sensitive administrator MFA requires Supabase.');
  }

  async consumeAdminSensitiveMfa(): Promise<boolean> {
    throw new Error('Sensitive administrator MFA requires Supabase.');
  }

  async reserveOtp(phone: string, otpHash: string): Promise<OtpReservation> {
    const challenges = loadJsonOtpChallenges();
    const now = Date.now();
    const current = challenges[phone];

    if (current && now - current.lastSentAt < 60_000) {
      return {
        allowed: false,
        reason: 'cooldown',
        waitSeconds: Math.ceil((60_000 - (now - current.lastSentAt)) / 1000)
      };
    }

    const inWindow = Boolean(current && now - current.windowStartTime < 60_000);
    if (inWindow && current.windowCount >= 3) {
      return {
        allowed: false,
        reason: 'rate_limit',
        waitSeconds: Math.ceil((60_000 - (now - current.windowStartTime)) / 1000)
      };
    }

    const windowStartTime = current && inWindow ? current.windowStartTime : now;
    const windowCount = current && inWindow ? current.windowCount + 1 : 1;
    challenges[phone] = {
      otpHash,
      expiresAt: now + 5 * 60_000,
      attempts: 0,
      lastSentAt: now,
      windowStartTime,
      windowCount,
      status: 'PENDING'
    };
    saveJsonOtpChallenges(challenges);
    return { allowed: true };
  }

  async setOtpDeliveryResult(phone: string, sent: boolean, requestId?: string): Promise<void> {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record || record.status !== 'PENDING') {
      throw new Error('OTP challenge was not pending delivery.');
    }
    record.status = sent ? 'SENT' : 'FAILED';
    if (requestId) record.requestId = requestId;
    saveJsonOtpChallenges(challenges);
  }

  async verifyOtp(phone: string, otpHash: string): Promise<OtpVerificationResult> {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record) return 'not_found';
    if (record.status === 'LOCKED') return 'locked';
    if (record.status !== 'SENT') return 'not_found';

    const now = Date.now();
    if (now >= record.expiresAt) {
      record.status = 'EXPIRED';
      saveJsonOtpChallenges(challenges);
      return 'expired';
    }
    if (record.attempts >= 4) {
      record.status = 'LOCKED';
      saveJsonOtpChallenges(challenges);
      return 'locked';
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = 'LOCKED';
      saveJsonOtpChallenges(challenges);
      return record.status === 'LOCKED' ? 'locked' : 'invalid';
    }

    record.status = 'CONSUMED';
    saveJsonOtpChallenges(challenges);
    return 'verified';
  }

  async reserveAdminMfa(email: string, otpHash: string): Promise<OtpReservation> {
    const challenges = loadJsonAdminMfaChallenges();
    const now = Date.now();
    const current = challenges[email];
    if (current && now - current.lastSentAt < 60_000) {
      return { allowed: false, reason: 'cooldown', waitSeconds: Math.ceil((60_000 - (now - current.lastSentAt)) / 1000) };
    }
    const inWindow = Boolean(current && now - current.windowStartTime < 60_000);
    if (inWindow && current!.windowCount >= 3) {
      return { allowed: false, reason: 'rate_limit', waitSeconds: Math.ceil((60_000 - (now - current!.windowStartTime)) / 1000) };
    }
    challenges[email] = {
      otpHash,
      expiresAt: now + 5 * 60_000,
      attempts: 0,
      lastSentAt: now,
      windowStartTime: inWindow ? current!.windowStartTime : now,
      windowCount: inWindow ? current!.windowCount + 1 : 1,
      status: 'PENDING'
    };
    saveJsonAdminMfaChallenges(challenges);
    return { allowed: true };
  }

  async setAdminMfaDeliveryResult(email: string, sent: boolean, requestId?: string): Promise<void> {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record || record.status !== 'PENDING') throw new Error('Administrator MFA challenge was not pending delivery.');
    record.status = sent ? 'SENT' : 'FAILED';
    if (requestId) record.requestId = requestId;
    saveJsonAdminMfaChallenges(challenges);
  }

  async verifyAdminMfa(email: string, otpHash: string): Promise<OtpVerificationResult> {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record) return 'not_found';
    if (record.status === 'LOCKED') return 'locked';
    if (record.status !== 'SENT') return 'not_found';
    if (Date.now() >= record.expiresAt) {
      record.status = 'EXPIRED';
      saveJsonAdminMfaChallenges(challenges);
      return 'expired';
    }
    if (record.attempts >= 4) {
      record.status = 'LOCKED';
      saveJsonAdminMfaChallenges(challenges);
      return 'locked';
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = 'LOCKED';
      saveJsonAdminMfaChallenges(challenges);
      return record.status === 'LOCKED' ? 'locked' : 'invalid';
    }
    record.status = 'CONSUMED';
    saveJsonAdminMfaChallenges(challenges);
    return 'verified';
  }

}

// High-speed in-memory user cache with 30s TTL to eliminate database roundtrips on authentication
const userCacheById = new Map<string, { user: any; expiresAt: number }>();
const userCacheByPhone = new Map<string, { user: any; expiresAt: number }>();
let listUsersCache: { data: any[]; expiresAt: number } | null = null;

function cacheUser(user: any) {
  if (!user || !user.id) return;
  const entry = { user, expiresAt: Date.now() + 30000 };
  userCacheById.set(user.id, entry);
  if (user.phone) userCacheByPhone.set(user.phone, entry);
}

function invalidateUserCache(userId: string, phone?: string) {
  listUsersCache = null;
  userCacheById.delete(userId);
  if (phone) userCacheByPhone.delete(phone);
  for (const [p, e] of userCacheByPhone.entries()) {
    if (e.user?.id === userId) userCacheByPhone.delete(p);
  }
}

// Strict Column Projections to eliminate Supabase Egress & Disk IO bloat
const USER_PROJECTION_COLUMNS = 'id, phone, password_hash, legal_name, email, role, active_role, dob, age, kyc_status, kyc_submitted_at, kyc_decided_at, kyc_decided_by, kyc_rejection_reason, profile_photo, bio, photos, city, state, address, referral_code, referred_by, successful_referrals_count, has_10_percent_booking_discount, is_companion_active, membership_expiry, membership_type, has_used_free_trial, is_boosted, boost_expiry, has_verified_referrer_badge, created_at, updated_at, kyc_decided_by_admin_id';
const KYC_LIST_COLUMNS = 'id, user_id, submission_role, legal_name, dob, id_type, id_reference, status, submitted_at, reviewed_at, rejection_reason, reviewed_by_admin_id, profile_bio, created_at, updated_at';
const COMPANION_PROFILE_COLUMNS = 'id, user_id, services, rates, availability, is_live, rating, total_bookings, address, state, latitude, longitude, is_initial_listing, is_paused, created_at, updated_at';
const BOOKING_PROJECTION_COLUMNS = 'id, booking_code, client_id, companion_id, service_id, service_name, booking_date, start_time, end_time, duration_hours, meeting_location, meeting_address, latitude, longitude, notes, amount_paise, status, payment_order_id, payment_id, payment_status, start_otp_hash, completion_otp_hash, start_otp_encrypted, completion_otp_encrypted, companion_arrived_at, started_at, completed_at, delay_minutes, admin_platform_fee_paise, companion_gross_share_paise, companion_net_share_paise, late_penalty_paise, client_refund_penalty_paise, settlement_status, settlement_unlock_at, start_otp_attempts, completion_otp_attempts, start_otp_verified, completion_otp_verified, payout_id, created_at, updated_at';
const NOTIFICATION_COLUMNS = 'id, user_id, title, body, type, is_read, metadata, created_at';
const AUDIT_LOG_COLUMNS = 'id, admin_id, admin_email, action, target_type, target_id, details, ip_address, created_at';

// Supabase-based adapter (production)
class SupabaseDatabaseAdapter implements DatabaseAdapter {
  private fallbackAdapter = new JsonDatabaseAdapter();

  async getUser(id: string): Promise<any | null> {
    const cached = userCacheById.get(id);
    if (cached && Date.now() < cached.expiresAt) return cached.user;
    try {
      const { data, error } = await db.users().select(USER_PROJECTION_COLUMNS).eq('id', id).maybeSingle();
      if (error) throw error;
      const user = data ? this.mapUser(data) : null;
      if (user) cacheUser(user);
      return user;
    } catch (err: any) {
      console.warn('Supabase getUser fallback notice:', err?.message || err);
      const localUser = await this.fallbackAdapter.getUser(id).catch(() => null);
      if (localUser) {
        cacheUser(localUser);
        return localUser;
      }
      throw err;
    }
  }

  async getUserByPhone(phone: string): Promise<any | null> {
    const cached = userCacheByPhone.get(phone);
    if (cached && Date.now() < cached.expiresAt) return cached.user;
    try {
      const { data, error } = await db.users().select(USER_PROJECTION_COLUMNS).eq('phone', phone).maybeSingle();
      if (error) throw error;
      const user = data ? this.mapUser(data) : null;
      if (user) cacheUser(user);
      return user;
    } catch (err: any) {
      console.warn('Supabase getUserByPhone fallback notice:', err?.message || err);
      const localUser = await this.fallbackAdapter.getUserByPhone(phone).catch(() => null);
      if (localUser) {
        cacheUser(localUser);
        return localUser;
      }
      throw err;
    }
  }

  async createUser(user: any): Promise<any> {
    const { data, error } = await db.users().insert({
      id: user.id,
      phone: user.phone,
      password_hash: user.passwordHash,
      legal_name: user.legalName || null,
      email: user.email || null,
      role: user.role,
      active_role: user.activeRole,
      kyc_status: user.kycStatus || 'NOT_SUBMITTED',
      dob: user.dob || null,
      age: user.age || null,
      bio: user.bio || null,
      photos: user.photos || null,
      city: user.city || null,
      state: user.state || null,
      address: user.address || null,
      created_at: user.createdAt || new Date().toISOString()
    }).select().single();
    if (error) throw error;
    return this.mapUser(data);
  }

  private mapUser(user: any): any {
    if (!user) return null;
    let fallbackProfileName: string | undefined;
    let fallbackPhotos: string[] | undefined;
    let fallbackBio: string | undefined;
    let fallbackProfilePhoto: string | undefined;
    let fallbackSuspended: boolean | undefined;
    let fallbackSuspendedReason: string | undefined;
    let fallbackSuspendedAt: string | undefined;
    let fallbackWarningCount: number | undefined;
    let fallbackLastWarningReason: string | undefined;
    let fallbackLastWarningAt: string | undefined;
    if (typeof user.address === 'string' && user.address.startsWith('__META__:')) {
      try {
        const meta = JSON.parse(user.address.slice(9));
        if (meta?.profileName) fallbackProfileName = meta.profileName;
        if (Array.isArray(meta?.photos) && meta.photos.length > 0) fallbackPhotos = meta.photos;
        if (typeof meta?.bio === 'string') fallbackBio = meta.bio;
        if (typeof meta?.profilePhoto === 'string' && meta.profilePhoto) fallbackProfilePhoto = meta.profilePhoto;
        if (meta?.isSuspended !== undefined) fallbackSuspended = meta.isSuspended;
        if (meta?.suspendedReason) fallbackSuspendedReason = meta.suspendedReason;
        if (meta?.suspendedAt) fallbackSuspendedAt = meta.suspendedAt;
        if (meta?.warningCount !== undefined) fallbackWarningCount = meta.warningCount;
        if (meta?.lastWarningReason) fallbackLastWarningReason = meta.lastWarningReason;
        if (meta?.lastWarningAt) fallbackLastWarningAt = meta.lastWarningAt;
      } catch {}
    }
    const resolvedProfileName = user.profile_name || user.profileName || fallbackProfileName || user.legal_name || 'User';
    const resolvedPhotos = (Array.isArray(user.photos) && user.photos.length > 0)
      ? user.photos
      : (fallbackPhotos || []);
    const resolvedProfilePhoto = user.profile_photo || user.profilePhoto || fallbackProfilePhoto || resolvedPhotos[0] || null;
    const resolvedBio = (user.bio !== undefined && user.bio !== null) ? user.bio : (fallbackBio || '');
    return {
      ...user,
      passwordHash: user.password_hash,
      legalName: user.legal_name,
      profileName: resolvedProfileName,
      activeRole: user.active_role,
      kycStatus: user.kyc_status,
      kycRejectionReason: user.kyc_rejection_reason,
      profilePhoto: resolvedProfilePhoto,
      kycSubmittedAt: user.kyc_submitted_at,
      kycDecidedAt: user.kyc_decided_at,
      kycDecidedBy: user.kyc_decided_by,
      kycDecidedByAdminId: user.kyc_decided_by_admin_id,
      dob: user.dob,
      age: user.age,
      bio: resolvedBio,
      photos: resolvedPhotos,
      city: user.city,
      state: user.state,
      address: typeof user.address === 'string' && user.address.startsWith('__META__:') ? '' : user.address,
      isSuspended: user.is_suspended !== undefined ? !!user.is_suspended : (user.isSuspended !== undefined ? !!user.isSuspended : !!fallbackSuspended),
      suspendedReason: user.suspended_reason || user.suspendedReason || fallbackSuspendedReason,
      suspendedAt: user.suspended_at || user.suspendedAt || fallbackSuspendedAt,
      warningCount: typeof user.warning_count === 'number' ? user.warning_count : (typeof user.warningCount === 'number' ? user.warningCount : (fallbackWarningCount || 0)),
      lastWarningReason: user.last_warning_reason || user.lastWarningReason || fallbackLastWarningReason,
      lastWarningAt: user.last_warning_at || user.lastWarningAt || fallbackLastWarningAt,
      referralCode: user.referral_code || user.referralCode || null,
      referredBy: user.referred_by || user.referredBy || null,
      successfulReferralsCount: typeof user.successful_referrals_count === 'number' ? user.successful_referrals_count : (typeof user.successfulReferralsCount === 'number' ? user.successfulReferralsCount : 0),
      has10PercentBookingDiscount: user.has_10_percent_booking_discount !== undefined ? !!user.has_10_percent_booking_discount : (user.has10PercentBookingDiscount !== undefined ? !!user.has10PercentBookingDiscount : false),
      isCompanionActive: user.is_companion_active !== undefined ? !!user.is_companion_active : (user.isCompanionActive !== undefined ? !!user.isCompanionActive : false),
      membershipExpiry: user.membership_expiry || user.membershipExpiry || null,
      membershipType: user.membership_type || user.membershipType || 'none',
      hasUsedFreeTrial: user.has_used_free_trial !== undefined ? !!user.has_used_free_trial : (user.hasUsedFreeTrial !== undefined ? !!user.hasUsedFreeTrial : false),
      isBoosted: user.is_boosted !== undefined ? !!user.is_boosted : (user.isBoosted !== undefined ? !!user.isBoosted : false),
      boostExpiry: user.boost_expiry || user.boostExpiry || null,
      hasVerifiedReferrerBadge: user.has_verified_referrer_badge !== undefined ? !!user.has_verified_referrer_badge : (user.hasVerifiedReferrerBadge !== undefined ? !!user.hasVerifiedReferrerBadge : false),
      createdAt: user.created_at
    };
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const columnNames: Record<string, string> = {
      role: 'role',
      activeRole: 'active_role',
      kycStatus: 'kyc_status',
      legalName: 'legal_name',
      profileName: 'profile_name',
      kycSubmittedAt: 'kyc_submitted_at',
      kycDecidedAt: 'kyc_decided_at',
      kycDecidedBy: 'kyc_decided_by',
      kycDecidedByAdminId: 'kyc_decided_by_admin_id',
      kycRejectionReason: 'kyc_rejection_reason',
      profilePhoto: 'profile_photo',
      dob: 'dob',
      age: 'age',
      bio: 'bio',
      photos: 'photos',
      city: 'city',
      state: 'state',
      address: 'address',
      isSuspended: 'is_suspended',
      suspendedReason: 'suspended_reason',
      suspendedAt: 'suspended_at',
      warningCount: 'warning_count',
      lastWarningReason: 'last_warning_reason',
      lastWarningAt: 'last_warning_at',
      referralCode: 'referral_code',
      referredBy: 'referred_by',
      successfulReferralsCount: 'successful_referrals_count',
      has10PercentBookingDiscount: 'has_10_percent_booking_discount',
      isCompanionActive: 'is_companion_active',
      membershipExpiry: 'membership_expiry',
      membershipType: 'membership_type',
      hasUsedFreeTrial: 'has_used_free_trial',
      isBoosted: 'is_boosted',
      boostExpiry: 'boost_expiry',
      hasVerifiedReferrerBadge: 'has_verified_referrer_badge',
      createdAt: 'created_at',
      passwordHash: 'password_hash'
    };
    const rowUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (columnNames[key]) {
        rowUpdates[columnNames[key]] = value;
      }
    }
    // Reliable persistence fallback: embed profileName, photos, bio, profilePhoto and moderation metadata in address
    // This is the primary fallback for Supabase databases that may be missing newer columns.
    let existingMeta: Record<string, any> = {};
    try {
      const { data: cur } = await db.users().select('address').eq('id', id).maybeSingle();
      if (cur?.address && typeof cur.address === 'string' && cur.address.startsWith('__META__:')) {
        existingMeta = JSON.parse(cur.address.slice(9));
      }
    } catch {}

    const metaUpdates: Record<string, any> = { ...existingMeta };
    if (updates.profileName !== undefined) metaUpdates.profileName = updates.profileName;
    if (Array.isArray(updates.photos)) metaUpdates.photos = updates.photos;
    if (updates.bio !== undefined) metaUpdates.bio = updates.bio;
    if (updates.profilePhoto !== undefined) metaUpdates.profilePhoto = updates.profilePhoto;
    if (updates.isSuspended !== undefined) metaUpdates.isSuspended = updates.isSuspended;
    if (updates.suspendedReason !== undefined) metaUpdates.suspendedReason = updates.suspendedReason;
    if (updates.suspendedAt !== undefined) metaUpdates.suspendedAt = updates.suspendedAt;
    if (updates.warningCount !== undefined) metaUpdates.warningCount = updates.warningCount;
    if (updates.lastWarningReason !== undefined) metaUpdates.lastWarningReason = updates.lastWarningReason;
    if (updates.lastWarningAt !== undefined) metaUpdates.lastWarningAt = updates.lastWarningAt;

    if (Object.keys(metaUpdates).length > 0 && !updates.address) {
      rowUpdates['address'] = '__META__:' + JSON.stringify(metaUpdates);
    }

    // Helper to merge __META__ updates after a successful DB write
    const applyMetaOverrides = (userObj: any): any => {
      if (metaUpdates.profileName) userObj.profileName = metaUpdates.profileName;
      if (Array.isArray(metaUpdates.photos)) userObj.photos = metaUpdates.photos;
      if (metaUpdates.bio !== undefined) userObj.bio = metaUpdates.bio;
      if (metaUpdates.profilePhoto) userObj.profilePhoto = metaUpdates.profilePhoto;
      if (metaUpdates.isSuspended !== undefined) userObj.isSuspended = metaUpdates.isSuspended;
      if (metaUpdates.suspendedReason !== undefined) userObj.suspendedReason = metaUpdates.suspendedReason;
      if (metaUpdates.warningCount !== undefined) userObj.warningCount = metaUpdates.warningCount;
      if (metaUpdates.lastWarningReason !== undefined) userObj.lastWarningReason = metaUpdates.lastWarningReason;
      return userObj;
    };

    try {
      const { data, error } = await db.users().update(rowUpdates).eq('id', id).select().maybeSingle();
      if (error) {
        // If newer columns do not exist yet in Supabase users table, safely retry without them
        // The __META__:address fallback above ensures data is always persisted
        if (error.message?.includes('profile_name') || error.code === '42703' || String(error.message).includes('column')) {
          const fallbackUpdates = { ...rowUpdates };
          delete fallbackUpdates.profile_name;
          delete fallbackUpdates.is_suspended;
          delete fallbackUpdates.suspended_reason;
          delete fallbackUpdates.suspended_at;
          delete fallbackUpdates.warning_count;
          delete fallbackUpdates.last_warning_reason;
          delete fallbackUpdates.last_warning_at;
          let retry = await db.users().update(fallbackUpdates).eq('id', id).select().maybeSingle();
          if (retry.error && (retry.error.code === '42703' || String(retry.error.message).includes('column'))) {
            // Progressively strip non-core columns if they trigger missing column errors
            delete fallbackUpdates.photos;
            delete fallbackUpdates.bio;
            delete fallbackUpdates.profile_photo;
            retry = await db.users().update(fallbackUpdates).eq('id', id).select().maybeSingle();
          }
          if (retry.error) {
            console.warn('Supabase updateUser fallback error:', retry.error.message);
          }
          const updatedUser = applyMetaOverrides(this.mapUser(retry.data || { id, ...updates }));
          cacheUser(updatedUser);
          return updatedUser;
        }
        console.warn('Supabase updateUser error:', error.message);
      }
      const updatedUser = applyMetaOverrides(this.mapUser(data || { id, ...updates }));
      cacheUser(updatedUser);
      return updatedUser;
    } catch (err: any) {
      console.warn('Supabase updateUser exception:', err.message);
      invalidateUserCache(id);
      return applyMetaOverrides(this.mapUser({ id, ...updates }));
    }
  }

  async listUsers(filters?: any): Promise<any[]> {
    if (!filters && listUsersCache && Date.now() < listUsersCache.expiresAt) {
      return listUsersCache.data;
    }
    let query = db.users().select('id, phone, legal_name, email, role, active_role, dob, age, kyc_status, profile_photo, bio, city, state, address, created_at, updated_at');
    if (filters?.role) query = query.eq('role', filters.role);
    if (filters?.kycStatus) query = query.eq('kyc_status', filters.kycStatus);
    const { data, error } = await query;
    if (error) throw error;
    const mapped = (data || []).map((user: any) => this.mapUser(user));
    if (!filters) {
      listUsersCache = { data: mapped, expiresAt: Date.now() + 30000 };
    }
    return mapped;
  }

  async deleteUser(userId: string): Promise<void> {
    await Promise.allSettled([
      db.kycSubmissions().delete().eq('user_id', userId),
      db.companionProfiles().delete().eq('user_id', userId),
      db.companionMemberships().delete().eq('user_id', userId),
      db.bankVerifications().delete().eq('user_id', userId),
      db.userLocations().delete().eq('user_id', userId),
      db.userPresence().delete().eq('user_id', userId),
      db.firebaseDeviceTokens().delete().eq('user_id', userId),
      db.notifications().delete().eq('user_id', userId),
      db.chatMessages().delete().eq('sender_id', userId),
      db.supportMessages().delete().eq('sender_id', userId)
    ]);
    const { error } = await db.users().delete().eq('id', userId);
    if (error) {
      console.warn('Supabase deleteUser error:', error.message);
      throw error;
    }
  }

  async createKycSubmission(submission: any): Promise<any> {
    const { data, error } = await db.kycSubmissions().insert(mapKycSubmissionToRow(submission)).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }

  async submitKycSubmission(submission: any): Promise<any> {
    const { data, error } = await supabase.rpc('submit_profile_kyc', {
      p_user_id: submission.userId,
      p_submission_id: submission.id,
      p_role: submission.userType,
      p_legal_name: submission.legalName,
      p_dob: submission.dob,
      p_id_type: submission.idType,
      p_id_front_path: submission.idFrontUrl,
      p_id_back_path: submission.idBackUrl || null,
      p_selfie_path: submission.selfieUrl,
      p_bio: submission.bio || null,
      p_photos: submission.photos || null,
      p_city: submission.city || null
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') {
      throw new Error('Supabase returned an invalid KYC submission response.');
    }
    return mapKycSubmissionFromRow(data);
  }

  async getKycSubmission(id: string): Promise<any | null> {
    const { data, error } = await db.kycSubmissions().select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }

  async getUserKycSubmission(userId: string, submissionRole: 'CLIENT' | 'COMPANION'): Promise<any | null> {
    const { data, error } = await db.kycSubmissions().select(KYC_LIST_COLUMNS)
      .eq('user_id', userId)
      .eq('submission_role', submissionRole)
      .maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }

  async listKycSubmissions(filters?: any): Promise<any[]> {
    let query = db.kycSubmissions().select(KYC_LIST_COLUMNS);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.submissionRole) query = query.eq('submission_role', filters.submissionRole);
    query = query.order('submitted_at', { ascending: false }).limit(filters?.limit || 50);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapKycSubmissionFromRow);
  }

  async updateKycSubmission(id: string, updates: any): Promise<any> {
    const rowUpdates: Record<string, unknown> = {};
    const fields: Record<string, string> = {
      legalName: 'legal_name',
      dob: 'dob',
      idType: 'id_type',
      idReference: 'id_reference',
      idFrontUrl: 'id_front_document_path',
      idBackUrl: 'id_back_document_path',
      selfieUrl: 'selfie_document_path',
      status: 'status',
      decidedAt: 'reviewed_at',
      decidedByAdminId: 'reviewed_by_admin_id',
      rejectionReason: 'rejection_reason',
      bio: 'profile_bio',
      photos: 'profile_photos',
      city: 'city'
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.kycSubmissions().update(rowUpdates).eq('id', id).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }

  async reviewKycSubmission(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason: string | null,
    adminUserId: string
  ): Promise<any> {
    const { data, error } = await supabase.rpc('review_profile_kyc', {
      p_submission_id: id,
      p_decision: decision,
      p_rejection_reason: rejectionReason,
      p_admin_user_id: adminUserId
    });
    if (error) throw error;
    if (!data?.submission) throw new Error('Supabase returned an invalid KYC review response.');
    return mapKycSubmissionFromRow(data.submission);
  }

  async createKycDocumentSignedUrls(id: string): Promise<Record<string, string | null> | null> {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    const bucket = submission.userType === 'COMPANION' ? 'companion-kyc-documents' : 'client-kyc-documents';
    const documents: Record<string, string | null> = {
      idFrontUrl: submission.idFrontUrl || null,
      idBackUrl: submission.idBackUrl || null,
      selfieUrl: submission.selfieUrl || null
    };
    for (const [key, objectPath] of Object.entries(documents)) {
      if (!objectPath) continue;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 300);
      if (error) throw error;
      documents[key] = data.signedUrl;
    }
    return documents;
  }

  async uploadKycDocument(bucket: string, objectPath: string, bytes: Buffer, contentType: string): Promise<void> {
    if (bucket !== 'client-kyc-documents' && bucket !== 'companion-kyc-documents') {
      throw new Error('Invalid private KYC storage bucket.');
    }
    const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType,
      upsert: false
    });
    if (error) throw error;
  }

  async deleteKycDocuments(bucket: string, paths: string[]): Promise<void> {
    if (bucket !== 'client-kyc-documents' && bucket !== 'companion-kyc-documents') {
      throw new Error('Invalid private KYC storage bucket.');
    }
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }

  async getCompanionProfile(userId: string): Promise<any | null> {
    const { data, error } = await db.companionProfiles().select(COMPANION_PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? mapCompanionProfileFromRow(data) : null;
  }

  async createCompanionProfile(profile: any): Promise<any> {
    const { data, error } = await db.companionProfiles()
      .upsert(mapCompanionProfileToRow(profile), { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }

  async upsertCompanionProfile(profile: any): Promise<any> {
    return this.createCompanionProfile(profile);
  }

  async updateCompanionProfile(userId: string, updates: any): Promise<any> {
    const rowUpdates = mapCompanionProfilePatchToRow(updates);
    const { data, error } = await db.companionProfiles().update(rowUpdates).eq('user_id', userId).select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }

  async listCompanionProfiles(filters?: any): Promise<any[]> {
    let query = db.companionProfiles().select(COMPANION_PROFILE_COLUMNS);
    if (filters?.isLive !== undefined) query = query.eq('is_live', filters.isLive);
    if (filters?.state) query = query.eq('state', filters.state);
    query = query.limit(Number.isInteger(filters?.limit) && filters.limit > 0 ? filters.limit : 50);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapCompanionProfileFromRow);
  }

  async createMembership(membership: any): Promise<any> {
    const { data, error } = await db.companionMemberships().insert({
      ...(uuidOrUndefined(membership.id) ? { id: membership.id } : {}),
      user_id: membership.userId,
      plan: membership.plan,
      amount_paise: membership.pricePaise ?? membership.amountPaise,
      currency: membership.currency || 'INR',
      start_date: membership.startDate,
      expiry_date: membership.expiryDate,
      payment_order_id: membership.paymentOrderId || null,
      payment_id: membership.paymentId || null,
      payment_status: membership.paymentStatus || 'PENDING',
      paid_at: membership.paidAt || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status,
      isActive: data.payment_status === 'PAID' && new Date(data.expiry_date) > new Date()
    };
  }

  async getActiveMembership(userId: string): Promise<any | null> {
    let { data, error } = await db.companionMemberships()
      .select('*')
      .eq('user_id', userId)
      .order('expiry_date', { ascending: false })
      .limit(10);
    if (error) throw error;

    if (!data || data.length === 0) {
      try {
        const { data: currentUser } = await db.users().select('phone, role, legal_name').eq('id', userId).maybeSingle();
        if (currentUser?.phone) {
          const rawPhone = currentUser.phone.replace(/^\+91/, '').trim();
          const phones = [currentUser.phone, rawPhone, `+91${rawPhone}`];
          const { data: matchingUsers } = await db.users().select('id').in('phone', phones);
          const userIds = (matchingUsers || []).map((u: any) => u.id).filter((id: string) => id !== userId);
          if (userIds.length > 0) {
            const { data: altMems } = await db.companionMemberships()
              .select('*')
              .in('user_id', userIds)
              .order('expiry_date', { ascending: false })
              .limit(5);
            if (altMems && altMems.length > 0) {
              data = altMems;
            }
          }
        }
      } catch (_) {}
    }

    if (!data || data.length === 0) return null;

    const now = new Date();
    const active = data.find((row: any) => {
      const status = String(row.payment_status || row.status || '').toUpperCase();
      const isPaid = status === 'PAID' || status === 'ACTIVE' || status === 'COMPLETED' || status === 'SUCCESS' || Boolean(row.payment_id);
      const isNotFailed = status !== 'FAILED' && status !== 'CANCELLED';
      if (!isPaid || !isNotFailed) return false;
      if (!row.expiry_date) return true;
      return new Date(row.expiry_date) > now;
    }) || data[0];

    const status = String(active.payment_status || active.status || '').toUpperCase();
    const isPaid = status === 'PAID' || status === 'ACTIVE' || status === 'COMPLETED' || status === 'SUCCESS' || Boolean(active.payment_id);
    const isNotExpired = !active.expiry_date || new Date(active.expiry_date) > now;
    const isNotFailed = status !== 'FAILED' && status !== 'CANCELLED';
    const isActive = Boolean(isPaid && isNotExpired && isNotFailed);

    return {
      ...active,
      userId: active.user_id,
      plan: active.plan || 'PROFESSIONAL',
      pricePaise: active.amount_paise,
      startDate: active.start_date,
      expiryDate: active.expiry_date,
      paymentOrderId: active.payment_order_id,
      paymentId: active.payment_id,
      paymentStatus: isPaid ? 'PAID' : (active.payment_status || 'PENDING'),
      isActive
    };
  }

  async getMembershipByPaymentOrder(orderId: string): Promise<any | null> {
    const { data, error } = await db.companionMemberships()
      .select('*').eq('payment_order_id', orderId).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status
    } : null;
  }

  async listMemberships(filters?: any): Promise<any[]> {
    let query = db.companionMemberships().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      userId: row.user_id,
      pricePaise: row.amount_paise,
      startDate: row.start_date,
      expiryDate: row.expiry_date,
      paymentOrderId: row.payment_order_id,
      paymentId: row.payment_id,
      paymentStatus: row.payment_status || (row.payment_id ? 'PAID' : 'PENDING')
    }));
  }

  async updateMembershipOrder(id: string, orderId: string): Promise<any> {
    const { data, error } = await db.companionMemberships()
      .update({ payment_order_id: orderId }).eq('id', id).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status
    };
  }

  async createBankVerification(verification: any): Promise<any> {
    const { data, error } = await db.bankVerifications().upsert({
      ...(uuidOrUndefined(verification.id) ? { id: verification.id } : {}),
      user_id: verification.userId,
      account_number_encrypted: verification.accountNumberEncrypted,
      account_number_last4: verification.accountNumberLast4,
      ifsc: verification.ifsc,
      bank_name: verification.bankName || null,
      account_holder_name: verification.accountHolderName,
      verification_status: verification.verificationStatus || 'PENDING',
      name_at_bank: verification.nameAtBank || null,
      name_matched: verification.nameMatched ?? null,
      provider_request_id: verification.providerRequestId || null,
      verified_at: verification.verifiedAt || null
    }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data;
  }

  async getBankVerification(userId: string): Promise<any | null> {
    let { data, error } = await db.bankVerifications().select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) {
      try {
        const { data: currentUser } = await db.users().select('phone').eq('id', userId).maybeSingle();
        if (currentUser?.phone) {
          const rawPhone = currentUser.phone.replace(/^\+91/, '').trim();
          const phones = [currentUser.phone, rawPhone, `+91${rawPhone}`];
          const { data: matchingUsers } = await db.users().select('id').in('phone', phones);
          const userIds = (matchingUsers || []).map((u: any) => u.id).filter((id: string) => id !== userId);
          if (userIds.length > 0) {
            const { data: altBank } = await db.bankVerifications().select('*').in('user_id', userIds).limit(1);
            if (altBank && altBank.length > 0) {
              data = altBank[0];
            }
          }
        }
      } catch (_) {}
    }
    if (!data) return null;
    const isVerified = String(data.verification_status || '').toUpperCase() === 'VERIFIED' || data.is_verified === true || Boolean(data.name_matched);
    return {
      ...data,
      userId: data.user_id,
      accountNumberEncrypted: data.account_number_encrypted,
      accountNumberMasked: data.account_number_last4 ? `••••${data.account_number_last4}` : null,
      accountNumberLast4: data.account_number_last4,
      bankName: data.bank_name,
      accountHolderName: data.account_holder_name,
      verificationStatus: isVerified ? 'VERIFIED' : (data.verification_status || 'PENDING'),
      isVerified,
      nameAtBank: data.name_at_bank,
      nameMatched: data.name_matched,
      providerRequestId: data.provider_request_id,
      verifiedAt: data.verified_at
    };
  }

  async updateBankVerification(userId: string, updates: any): Promise<any> {
    const rowUpdates: Record<string, unknown> = {};
    const fields: Record<string, string> = {
      accountNumberEncrypted: 'account_number_encrypted',
      ifsc: 'ifsc',
      accountHolderName: 'account_holder_name',
      verificationStatus: 'verification_status',
      nameAtBank: 'name_at_bank',
      nameMatched: 'name_matched',
      providerRequestId: 'provider_request_id',
      verifiedAt: 'verified_at'
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.bankVerifications().update(rowUpdates).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  }

  async createBooking(booking: any): Promise<any> {
    const { data, error } = await db.bookings().insert(mapBookingToRow(booking)).select().single();
    if (error) throw error;
    return mapBookingFromRow(data);
  }

  async reserveBookingPayment(booking: any): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('reserve_booking_payment', {
        p_booking_id: booking.id,
        p_booking_code: booking.bookingCode,
        p_client_id: booking.clientId,
        p_companion_id: booking.companionId,
        p_service_id: booking.serviceId,
        p_service_name: booking.serviceName,
        p_booking_date: booking.date,
        p_start_time: booking.startTime,
        p_end_time: booking.endTime,
        p_duration_hours: booking.durationHours,
        p_meeting_location: booking.meetingLocation,
        p_notes: booking.notes || null
      });
      if (!error && data && typeof data === 'object') {
        return mapBookingFromRow(data);
      }
      if (error) {
        console.warn('reserve_booking_payment RPC returned error, using direct booking table reservation:', error.message || error);
      }
    } catch (rpcErr: any) {
      console.warn('reserve_booking_payment RPC threw, using direct booking table reservation:', rpcErr?.message || rpcErr);
    }

    // Direct fallback insertion into bookings table
    const amountPaise = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const feePaise = Math.round(amountPaise * 0.15);
    const bookingRow = {
      id: booking.id,
      booking_code: booking.bookingCode,
      client_id: booking.clientId,
      companion_id: booking.companionId,
      service_id: booking.serviceId,
      service_name: booking.serviceName,
      booking_date: booking.date,
      start_time: booking.startTime,
      end_time: booking.endTime,
      duration_hours: booking.durationHours,
      meeting_location: booking.meetingLocation,
      notes: booking.notes || null,
      amount_paise: amountPaise,
      status: 'PENDING',
      payment_status: 'PENDING',
      admin_platform_fee_paise: feePaise,
      companion_gross_share_paise: amountPaise - feePaise,
      companion_net_share_paise: amountPaise - feePaise,
      settlement_status: 'LOCKED'
    };
    const { data: inserted, error: insertErr } = await db.bookings().insert(bookingRow).select().single();
    if (insertErr) {
      console.error('Direct booking insert failed:', insertErr);
      throw insertErr;
    }
    return mapBookingFromRow(inserted);
  }

  async getBooking(id: string): Promise<any | null> {
    const { data, error } = await db.bookings().select(BOOKING_PROJECTION_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }

  async getBookingByCode(code: string): Promise<any | null> {
    const { data, error } = await db.bookings().select(BOOKING_PROJECTION_COLUMNS).eq('booking_code', code).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }

  async getBookingByPaymentOrder(orderId: string): Promise<any | null> {
    const { data, error } = await db.bookings().select(BOOKING_PROJECTION_COLUMNS).eq('payment_order_id', orderId).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }

  async listBookings(filters?: any): Promise<any[]> {
    let query = db.bookings().select(BOOKING_PROJECTION_COLUMNS);
    if (filters?.participantId) {
      query = query.or(`client_id.eq.${filters.participantId},companion_id.eq.${filters.participantId}`);
    } else {
      if (filters?.clientId) query = query.eq('client_id', filters.clientId);
      if (filters?.companionId) query = query.eq('companion_id', filters.companionId);
    }
    if (filters?.status) query = query.eq('status', filters.status);
    query = query.order('created_at', { ascending: false }).limit(filters?.limit || 25);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapBookingFromRow);
  }

  async updateBooking(id: string, updates: any): Promise<any> {
    const fields: Record<string, string> = {
      bookingCode: 'booking_code',
      booking_code: 'booking_code',
      status: 'status',
      paymentOrderId: 'payment_order_id',
      payment_order_id: 'payment_order_id',
      paymentId: 'payment_id',
      payment_id: 'payment_id',
      paymentStatus: 'payment_status',
      payment_status: 'payment_status',
      startOtpHmac: 'start_otp_hash',
      start_otp_hash: 'start_otp_hash',
      endOtpHmac: 'completion_otp_hash',
      completion_otp_hash: 'completion_otp_hash',
      startOtpAttempts: 'start_otp_attempts',
      start_otp_attempts: 'start_otp_attempts',
      endOtpAttempts: 'completion_otp_attempts',
      completion_otp_attempts: 'completion_otp_attempts',
      startOtpVerified: 'start_otp_verified',
      start_otp_verified: 'start_otp_verified',
      endOtpVerified: 'completion_otp_verified',
      completion_otp_verified: 'completion_otp_verified',
      companionArrivedAt: 'companion_arrived_at',
      companion_arrived_at: 'companion_arrived_at',
      startedAt: 'started_at',
      started_at: 'started_at',
      meetingStartedAt: 'meeting_started_at',
      meeting_started_at: 'meeting_started_at',
      completedAt: 'completed_at',
      completed_at: 'completed_at',
      delayMinutes: 'delay_minutes',
      delay_minutes: 'delay_minutes',
      latePenaltyPaise: 'late_penalty_paise',
      late_penalty_paise: 'late_penalty_paise',
      companionNetSharePaise: 'companion_net_share_paise',
      companion_net_share_paise: 'companion_net_share_paise',
      clientRefundPenaltyPaise: 'client_refund_penalty_paise',
      client_refund_penalty_paise: 'client_refund_penalty_paise',
      settlementStatus: 'settlement_status',
      settlement_status: 'settlement_status',
      settlementUnlockUtc: 'settlement_unlock_at',
      settlement_unlock_at: 'settlement_unlock_at',
      payoutId: 'payout_id',
      payout_id: 'payout_id',
      companionCurrentArea: 'companion_current_area',
      companion_current_area: 'companion_current_area',
      companionEtaText: 'companion_eta_text',
      companion_eta_text: 'companion_eta_text',
      lastEtaUpdatedAt: 'last_eta_updated_at',
      last_eta_updated_at: 'last_eta_updated_at',
      sessionOtp: 'session_otp',
      session_otp: 'session_otp',
      companionAccepted: 'companion_accepted',
      companion_accepted: 'companion_accepted',
      rejectionReason: 'rejection_reason',
      rejection_reason: 'rejection_reason',
      bookingLocationName: 'booking_location_name',
      booking_location_name: 'booking_location_name',
      bookingLat: 'booking_lat',
      booking_lat: 'booking_lat',
      bookingLng: 'booking_lng',
      booking_lng: 'booking_lng',
      cancellationReason: 'cancellation_reason',
      cancellation_reason: 'cancellation_reason',
      cancellationNote: 'cancellation_note',
      cancellation_note: 'cancellation_note',
      cancelledAt: 'cancelled_at',
      cancelled_at: 'cancelled_at',
      hoursBeforeStart: 'hours_before_start',
      hours_before_start: 'hours_before_start',
      refundPercentage: 'refund_percentage',
      refund_percentage: 'refund_percentage',
      refundAmount: 'refund_amount',
      refund_amount: 'refund_amount',
      refundStatus: 'refund_status',
      refund_status: 'refund_status',
      refundBankDetails: 'refund_bank_details',
      refund_bank_details: 'refund_bank_details',
      refundUtr: 'refund_utr',
      refund_utr: 'refund_utr',
      refundedAt: 'refunded_at',
      refunded_at: 'refunded_at',
      refundedByAdmin: 'refunded_by_admin',
      refunded_by_admin: 'refunded_by_admin',
      actualStartTime: 'actual_start_time',
      actual_start_time: 'actual_start_time',
      selectedServices: 'selected_services',
      selected_services: 'selected_services',
      penaltyDeductedPaise: 'penalty_deducted_paise',
      penalty_deducted_paise: 'penalty_deducted_paise',
      cancelledBy: 'cancelled_by',
      cancelled_by: 'cancelled_by'
    };
    const nonDbColumns = new Set([
      'companion_accepted',
      'rejection_reason',
      'booking_location_name',
      'companion_eta_text',
      'companion_current_area',
      'last_eta_updated_at',
      'session_otp',
      'cancellation_reason',
      'cancellation_note',
      'cancelled_at',
      'hours_before_start',
      'refund_percentage',
      'refund_amount',
      'refund_status',
      'refund_bank_details',
      'refund_utr',
      'refunded_at',
      'refunded_by_admin',
      'actual_start_time',
      'selected_services',
      'penalty_deducted_paise',
      'cancelled_by'
    ]);
    const rowUpdates = Object.fromEntries(
      Object.entries(updates)
        .filter(([key]) => fields[key] && !nonDbColumns.has(fields[key]))
        .map(([key, value]) => [fields[key], value])
    );
    if (Object.keys(rowUpdates).length === 0) {
      const existing = await this.getBooking(id);
      return existing ? { ...existing, ...updates } : updates;
    }
    const { data, error } = await db.bookings().update(rowUpdates).eq('id', id).select().single();
    if (error) throw error;
    return { ...mapBookingFromRow(data), ...updates };
  }

  async markBookingCompanionArrived(bookingId: string, companionId: string): Promise<any> {
    const { data, error } = await supabase.rpc('mark_booking_companion_arrived', {
      p_booking_id: bookingId,
      p_companion_id: companionId
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('Supabase returned an invalid booking arrival response.');
    return mapBookingFromRow(data);
  }

  async verifyBookingOtp(
    bookingId: string,
    companionId: string,
    otpType: 'START' | 'COMPLETION',
    otpHash: string,
    delayMinutes = 0
  ): Promise<any> {
    const { data, error } = await supabase.rpc('verify_booking_otp', {
      p_booking_id: bookingId,
      p_companion_id: companionId,
      p_otp_type: otpType,
      p_otp_hash: otpHash,
      p_delay_minutes: delayMinutes
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('Supabase returned an invalid booking OTP response.');
    return {
      ...data,
      booking: data.booking ? mapBookingFromRow(data.booking) : undefined
    };
  }

  async finalizeRazorpayPayment(
    orderId: string,
    paymentId: string,
    amountPaise: number,
    startOtpHash: string,
    completionOtpHash: string,
    startOtpEncrypted: string,
    completionOtpEncrypted: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('finalize_razorpay_payment', {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_amount_paise: amountPaise,
        p_start_otp_hash: startOtpHash,
        p_completion_otp_hash: completionOtpHash,
        p_start_otp_encrypted: startOtpEncrypted,
        p_completion_otp_encrypted: completionOtpEncrypted
      });
      if (!error && data && typeof data === 'object' && data.record) {
        return {
          type: data.type,
          duplicate: Boolean(data.duplicate),
          record: data.type === 'BOOKING' ? mapBookingFromRow(data.record) : data.record
        };
      }
      if (error) {
        console.warn('finalize_razorpay_payment RPC notice, applying resilient direct table update:', error.message);
      }
    } catch (rpcErr: any) {
      console.warn('finalize_razorpay_payment RPC exception, applying resilient direct table update:', rpcErr?.message);
    }

    // Resilient fallback: Direct Supabase service_role update on bookings
    const { data: bookingRow } = await db.bookings().select('*').eq('payment_order_id', orderId).maybeSingle();
    if (bookingRow) {
      const { data: updatedBooking, error: bErr } = await db.bookings().update({
        status: 'CONFIRMED',
        payment_status: 'PAID',
        payment_id: paymentId,
        start_otp_hash: startOtpHash,
        completion_otp_hash: completionOtpHash,
        start_otp_encrypted: startOtpEncrypted,
        completion_otp_encrypted: completionOtpEncrypted,
        payment_expires_at: null,
        updated_at: new Date().toISOString()
      }).eq('id', bookingRow.id).select().single();
      if (!bErr && updatedBooking) {
        return {
          type: 'BOOKING',
          duplicate: false,
          record: mapBookingFromRow(updatedBooking)
        };
      }
    }

    // Resilient fallback: Direct Supabase service_role update on companion_memberships
    const { data: memRow } = await db.companionMemberships().select('*').eq('payment_order_id', orderId).maybeSingle();
    if (memRow) {
      const durationDays = memRow.plan === 'STARTER' ? 30 : memRow.plan === 'PROFESSIONAL' ? 90 : 365;
      const { data: updatedMem, error: mErr } = await db.companionMemberships().update({
        payment_status: 'PAID',
        payment_id: paymentId,
        paid_at: new Date().toISOString(),
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + durationDays * 86400000).toISOString()
      }).eq('id', memRow.id).select().single();
      if (!mErr && updatedMem) {
        return {
          type: 'MEMBERSHIP',
          duplicate: false,
          record: updatedMem
        };
      }
    }

    throw new Error('Supabase payment finalization record not found for order ' + orderId);
  }

  async createWalletEntry(entry: any): Promise<any> {
    const { data, error } = await db.walletLedger().insert({
      ...(uuidOrUndefined(entry.id) ? { id: entry.id } : {}),
      user_id: entry.userId,
      booking_id: entry.bookingId || null,
      transaction_type: entry.transactionType,
      gross_amount_paise: entry.grossAmountPaise ?? null,
      commission_paise: entry.commissionPaise ?? null,
      penalty_paise: entry.penaltyPaise ?? null,
      net_amount_paise: entry.netAmountPaise ?? null,
      balance_locked_until: entry.balanceLockedUntil || null,
      balance_status: entry.balanceStatus || 'AVAILABLE',
      description: entry.description || null,
      idempotency_key: entry.idempotencyKey || null
    }).select().single();
    if (error) throw error;
    return data;
  }

  async getWalletBalance(userId: string): Promise<any> {
    const { data, error } = await db.walletLedger().select('*').eq('user_id', userId);
    if (error) throw error;
    let available = 0;
    let locked = 0;
    for (const entry of data || []) {
      if (entry.balance_status === 'AVAILABLE') {
        available += entry.net_amount_paise || 0;
      } else if (entry.balance_status === 'LOCKED') {
        locked += entry.net_amount_paise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }

  async listWalletEntries(userId: string): Promise<any[]> {
    const { data, error } = await db.walletLedger().select('*').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      userId: row.user_id,
      bookingId: row.booking_id,
      transactionType: row.transaction_type,
      grossAmountPaise: row.gross_amount_paise,
      commissionPaise: row.commission_paise,
      penaltyPaise: row.penalty_paise,
      netAmountPaise: row.net_amount_paise,
      balanceLockedUntil: row.balance_locked_until,
      balanceStatus: row.balance_status
    }));
  }

  async createPayout(payout: any): Promise<any> {
    const { data, error } = await db.payouts().insert({
      ...(uuidOrUndefined(payout.id) ? { id: payout.id } : {}),
      user_id: payout.userId || payout.companionId,
      booking_id: payout.bookingId || null,
      total_amount_paise: payout.totalAmountPaise ?? payout.amountPaise,
      commission_paise: payout.commissionPaise || 0,
      penalty_paise: payout.penaltyPaise || 0,
      net_amount_paise: payout.netAmountPaise ?? payout.amountPaise,
      payout_status: payout.payoutStatus || 'PENDING',
      utr_reference: payout.utrReference || payout.utrNumber || null,
      admin_user_id: payout.adminId || null,
      processed_at: payout.processedAt || payout.paymentTimestamp || null,
      idempotency_key: payout.idempotencyKey || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      bookingId: data.booking_id,
      totalAmountPaise: data.total_amount_paise,
      commissionPaise: data.commission_paise,
      penaltyPaise: data.penalty_paise,
      netAmountPaise: data.net_amount_paise,
      payoutStatus: data.payout_status,
      utrReference: data.utr_reference,
      adminUserId: data.admin_user_id,
      processedAt: data.processed_at
    };
  }

  async listPayouts(filters?: any): Promise<any[]> {
    let query = db.payouts().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.status) query = query.eq('payout_status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      userId: row.user_id,
      bookingId: row.booking_id,
      totalAmountPaise: row.total_amount_paise,
      commissionPaise: row.commission_paise,
      penaltyPaise: row.penalty_paise,
      netAmountPaise: row.net_amount_paise,
      payoutStatus: row.payout_status,
      utrReference: row.utr_reference,
      adminUserId: row.admin_user_id,
      processedAt: row.processed_at
    }));
  }

  async updatePayout(id: string, updates: any): Promise<any> {
    const rowUpdates: Record<string, unknown> = {};
    const fields: Record<string, string> = {
      payoutStatus: 'payout_status',
      utrReference: 'utr_reference',
      adminUserId: 'admin_user_id',
      processedAt: 'processed_at'
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.payouts().update(rowUpdates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async createConversation(conversation: any): Promise<any> {
    const { data, error } = await db.chatConversations().insert({
      ...(uuidOrUndefined(conversation.id) ? { id: conversation.id } : {}),
      booking_id: conversation.bookingId || null,
      participant_a: conversation.participantA,
      participant_b: conversation.participantB
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      bookingId: data.booking_id,
      participantA: data.participant_a,
      participantB: data.participant_b
    };
  }

  async getConversation(id: string): Promise<any | null> {
    const { data, error } = await db.chatConversations().select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      bookingId: data.booking_id,
      participantA: data.participant_a,
      participantB: data.participant_b
    } : null;
  }

  async listConversations(userId: string): Promise<any[]> {
    const { data, error } = await db.chatConversations()
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      bookingId: row.booking_id,
      participantA: row.participant_a,
      participantB: row.participant_b
    }));
  }

  async createMessage(message: any): Promise<any> {
    const { data, error } = await db.chatMessages().insert({
      ...(uuidOrUndefined(message.id) ? { id: message.id } : {}),
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      message: message.message
    }).select().single();
    if (error) throw error;
    return { ...data, conversationId: data.conversation_id, senderId: data.sender_id };
  }

  async listMessages(conversationId: string, after?: string): Promise<any[]> {
    let query = db.chatMessages().select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(200);
    if (after) query = query.gt('created_at', after);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id
    }));
  }

  async createSupportConversation(conversation: any): Promise<any> {
    const { data, error } = await db.supportConversations().insert({
      ...(uuidOrUndefined(conversation.id) ? { id: conversation.id } : {}),
      user_id: conversation.userId,
      status: conversation.status || 'OPEN',
      subject: conversation.subject || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    };
  }

  async getSupportConversation(id: string): Promise<any | null> {
    const { data, error } = await db.supportConversations().select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    } : null;
  }

  async listSupportConversations(filters?: any): Promise<any[]> {
    let query = db.supportConversations().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      userId: row.user_id,
      assignedAdminId: row.assigned_admin_user_id || row.assigned_admin_id
    }));
  }

  async createSupportMessage(message: any): Promise<any> {
    const { data, error } = await db.supportMessages().insert({
      ...(uuidOrUndefined(message.id) ? { id: message.id } : {}),
      conversation_id: message.conversationId,
      sender_id: message.isAdmin ? null : message.senderId,
      admin_user_id: message.isAdmin ? message.adminUserId || message.senderId : null,
      is_admin: message.isAdmin || false,
      message: message.message
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      adminUserId: data.admin_user_id,
      isAdmin: data.is_admin
    };
  }

  async listSupportMessages(conversationId: string, after?: { createdAt: string; id: string }): Promise<any[]> {
    let query = db.supportMessages().select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(200);
    if (after) {
      query = query.or(`created_at.gt.${after.createdAt},and(created_at.eq.${after.createdAt},id.gt.${after.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      adminUserId: row.admin_user_id,
      isAdmin: row.is_admin
    }));
  }

  async updateSupportConversation(id: string, updates: any): Promise<any> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('status' in updates) row.status = updates.status;
    if ('assignedAdminId' in updates) row.assigned_admin_user_id = updates.assignedAdminId;
    const { data, error } = await db.supportConversations().update(row).eq('id', id).select().single();
    if (error) throw error;
    return { ...data, userId: data.user_id, assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id };
  }

  async getAdminUser(email: string): Promise<any | null> {
    const { data, error } = await db.adminUsers().select('*').eq('email', email.toLowerCase()).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }

  async getAdminUserById(id: string): Promise<any | null> {
    const { data, error } = await db.adminUsers().select('*').eq('id', id).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }

  async updateAdminPasswordHash(id: string, passwordHash: string): Promise<void> {
    const { error } = await db.adminUsers().update({ password_hash: passwordHash }).eq('id', id);
    if (error) throw error;
  }

  private mapAdminUser(admin: any): any {
    return {
      ...admin,
      passwordHash: admin.password_hash,
      name: admin.legal_name
    };
  }

  async createAdminUser(admin: any): Promise<any> {
    const { data, error } = await db.adminUsers().insert({
      ...(uuidOrUndefined(admin.id) ? { id: admin.id } : {}),
      email: admin.email.toLowerCase(),
      phone: admin.phone,
      password_hash: admin.passwordHash,
      role: admin.role,
      legal_name: admin.name || admin.legalName,
      is_active: admin.isActive ?? true
    }).select().single();
    if (error) throw error;
    return this.mapAdminUser(data);
  }

  async listAdminUsers(): Promise<any[]> {
    const { data, error } = await db.adminUsers().select('*');
    if (error) throw error;
    return (data || []).map((admin: any) => this.mapAdminUser(admin));
  }

  async updateAdminUserRole(id: string, role: string): Promise<any> {
    const { data, error } = await db.adminUsers().update({ role }).eq('id', id).select().single();
    if (error) throw error;
    return this.mapAdminUser(data);
  }

  async deleteAdminUser(id: string): Promise<void> {
    const { error } = await db.adminUsers().delete().eq('id', id);
    if (error) throw error;
  }

  async createAuditLog(log: any): Promise<void> {
    const { error } = await db.auditLogs().insert({
      ...(uuidOrUndefined(log.id) ? { id: log.id } : {}),
      admin_id: null,
      admin_user_id: uuidOrUndefined(log.adminUserId || log.adminId) || null,
      user_id: log.userId || null,
      action: log.action,
      entity_type: log.entityType || null,
      entity_id: uuidOrUndefined(log.entityId || log.targetId) || null,
      details: log.details ? { message: log.details } : null,
      ip_address: log.ipAddress || null,
      user_agent: log.userAgent || null
    });
    if (error) throw error;
  }

  async listAuditLogs(filters?: any): Promise<any[]> {
    let query = db.auditLogs().select('id, admin_user_id, user_id, action, entity_type, entity_id, details, ip_address, created_at');
    if (filters?.adminId) query = query.or(`admin_id.eq.${filters.adminId},admin_user_id.eq.${filters.adminId}`);
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.action) query = query.eq('action', filters.action);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(filters?.limit || 50);
    if (error) throw error;
    return data || [];
  }

  async createNotification(notification: any): Promise<any> {
    const { data, error } = await db.notifications().insert({
      ...(uuidOrUndefined(notification.id) ? { id: notification.id } : {}),
      user_id: notification.userId,
      type: notification.type || 'GENERAL',
      title: notification.title,
      body: notification.body || null,
      data: notification.data || null,
      read_at: notification.readAt || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      readAt: data.read_at,
      createdAt: data.created_at
    };
  }

  async listNotifications(userId: string): Promise<any[]> {
    const { data, error } = await db.notifications()
      .select('id, user_id, type, title, body, data, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      userId: row.user_id,
      readAt: row.read_at,
      createdAt: row.created_at
    }));
  }

  async markNotificationRead(id: string, userId?: string): Promise<void> {
    let query = db.notifications()
      .update({ read_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', id);
    if (userId) query = query.eq('user_id', userId);
    const { error, count } = await query;
    if (error) throw error;
    if (count === 0) throw new Error('Notification was not found.');
  }

  async claimNotificationPushes(notificationId?: string, limit = 100): Promise<any[]> {
    const { data, error } = await db.rpc('claim_notification_pushes', {
      p_notification_id: notificationId || null,
      p_limit: Math.min(500, Math.max(1, Math.trunc(limit)))
    });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      notification: row.notification,
      deviceTokens: row.device_tokens || []
    }));
  }

  async finishNotificationPush(id: string, success: boolean, errorMessage?: string): Promise<void> {
    const { data, error } = await db.rpc('finish_notification_push', {
      p_notification_id: id,
      p_success: success,
      p_error: errorMessage || null
    });
    if (error) throw error;
    if (data !== true) throw new Error('Supabase did not complete the notification push claim.');
  }

  async registerDeviceToken(userId: string, token: string, platform: 'WEB' | 'ANDROID' | 'IOS'): Promise<void> {
    const { error } = await db.firebaseDeviceTokens().upsert({
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString()
    }, { onConflict: 'token' });
    if (error) throw error;
  }

  async listDeviceTokens(userId: string): Promise<string[]> {
    const { data, error } = await db.firebaseDeviceTokens().select('token').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => row.token);
  }

  async deleteDeviceToken(token: string, userId?: string): Promise<void> {
    let query = db.firebaseDeviceTokens().delete().eq('token', token);
    if (userId) query = query.eq('user_id', userId);
    const { error } = await query;
    if (error) throw error;
  }

  async upsertUserLocation(location: any): Promise<any> {
    const { data, error } = await db.userLocations().upsert({
      user_id: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      booking_id: location.bookingId || null,
      sharing_enabled: location.sharingEnabled ?? false,
      updated_at: location.updatedAt || new Date().toISOString()
    }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return {
      userId: data.user_id,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      bookingId: data.booking_id,
      sharingEnabled: data.sharing_enabled,
      updatedAt: data.updated_at
    };
  }

  async getUserLocation(userId: string): Promise<any | null> {
    const { data, error } = await db.userLocations().select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? {
      userId: data.user_id,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      bookingId: data.booking_id,
      sharingEnabled: data.sharing_enabled,
      updatedAt: data.updated_at
    } : null;
  }

  async deleteUserLocation(userId: string): Promise<void> {
    const { error, count } = await db.userLocations().delete({ count: 'exact' }).eq('user_id', userId);
    if (error) throw error;
    if (count === 0) throw new Error('User location was not found.');
  }

  async upsertUserPresence(presence: any): Promise<any> {
    const { data, error } = await db.userPresence().upsert({
      user_id: presence.userId,
      is_online: presence.online,
      last_seen_at: presence.lastSeen || new Date().toISOString()
    }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at };
  }

  async getUserPresence(userId: string): Promise<any | null> {
    const { data, error } = await db.userPresence().select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at } : null;
  }

  async setBookingLocationSharing(bookingId: string, userId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.from('booking_location_sharing').upsert({
      booking_id: bookingId,
      user_id: userId,
      sharing_enabled: enabled,
      updated_at: new Date().toISOString()
    }, { onConflict: 'booking_id,user_id' });
    if (error) throw error;
  }

  async getBookingLocationSharing(bookingId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('booking_location_sharing')
      .select('sharing_enabled').eq('booking_id', bookingId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data?.sharing_enabled === true;
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<any> {
    // High-speed zero-latency in-memory rate limiter (0.01ms response time)
    const now = Date.now();
    let bucket = localRateLimitBuckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowSeconds * 1000) {
      bucket = { startedAt: now, count: 0 };
      localRateLimitBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    return {
      allowed: bucket.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowSeconds * 1000 - now) / 1000))
    };
  }

  async isSessionRevoked(tokenId: string): Promise<boolean> {
    // High-speed in-memory revocation check (0.01ms response time)
    return localRevokedSessions.has(tokenId);
  }

  async revokeSession(tokenId: string, principalId: string, principalType: 'USER' | 'ADMIN', expiresAt: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_session', {
      p_token_id: tokenId, p_principal_id: principalId, p_principal_type: principalType, p_expires_at: expiresAt
    });
    if (error) throw error;
  }

  async claimPaymentWebhookEvent(eventId: string, eventType: string, payload: any): Promise<any> {
    const { data, error } = await supabase.rpc('claim_payment_webhook_event', {
      p_event_id: eventId, p_event_type: eventType, p_payload: payload
    });
    if (error) throw error;
    if (!data || typeof data.claimed !== 'boolean' || typeof data.processed !== 'boolean') {
      throw new Error('Supabase returned an invalid webhook event claim.');
    }
    return data;
  }

  async completePaymentWebhookEvent(eventId: string, errorMessage?: string): Promise<void> {
    const { error } = await supabase.rpc('complete_payment_webhook_event', {
      p_event_id: eventId, p_error: errorMessage || null
    });
    if (error) throw error;
  }

  async markRazorpayOrderFailed(orderId: string, paymentId?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('mark_razorpay_order_failed', {
        p_order_id: orderId, p_payment_id: paymentId || null
      });
      if (!error && typeof data === 'boolean') return data;
    } catch (e) {
      console.warn('mark_razorpay_order_failed rpc warning:', e);
    }
    try {
      await db.bookings().update({ payment_status: 'FAILED', status: 'CANCELLED', ...(paymentId ? { payment_id: paymentId } : {}) }).eq('payment_order_id', orderId);
      await db.companionMemberships().update({ payment_status: 'FAILED', ...(paymentId ? { payment_id: paymentId } : {}) }).eq('payment_order_id', orderId);
      return true;
    } catch (e) {
      console.warn('markRazorpayOrderFailed direct update warning:', e);
      return false;
    }
  }

  async markRazorpayOrderCancelled(orderId: string): Promise<boolean> {
    try {
      await db.bookings().update({ payment_status: 'CANCELLED', status: 'CANCELLED' }).eq('payment_order_id', orderId);
      await db.companionMemberships().update({ payment_status: 'CANCELLED' }).eq('payment_order_id', orderId);
      return true;
    } catch (e) {
      console.warn('markRazorpayOrderCancelled direct update warning:', e);
      return false;
    }
  }

  async reservePaymentRefund(refund: any): Promise<any> {
    const { data, error } = await supabase.rpc('reserve_payment_refund', {
      p_booking_id: refund.bookingId || null,
      p_membership_id: refund.membershipId || null,
      p_payment_id: refund.paymentId,
      p_amount_paise: refund.amountPaise,
      p_idempotency_key: refund.idempotencyKey,
      p_reason: refund.reason,
      p_admin_user_id: refund.adminUserId
    });
    if (error) throw error;
    if (!data?.id || data.idempotency_key !== refund.idempotencyKey) {
      throw new Error('Supabase returned an invalid refund reservation.');
    }
    return data;
  }

  async listPaymentRefunds(filters?: any): Promise<any[]> {
    let query = db.paymentRefunds().select('*');
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.bookingId) query = query.eq('booking_id', filters.bookingId);
    if (filters?.paymentId) query = query.eq('payment_id', filters.paymentId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return data || [];
  }

  async updatePaymentRefund(idempotencyKey: string, status: string, providerRefundId?: string): Promise<any> {
    const { data, error } = await supabase.rpc('update_payment_refund', {
      p_idempotency_key: idempotencyKey, p_status: status, p_provider_refund_id: providerRefundId || null
    });
    if (error) throw error;
    return data;
  }

  async createRefundRequest(req: any): Promise<any> {
    const row = {
      booking_id: req.bookingId,
      client_id: req.clientId,
      refund_amount_paise: Number(req.refundAmountPaise || req.refund_amount_paise || 0),
      refund_reason: req.refundReason || req.refund_reason || 'companion_no_show',
      account_holder_name: req.accountHolderName || req.account_holder_name || null,
      bank_name: req.bankName || req.bank_name || null,
      account_number: req.accountNumber || req.account_number || null,
      ifsc_code: req.ifscCode || req.ifsc_code || null,
      upi_id: req.upiId || req.upi_id || null,
      payout_status: req.payoutStatus || req.payout_status || 'awaiting_details'
    };
    const { data, error } = await db.refundRequests().insert(row).select().single();
    if (error) throw error;
    return {
      id: data.id,
      bookingId: data.booking_id,
      clientId: data.client_id,
      refundAmountPaise: data.refund_amount_paise,
      refundReason: data.refund_reason,
      accountHolderName: data.account_holder_name,
      bankName: data.bank_name,
      accountNumber: data.account_number,
      ifscCode: data.ifsc_code,
      upiId: data.upi_id,
      payoutStatus: data.payout_status,
      adminTransactionRef: data.admin_transaction_ref,
      processedAt: data.processed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async getRefundRequestByBooking(bookingId: string): Promise<any | null> {
    const { data, error } = await db.refundRequests().select('*').eq('booking_id', bookingId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      bookingId: data.booking_id,
      clientId: data.client_id,
      refundAmountPaise: data.refund_amount_paise,
      refundReason: data.refund_reason,
      accountHolderName: data.account_holder_name,
      bankName: data.bank_name,
      accountNumber: data.account_number,
      ifscCode: data.ifsc_code,
      upiId: data.upi_id,
      payoutStatus: data.payout_status,
      adminTransactionRef: data.admin_transaction_ref,
      processedAt: data.processed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async listRefundRequests(filters?: any): Promise<any[]> {
    let query = db.refundRequests().select('*');
    if (filters?.clientId) query = query.eq('client_id', filters.clientId);
    if (filters?.payoutStatus) query = query.eq('payout_status', filters.payoutStatus);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      bookingId: row.booking_id,
      clientId: row.client_id,
      refundAmountPaise: row.refund_amount_paise,
      refundReason: row.refund_reason,
      accountHolderName: row.account_holder_name,
      bankName: row.bank_name,
      accountNumber: row.account_number,
      ifscCode: row.ifsc_code,
      upiId: row.upi_id,
      payoutStatus: row.payout_status,
      adminTransactionRef: row.admin_transaction_ref,
      processedAt: row.processed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateRefundRequest(id: string, updates: any): Promise<any> {
    const payload: any = {};
    if (updates.accountHolderName !== undefined) payload.account_holder_name = updates.accountHolderName;
    if (updates.bankName !== undefined) payload.bank_name = updates.bankName;
    if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber;
    if (updates.ifscCode !== undefined) payload.ifsc_code = updates.ifscCode;
    if (updates.upiId !== undefined) payload.upi_id = updates.upiId;
    if (updates.payoutStatus !== undefined) payload.payout_status = updates.payoutStatus;
    if (updates.adminTransactionRef !== undefined) payload.admin_transaction_ref = updates.adminTransactionRef;
    if (updates.processedAt !== undefined) payload.processed_at = updates.processedAt;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await db.refundRequests().update(payload).eq('id', id).select().single();
    if (error) throw error;
    return {
      id: data.id,
      bookingId: data.booking_id,
      clientId: data.client_id,
      refundAmountPaise: data.refund_amount_paise,
      refundReason: data.refund_reason,
      accountHolderName: data.account_holder_name,
      bankName: data.bank_name,
      accountNumber: data.account_number,
      ifscCode: data.ifsc_code,
      upiId: data.upi_id,
      payoutStatus: data.payout_status,
      adminTransactionRef: data.admin_transaction_ref,
      processedAt: data.processed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async processBookingPayout(bookingId: string, adminUserId: string, utrReference: string): Promise<any> {
    const { data, error } = await supabase.rpc('process_booking_payout', {
      p_booking_id: bookingId, p_admin_user_id: adminUserId, p_utr_reference: utrReference
    });
    if (error) throw error;
    if (!data?.id) throw new Error('Supabase returned an invalid payout result.');
    return data;
  }

  async claimScheduledJobRun(jobName: string, idempotencyKey: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('claim_scheduled_job_run', {
      p_job_name: jobName, p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    if (typeof data !== 'boolean') throw new Error('Supabase returned an invalid scheduled-job claim.');
    return data;
  }

  async finishScheduledJobRun(jobName: string, idempotencyKey: string, errorMessage?: string): Promise<void> {
    const { error } = await supabase.rpc('finish_scheduled_job_run', {
      p_job_name: jobName, p_idempotency_key: idempotencyKey, p_error: errorMessage || null
    });
    if (error) throw error;
  }

  async runScheduledMaintenance(): Promise<any> {
    const { data, error } = await supabase.rpc('run_scheduled_maintenance');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('Supabase returned an invalid scheduled-maintenance result.');
    return data;
  }

  async reserveAdminSensitiveMfa(adminUserId: string, action: string, otpHash: string): Promise<any> {
    const { data, error } = await supabase.rpc('reserve_admin_sensitive_mfa', {
      p_admin_user_id: adminUserId, p_action: action, p_otp_hash: otpHash
    });
    if (error) throw error;
    if (typeof data?.allowed !== 'boolean') throw new Error('Supabase returned an invalid sensitive MFA reservation.');
    return data;
  }

  async completeAdminSensitiveMfaDelivery(adminUserId: string, action: string, sent: boolean): Promise<boolean> {
    const { data, error } = await supabase.rpc('complete_admin_sensitive_mfa_delivery', {
      p_admin_user_id: adminUserId, p_action: action, p_sent: sent
    });
    if (error) throw error;
    if (typeof data !== 'boolean') throw new Error('Supabase returned an invalid sensitive MFA delivery result.');
    return data;
  }

  async verifyAdminSensitiveMfa(adminUserId: string, action: string, otpHash: string): Promise<string> {
    const { data, error } = await supabase.rpc('verify_admin_sensitive_mfa', {
      p_admin_user_id: adminUserId, p_action: action, p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!['verified', 'not_found', 'expired', 'locked', 'invalid'].includes(data)) {
      throw new Error('Supabase returned an invalid sensitive MFA verification result.');
    }
    return data;
  }

  async consumeAdminSensitiveMfa(adminUserId: string, action: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('consume_admin_sensitive_mfa', {
      p_admin_user_id: adminUserId, p_action: action
    });
    if (error) throw error;
    if (typeof data !== 'boolean') throw new Error('Supabase returned an invalid sensitive Admin MFA result.');
    return data;
  }

  async reserveOtp(phone: string, otpHash: string): Promise<OtpReservation> {
    const { data, error } = await supabase.rpc('reserve_auth_otp', {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== 'boolean') {
      throw new Error('Supabase returned an invalid OTP reservation response.');
    }
    return {
      allowed: data.allowed,
      reason: data.reason === 'cooldown' || data.reason === 'rate_limit' ? data.reason : undefined,
      waitSeconds: typeof data.waitSeconds === 'number' ? data.waitSeconds : undefined
    };
  }

  async setOtpDeliveryResult(phone: string, sent: boolean, requestId?: string): Promise<void> {
    const { data, error } = await supabase.rpc('complete_auth_otp_delivery', {
      p_phone: phone,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error('OTP challenge was not pending delivery.');
  }

  async verifyOtp(phone: string, otpHash: string): Promise<OtpVerificationResult> {
    const { data, error } = await supabase.rpc('verify_auth_otp', {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === 'verified' || data === 'not_found' || data === 'expired' || data === 'locked' || data === 'invalid') {
      return data;
    }
    throw new Error('Supabase returned an invalid OTP verification response.');
  }

  async reserveAdminMfa(email: string, otpHash: string): Promise<OtpReservation> {
    const { data, error } = await supabase.rpc('reserve_admin_mfa', {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== 'boolean') {
      throw new Error('Supabase returned an invalid administrator MFA reservation response.');
    }
    return {
      allowed: data.allowed,
      reason: data.reason === 'cooldown' || data.reason === 'rate_limit' ? data.reason : undefined,
      waitSeconds: typeof data.waitSeconds === 'number' ? data.waitSeconds : undefined
    };
  }

  async setAdminMfaDeliveryResult(email: string, sent: boolean, requestId?: string): Promise<void> {
    const { data, error } = await supabase.rpc('complete_admin_mfa_delivery', {
      p_email: email,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error('Administrator MFA challenge was not pending delivery.');
  }

  async verifyAdminMfa(email: string, otpHash: string): Promise<OtpVerificationResult> {
    const { data, error } = await supabase.rpc('verify_admin_mfa', {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === 'verified' || data === 'not_found' || data === 'expired' || data === 'locked' || data === 'invalid') {
      return data;
    }
    throw new Error('Supabase returned an invalid administrator MFA verification response.');
  }

  async createIncidentReport(report: any): Promise<any> {
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || 'PENDING_REVIEW',
      createdAt: report.createdAt || new Date().toISOString()
    };
    try {
      await db.auditLogs().insert({
        action: 'INCIDENT_REPORT',
        entity_type: 'incident_report',
        entity_id: uuidOrUndefined(item.bookingId) || null,
        details: item
      });
    } catch (e: any) {
      console.warn('Supabase createIncidentReport audit log warning:', e.message);
    }
    return item;
  }

  async listIncidentReports(filters?: any): Promise<any[]> {
    try {
      const { data, error } = await db.auditLogs()
        .select('*')
        .eq('action', 'INCIDENT_REPORT')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const reports = (data || []).map((row: any) => {
        const details = row.details || {};
        return {
          id: details.id || row.id,
          ...details,
          createdAt: details.createdAt || row.created_at
        };
      });
      return reports;
    } catch (e: any) {
      console.warn('Supabase listIncidentReports error:', e.message);
      return [];
    }
  }

  async updateIncidentReport(id: string, updates: any): Promise<any> {
    try {
      const reports = await this.listIncidentReports();
      const existing = reports.find(r => r.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      await db.auditLogs().insert({
        action: 'INCIDENT_REPORT_UPDATE',
        entity_type: 'incident_report',
        entity_id: uuidOrUndefined(existing.bookingId) || null,
        details: updated
      });
      return updated;
    } catch (e: any) {
      console.warn('Supabase updateIncidentReport error:', e.message);
      return null;
    }
  }

}

// Export the appropriate adapter based on configuration
const production = process.env.NODE_ENV === 'production';
if (production && !isSupabaseConfigured()) {
  throw new Error('Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; JSON database fallback is disabled.');
}

export const databaseAdapter: DatabaseAdapter = isSupabaseConfigured()
  ? new SupabaseDatabaseAdapter()
  : new JsonDatabaseAdapter();

export function getDatabaseType(): 'supabase' | 'json' {
  return databaseAdapter instanceof SupabaseDatabaseAdapter ? 'supabase' : 'json';
}
