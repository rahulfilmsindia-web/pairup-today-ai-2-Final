// server/jobs/maintenance.ts
import "dotenv/config";

// server/services/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
var isConfigured = Boolean(supabaseUrl && supabaseServiceKey);
if (process.env.NODE_ENV === "production" && !isConfigured) {
  throw new Error("Production startup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}
if (!isConfigured) {
  console.warn("Supabase URL or Service Role Key not configured; only the local-development adapter may be used.");
}
var activeUrl = isConfigured ? supabaseUrl : "https://placeholder-project.supabase.co";
var activeKey = isConfigured ? supabaseServiceKey : "placeholder-service-role-key-for-offline-builds";
var supabase = createClient(activeUrl, activeKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
var db = {
  rpc: (functionName, args) => supabase.rpc(functionName, args),
  users: () => supabase.from("users"),
  kycSubmissions: () => supabase.from("kyc_submissions"),
  companionProfiles: () => supabase.from("companion_profiles"),
  companionMemberships: () => supabase.from("companion_memberships"),
  bankVerifications: () => supabase.from("bank_verifications"),
  bookings: () => supabase.from("bookings"),
  walletLedger: () => supabase.from("wallet_ledger"),
  payouts: () => supabase.from("payouts"),
  chatConversations: () => supabase.from("chat_conversations"),
  chatMessages: () => supabase.from("chat_messages"),
  supportConversations: () => supabase.from("support_conversations"),
  supportMessages: () => supabase.from("support_messages"),
  adminUsers: () => supabase.from("admin_users"),
  adminMfaStore: () => supabase.from("admin_mfa_store"),
  auditLogs: () => supabase.from("audit_logs"),
  notifications: () => supabase.from("notifications"),
  firebaseDeviceTokens: () => supabase.from("firebase_device_tokens"),
  paymentRefunds: () => supabase.from("payment_refunds"),
  paymentWebhookEvents: () => supabase.from("payment_webhook_events"),
  userLocations: () => supabase.from("user_locations"),
  userPresence: () => supabase.from("user_presence")
};
function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseServiceKey);
}

// server/services/database.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DATA_DIR = path.join(__dirname, "../../data");
var DB_FILE = path.join(DATA_DIR, "pairuptoday_db.json");
var OTP_DB_FILE = path.join(DATA_DIR, "otp_challenges.json");
var ADMIN_MFA_DB_FILE = path.join(DATA_DIR, "admin_mfa_challenges.json");
var localRateLimitBuckets = /* @__PURE__ */ new Map();
var localRevokedSessions = /* @__PURE__ */ new Set();
var localWebhookEvents = /* @__PURE__ */ new Map();
function mapCompanionProfilePatchToRow(profile) {
  const fields = {
    services: "services",
    rates: "rates",
    availability: "availability",
    isLive: "is_live",
    rating: "rating",
    totalBookings: "total_bookings",
    address: "address",
    state: "state",
    latitude: "latitude",
    longitude: "longitude",
    isInitialListing: "is_initial_listing",
    isPaused: "is_paused"
  };
  const row = {};
  for (const [key, column] of Object.entries(fields)) {
    if (key in profile) row[column] = profile[key];
  }
  return row;
}
function loadJsonOtpChallenges() {
  if (!fs.existsSync(OTP_DB_FILE)) return {};
  const raw = fs.readFileSync(OTP_DB_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local OTP challenge storage is invalid.");
  }
  return parsed;
}
function saveJsonOtpChallenges(challenges) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${OTP_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), "utf-8");
  fs.renameSync(tempPath, OTP_DB_FILE);
}
function loadJsonAdminMfaChallenges() {
  if (!fs.existsSync(ADMIN_MFA_DB_FILE)) return {};
  const parsed = JSON.parse(fs.readFileSync(ADMIN_MFA_DB_FILE, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local administrator MFA challenge storage is invalid.");
  }
  return parsed;
}
function saveJsonAdminMfaChallenges(challenges) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${ADMIN_MFA_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), "utf-8");
  fs.renameSync(tempPath, ADMIN_MFA_DB_FILE);
}
var jsonDB = null;
function loadJsonDB() {
  if (jsonDB) return jsonDB;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      jsonDB = JSON.parse(raw);
      return jsonDB;
    } catch (err) {
      console.error("Failed to parse JSON DB file", err);
    }
  }
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
function saveJsonDB(state) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error("Failed to write JSON DB file", err);
  }
}
function uuidOrUndefined(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : void 0;
}
function mapKycSubmissionToRow(submission) {
  return {
    ...uuidOrUndefined(submission.id) ? { id: submission.id } : {},
    user_id: submission.userId,
    submission_role: submission.userType || submission.submissionRole,
    legal_name: submission.legalName,
    dob: submission.dob,
    id_type: submission.idType,
    id_reference: submission.idReference || null,
    id_front_document_path: submission.idFrontUrl,
    id_back_document_path: submission.idBackUrl || null,
    selfie_document_path: submission.selfieUrl,
    status: submission.status || "PENDING",
    submitted_at: submission.submittedAt,
    reviewed_at: submission.decidedAt || null,
    rejection_reason: submission.rejectionReason || null,
    reviewed_by_admin_id: uuidOrUndefined(submission.decidedByAdminId || submission.decidedBy) || null,
    profile_bio: submission.bio || null,
    profile_photos: submission.photos || null,
    city: submission.city || null
  };
}
function mapKycSubmissionFromRow(row) {
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
function mapCompanionProfileToRow(profile) {
  return {
    ...uuidOrUndefined(profile.id) ? { id: profile.id } : {},
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
function mapCompanionProfileFromRow(row) {
  return {
    ...row,
    userId: row.user_id,
    isLive: row.is_live,
    totalBookings: row.total_bookings,
    isInitialListing: row.is_initial_listing,
    isPaused: row.is_paused
  };
}
function mapBookingToRow(booking) {
  return {
    ...uuidOrUndefined(booking.id) ? { id: booking.id } : {},
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
    status: booking.status || "PENDING",
    payment_order_id: booking.paymentOrderId || null,
    payment_id: booking.paymentId || null,
    payment_status: booking.paymentStatus || "PENDING",
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
    settlement_status: booking.settlementStatus || "LOCKED",
    settlement_unlock_at: booking.settlementUnlockUtc || booking.settlementUnlockAt || null,
    start_otp_attempts: booking.startOtpAttempts || 0,
    completion_otp_attempts: booking.endOtpAttempts || 0,
    start_otp_verified: booking.startOtpVerified || false,
    completion_otp_verified: booking.endOtpVerified || false,
    payout_id: uuidOrUndefined(booking.payoutId) || null
  };
}
function mapBookingFromRow(row) {
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
    companionEtaText: row.companion_eta_text || "Calculating...",
    companionCurrentArea: row.companion_current_area || "Preparing to leave...",
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
    payoutId: row.payout_id
  };
}
var JsonDatabaseAdapter = class {
  getDB() {
    return loadJsonDB();
  }
  saveDB(state) {
    saveJsonDB(state);
  }
  async getUser(id) {
    const db2 = this.getDB();
    return db2.users[id] || null;
  }
  async getUserByPhone(phone) {
    const db2 = this.getDB();
    return Object.values(db2.users).find((u) => u.phone === phone) || null;
  }
  async createUser(user) {
    const db2 = this.getDB();
    db2.users[user.id] = user;
    this.saveDB(db2);
    return user;
  }
  async updateUser(id, updates) {
    const db2 = this.getDB();
    if (!db2.users[id]) return null;
    db2.users[id] = { ...db2.users[id], ...updates };
    this.saveDB(db2);
    return db2.users[id];
  }
  async deleteUser(userId) {
    const db2 = this.getDB();
    delete db2.users[userId];
    if (db2.kycSubmissions) {
      for (const k of Object.keys(db2.kycSubmissions)) {
        if (db2.kycSubmissions[k]?.userId === userId) delete db2.kycSubmissions[k];
      }
    }
    if (db2.companionProfiles) delete db2.companionProfiles[userId];
    if (db2.companionMemberships) {
      for (const k of Object.keys(db2.companionMemberships)) {
        if (db2.companionMemberships[k]?.userId === userId) delete db2.companionMemberships[k];
      }
    }
    if (db2.bankVerifications) delete db2.bankVerifications[userId];
    if (db2.companionWallets) delete db2.companionWallets[userId];
    if (db2.userLocations) delete db2.userLocations[userId];
    if (db2.userPresence) delete db2.userPresence[userId];
    this.saveDB(db2);
  }
  async listUsers(filters) {
    const db2 = this.getDB();
    return Object.values(db2.users);
  }
  async createKycSubmission(submission) {
    const db2 = this.getDB();
    db2.kycSubmissions[submission.id] = submission;
    this.saveDB(db2);
    return submission;
  }
  async submitKycSubmission(submission) {
    const db2 = this.getDB();
    db2.kycSubmissions[submission.id] = submission;
    this.saveDB(db2);
    return submission;
  }
  async getKycSubmission(id) {
    const db2 = this.getDB();
    return db2.kycSubmissions[id] || null;
  }
  async getUserKycSubmission(userId, submissionRole) {
    const db2 = this.getDB();
    return Object.values(db2.kycSubmissions).find(
      (submission) => submission.userId === userId && (submission.userType || submission.submissionRole) === submissionRole
    ) || null;
  }
  async listKycSubmissions(filters) {
    const db2 = this.getDB();
    return Object.values(db2.kycSubmissions);
  }
  async updateKycSubmission(id, updates) {
    const db2 = this.getDB();
    if (!db2.kycSubmissions[id]) return null;
    db2.kycSubmissions[id] = { ...db2.kycSubmissions[id], ...updates };
    this.saveDB(db2);
    return db2.kycSubmissions[id];
  }
  async reviewKycSubmission(id, decision, rejectionReason, adminUserId) {
    const db2 = this.getDB();
    const submission = db2.kycSubmissions[id];
    if (!submission) return null;
    submission.status = decision;
    submission.rejectionReason = rejectionReason;
    submission.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
    submission.decidedByAdminId = adminUserId;
    const user = db2.users[submission.userId];
    if (user) {
      user.kycStatus = decision;
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedByAdminId = adminUserId;
      user.kycRejectionReason = rejectionReason;
    }
    db2.auditLogs.unshift({
      id: `log_${Date.now()}`,
      adminId: adminUserId,
      action: `KYC_${decision}`,
      targetId: submission.userId,
      details: `KYC for ${submission.legalName} (${submission.userType}) was ${decision}.`,
      timestamp: submission.decidedAt
    });
    this.saveDB(db2);
    return submission;
  }
  async createKycDocumentSignedUrls(id) {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    return {
      idFrontUrl: submission.idFrontUrl,
      idBackUrl: submission.idBackUrl || null,
      selfieUrl: submission.selfieUrl
    };
  }
  async uploadKycDocument(_bucket, _path, _bytes, _contentType) {
    throw new Error("Private KYC document uploads require configured Supabase Storage.");
  }
  async deleteKycDocuments(_bucket, _paths) {
    throw new Error("Private KYC document cleanup requires configured Supabase Storage.");
  }
  async getCompanionProfile(userId) {
    const db2 = this.getDB();
    return Object.values(db2.companionProfiles).find((p) => p.userId === userId) || null;
  }
  async createCompanionProfile(profile) {
    const db2 = this.getDB();
    db2.companionProfiles[profile.id] = profile;
    this.saveDB(db2);
    return profile;
  }
  async upsertCompanionProfile(profile) {
    const db2 = this.getDB();
    db2.companionProfiles[profile.userId] = {
      ...db2.companionProfiles[profile.userId] || {},
      ...profile
    };
    this.saveDB(db2);
    return db2.companionProfiles[profile.userId];
  }
  async updateCompanionProfile(userId, updates) {
    const db2 = this.getDB();
    const key = Object.keys(db2.companionProfiles).find((id) => db2.companionProfiles[id]?.userId === userId);
    if (!key) return null;
    const profile = db2.companionProfiles[key];
    db2.companionProfiles[key] = { ...profile, ...updates };
    this.saveDB(db2);
    return db2.companionProfiles[key];
  }
  async listCompanionProfiles(filters) {
    const db2 = this.getDB();
    return Object.values(db2.companionProfiles);
  }
  async createMembership(membership) {
    const db2 = this.getDB();
    db2.companionMemberships[membership.id] = membership;
    this.saveDB(db2);
    return membership;
  }
  async getActiveMembership(userId) {
    const db2 = this.getDB();
    const now = /* @__PURE__ */ new Date();
    return Object.values(db2.companionMemberships).find(
      (m) => m.userId === userId && m.paymentStatus === "PAID" && new Date(m.expiryDate) > now
    ) || null;
  }
  async getMembershipByPaymentOrder(orderId) {
    const membership = Object.values(this.getDB().companionMemberships).find((item) => item.paymentOrderId === orderId);
    return membership || null;
  }
  async listMemberships(filters) {
    const db2 = this.getDB();
    return Object.values(db2.companionMemberships);
  }
  async updateMembershipOrder(id, orderId) {
    const db2 = this.getDB();
    const membership = Object.values(db2.companionMemberships).find((item) => item.id === id);
    if (!membership) throw new Error("Membership not found.");
    membership.paymentOrderId = orderId;
    this.saveDB(db2);
    return membership;
  }
  async createBankVerification(verification) {
    const db2 = this.getDB();
    const bankVerifications = db2.bankVerifications ?? {};
    const existing = Object.keys(bankVerifications).find((key) => {
      const v = bankVerifications[key];
      return v && v.userId === verification.userId;
    });
    db2.bankVerifications = bankVerifications;
    db2.bankVerifications[verification.id] = verification;
    this.saveDB(db2);
    return verification;
  }
  async getBankVerification(userId) {
    const db2 = this.getDB();
    if (!db2.bankVerifications) return null;
    return Object.values(db2.bankVerifications).find((v) => v.userId === userId) || null;
  }
  async updateBankVerification(userId, updates) {
    const db2 = this.getDB();
    if (!db2.bankVerifications) return null;
    const key = Object.keys(db2.bankVerifications).find((k) => db2.bankVerifications[k].userId === userId);
    if (!key) return null;
    db2.bankVerifications[key] = { ...db2.bankVerifications[key], ...updates };
    this.saveDB(db2);
    return db2.bankVerifications[key];
  }
  async createBooking(booking) {
    const db2 = this.getDB();
    db2.bookings[booking.id] = booking;
    this.saveDB(db2);
    return booking;
  }
  async reserveBookingPayment(booking) {
    return this.createBooking(booking);
  }
  async getBooking(id) {
    const db2 = this.getDB();
    return db2.bookings[id] || null;
  }
  async getBookingByCode(code) {
    const db2 = this.getDB();
    return Object.values(db2.bookings).find((b) => b.bookingCode === code) || null;
  }
  async getBookingByPaymentOrder(orderId) {
    const booking = Object.values(this.getDB().bookings).find((item) => item.paymentOrderId === orderId);
    return booking || null;
  }
  async listBookings(filters) {
    const db2 = this.getDB();
    return Object.values(db2.bookings);
  }
  async updateBooking(id, updates) {
    const db2 = this.getDB();
    if (!db2.bookings[id]) return null;
    db2.bookings[id] = { ...db2.bookings[id], ...updates };
    this.saveDB(db2);
    return db2.bookings[id];
  }
  async markBookingCompanionArrived(_bookingId, _companionId) {
    throw new Error("Atomic booking arrival requires Supabase.");
  }
  async verifyBookingOtp(_bookingId, _companionId, _otpType, _otpHash, _delayMinutes = 0) {
    throw new Error("Atomic booking OTP verification requires Supabase.");
  }
  async finalizeRazorpayPayment(orderId, paymentId, _amountPaise, startOtpHash, completionOtpHash, startOtpEncrypted, completionOtpEncrypted) {
    const db2 = this.getDB();
    const booking = Object.values(db2.bookings || {}).find((b) => b.paymentOrderId === orderId || b.id === orderId);
    if (booking) {
      booking.status = "CONFIRMED";
      booking.paymentStatus = "PAID";
      booking.paymentId = paymentId;
      booking.startOtpHmac = startOtpHash;
      booking.endOtpHmac = completionOtpHash;
      booking.startOtpEncrypted = startOtpEncrypted;
      booking.completionOtpEncrypted = completionOtpEncrypted;
      booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveDB(db2);
      return { type: "BOOKING", duplicate: false, record: booking };
    }
    const membership = Object.values(db2.memberships || {}).find((m) => m.paymentOrderId === orderId);
    if (membership) {
      membership.paymentStatus = "PAID";
      membership.paymentId = paymentId;
      membership.paidAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveDB(db2);
      return { type: "MEMBERSHIP", duplicate: false, record: membership };
    }
    throw new Error("Atomic payment finalization requires the Supabase database.");
  }
  async createWalletEntry(entry) {
    const db2 = this.getDB();
    if (!db2.companionWallets) db2.companionWallets = {};
    if (!db2.companionWallets[entry.userId]) {
      db2.companionWallets[entry.userId] = { entries: [] };
    }
    db2.companionWallets[entry.userId].entries.push(entry);
    this.saveDB(db2);
    return entry;
  }
  async getWalletBalance(userId) {
    const db2 = this.getDB();
    if (!db2.companionWallets || !db2.companionWallets[userId]) {
      return { available: 0, locked: 0, total: 0 };
    }
    const entries = db2.companionWallets[userId].entries || [];
    let available = 0;
    let locked = 0;
    for (const entry of entries) {
      if (entry.balanceStatus === "AVAILABLE") {
        available += entry.netAmountPaise || 0;
      } else if (entry.balanceStatus === "LOCKED") {
        locked += entry.netAmountPaise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }
  async listWalletEntries(userId) {
    const db2 = this.getDB();
    if (!db2.companionWallets || !db2.companionWallets[userId]) {
      return [];
    }
    return db2.companionWallets[userId].entries || [];
  }
  async createPayout(payout) {
    const db2 = this.getDB();
    db2.payouts[payout.id] = payout;
    this.saveDB(db2);
    return payout;
  }
  async listPayouts(filters) {
    const db2 = this.getDB();
    return Object.values(db2.payouts);
  }
  async updatePayout(id, updates) {
    const db2 = this.getDB();
    if (!db2.payouts[id]) return null;
    db2.payouts[id] = { ...db2.payouts[id], ...updates };
    this.saveDB(db2);
    return db2.payouts[id];
  }
  async createConversation(conversation) {
    const db2 = this.getDB();
    if (!db2.chatMessages) db2.chatMessages = {};
    const key = `${conversation.participantA}_${conversation.participantB}_${conversation.bookingId || "no-booking"}`;
    db2.chatMessages[key] = [];
    this.saveDB(db2);
    return { ...conversation, id: key };
  }
  async getConversation(id) {
    const db2 = this.getDB();
    if (!db2.chatMessages || !db2.chatMessages[id]) return null;
    return { id, messages: db2.chatMessages[id] };
  }
  async listConversations(userId) {
    const db2 = this.getDB();
    if (!db2.chatMessages) return [];
    return Object.keys(db2.chatMessages).map((key) => ({
      id: key,
      messages: db2.chatMessages[key]
    }));
  }
  async createMessage(message) {
    const db2 = this.getDB();
    if (!db2.chatMessages) db2.chatMessages = {};
    if (!db2.chatMessages[message.conversationId]) {
      db2.chatMessages[message.conversationId] = [];
    }
    db2.chatMessages[message.conversationId].push(message);
    this.saveDB(db2);
    return message;
  }
  async listMessages(conversationId, after) {
    const db2 = this.getDB();
    if (!db2.chatMessages || !db2.chatMessages[conversationId]) return [];
    return after ? db2.chatMessages[conversationId].filter((message) => message.timestamp > after || message.createdAt > after) : db2.chatMessages[conversationId];
  }
  async createSupportConversation(conversation) {
    const db2 = this.getDB();
    if (!db2.supportConversations) db2.supportConversations = {};
    db2.supportConversations[conversation.id] = conversation;
    this.saveDB(db2);
    return conversation;
  }
  async getSupportConversation(id) {
    const db2 = this.getDB();
    if (!db2.supportConversations) return null;
    return db2.supportConversations[id] || null;
  }
  async listSupportConversations(filters) {
    const db2 = this.getDB();
    if (!db2.supportConversations) return [];
    return Object.values(db2.supportConversations);
  }
  async createSupportMessage(message) {
    const db2 = this.getDB();
    if (!db2.supportMessages) db2.supportMessages = {};
    if (!db2.supportMessages[message.conversationId]) {
      db2.supportMessages[message.conversationId] = [];
    }
    db2.supportMessages[message.conversationId].push(message);
    this.saveDB(db2);
    return message;
  }
  async listSupportMessages(conversationId, after) {
    const db2 = this.getDB();
    if (!db2.supportMessages || !db2.supportMessages[conversationId]) return [];
    return after ? db2.supportMessages[conversationId].filter((message) => {
      const createdAt = message.createdAt || message.created_at;
      const id = message.id || "";
      return createdAt > after.createdAt || createdAt === after.createdAt && id > after.id;
    }) : db2.supportMessages[conversationId];
  }
  async updateSupportConversation(id, updates) {
    const conversation = await this.getSupportConversation(id);
    if (!conversation) return null;
    const updated = { ...conversation, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.getDB().supportConversations[id] = updated;
    this.saveDB(this.getDB());
    return updated;
  }
  async getAdminUser(email) {
    const db2 = this.getDB();
    return Object.values(db2.adminUsers).find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }
  async getAdminUserById(id) {
    const db2 = this.getDB();
    return db2.adminUsers[id] || null;
  }
  async updateAdminPasswordHash(id, passwordHash) {
    const db2 = this.getDB();
    const admin = db2.adminUsers[id];
    if (!admin) throw new Error("Administrator account no longer exists.");
    db2.adminUsers[id] = { ...admin, passwordHash };
    this.saveDB(db2);
  }
  async createAdminUser(admin) {
    const db2 = this.getDB();
    db2.adminUsers[admin.id] = admin;
    this.saveDB(db2);
    return admin;
  }
  async listAdminUsers() {
    const db2 = this.getDB();
    return Object.values(db2.adminUsers);
  }
  async updateAdminUserRole(id, role) {
    const db2 = this.getDB();
    const staff = db2.adminUsers[id];
    if (!staff) throw new Error("Admin user not found");
    staff.role = role;
    this.saveDB(db2);
    return staff;
  }
  async deleteAdminUser(id) {
    const db2 = this.getDB();
    delete db2.adminUsers[id];
    this.saveDB(db2);
  }
  async createAuditLog(log) {
    const db2 = this.getDB();
    db2.auditLogs.push(log);
    this.saveDB(db2);
  }
  async listAuditLogs(filters) {
    const db2 = this.getDB();
    return db2.auditLogs || [];
  }
  async createIncidentReport(report) {
    const db2 = this.getDB();
    db2.incidentReports ||= {};
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || "PENDING_REVIEW",
      createdAt: report.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    db2.incidentReports[item.id] = item;
    this.saveDB(db2);
    return item;
  }
  async listIncidentReports(filters) {
    const db2 = this.getDB();
    const list = Object.values(db2.incidentReports || {});
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async updateIncidentReport(id, updates) {
    const db2 = this.getDB();
    db2.incidentReports ||= {};
    if (!db2.incidentReports[id]) return null;
    db2.incidentReports[id] = { ...db2.incidentReports[id], ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.saveDB(db2);
    return db2.incidentReports[id];
  }
  async createNotification(notification) {
    const db2 = this.getDB();
    db2.notifications ||= {};
    const item = {
      ...notification,
      id: notification.id || crypto.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pushDeliveryStatus: "PENDING",
      pushAttempts: 0,
      pushRetryAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    (db2.notifications[notification.userId] ||= []).unshift(item);
    this.saveDB(db2);
    return item;
  }
  async listNotifications(userId) {
    return this.getDB().notifications?.[userId] || [];
  }
  async markNotificationRead(id, userId) {
    const db2 = this.getDB();
    const notifications = userId ? db2.notifications?.[userId] || [] : Object.values(db2.notifications || {}).flat();
    const item = notifications.find((entry) => entry.id === id);
    if (!item) throw new Error("Notification was not found.");
    item.readAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveDB(db2);
  }
  async claimNotificationPushes(notificationId, limit = 100) {
    const db2 = this.getDB();
    const now = Date.now();
    const notifications = Object.values(db2.notifications || {}).flat();
    const candidates = notifications.filter(
      (notification) => (!notificationId || notification.id === notificationId) && notification.pushDeliveryStatus !== "SENT" && notification.pushDeliveryStatus !== "FAILED" && (notification.pushAttempts || 0) < 5 && (!notification.pushRetryAt || Date.parse(notification.pushRetryAt) <= now) && (notification.pushDeliveryStatus !== "PROCESSING" || !notification.pushClaimedAt || Date.parse(notification.pushClaimedAt) <= now - 10 * 60 * 1e3)
    ).slice(0, Math.min(500, Math.max(1, limit)));
    for (const notification of candidates) {
      notification.pushDeliveryStatus = "PROCESSING";
      notification.pushAttempts = (notification.pushAttempts || 0) + 1;
      notification.pushClaimedAt = new Date(now).toISOString();
    }
    if (candidates.length) this.saveDB(db2);
    return candidates.map((notification) => ({
      notification,
      deviceTokens: Object.entries(db2.firebaseDeviceTokens || {}).filter(([, token]) => token.userId === notification.userId).map(([token]) => token)
    }));
  }
  async finishNotificationPush(id, success, errorMessage) {
    const db2 = this.getDB();
    const notifications = Object.values(db2.notifications || {}).flat();
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification || notification.pushDeliveryStatus !== "PROCESSING") {
      throw new Error("Notification push claim was not found.");
    }
    notification.pushDeliveryStatus = success ? "SENT" : notification.pushAttempts >= 5 ? "FAILED" : "PENDING";
    notification.pushClaimedAt = null;
    notification.pushRetryAt = new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.max(0, notification.pushAttempts - 1)) * 1e3).toISOString();
    notification.pushLastError = success ? null : (errorMessage || "Push delivery failed.").slice(0, 1e3);
    if (success) notification.pushSentAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveDB(db2);
  }
  async registerDeviceToken(userId, token, platform) {
    const db2 = this.getDB();
    db2.firebaseDeviceTokens ||= {};
    db2.firebaseDeviceTokens[token] = { userId, platform };
    this.saveDB(db2);
  }
  async listDeviceTokens(userId) {
    return Object.entries(this.getDB().firebaseDeviceTokens || {}).filter(([, entry]) => entry.userId === userId).map(([token]) => token);
  }
  async deleteDeviceToken(token, userId) {
    const db2 = this.getDB();
    if (db2.firebaseDeviceTokens?.[token] && (!userId || db2.firebaseDeviceTokens[token].userId === userId)) {
      delete db2.firebaseDeviceTokens[token];
    }
    this.saveDB(db2);
  }
  async upsertUserLocation(location) {
    const db2 = this.getDB();
    db2.userLocations ||= {};
    db2.userLocations[location.userId] = location;
    this.saveDB(db2);
    return location;
  }
  async getUserLocation(userId) {
    return this.getDB().userLocations?.[userId] || null;
  }
  async deleteUserLocation(userId) {
    const db2 = this.getDB();
    if (db2.userLocations) delete db2.userLocations[userId];
    this.saveDB(db2);
  }
  async upsertUserPresence(presence) {
    const db2 = this.getDB();
    db2.userPresence ||= {};
    db2.userPresence[presence.userId] = presence;
    this.saveDB(db2);
    return presence;
  }
  async getUserPresence(userId) {
    return this.getDB().userPresence?.[userId] || null;
  }
  async setBookingLocationSharing(bookingId, userId, enabled) {
    const locations = this.getDB().userLocations || (this.getDB().userLocations = {});
    locations[`${bookingId}:${userId}`] = { bookingId, userId, sharingEnabled: enabled, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.saveDB(this.getDB());
  }
  async getBookingLocationSharing(bookingId, userId) {
    return this.getDB().userLocations?.[`${bookingId}:${userId}`]?.sharingEnabled === true;
  }
  async consumeRateLimit(bucketKey, limit, windowSeconds) {
    const now = Date.now();
    let bucket = localRateLimitBuckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowSeconds * 1e3) {
      bucket = { startedAt: now, count: 0 };
      localRateLimitBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowSeconds * 1e3 - now) / 1e3)) };
  }
  async isSessionRevoked(tokenId) {
    return localRevokedSessions.has(tokenId);
  }
  async revokeSession(tokenId) {
    localRevokedSessions.add(tokenId);
  }
  async claimPaymentWebhookEvent(eventId, eventType, payload) {
    const previous = localWebhookEvents.get(eventId);
    if (previous?.processed) return { claimed: false, processed: true };
    localWebhookEvents.set(eventId, { eventType, payload, processed: false });
    return { claimed: true, processed: false };
  }
  async completePaymentWebhookEvent(eventId, error) {
    const event = localWebhookEvents.get(eventId);
    if (!event) throw new Error("Payment webhook event claim was not found.");
    event.processed = !error;
  }
  async markRazorpayOrderFailed(orderId, paymentId) {
    const db2 = this.getDB();
    let updated = false;
    for (const b of Object.values(db2.bookings)) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === "PENDING" || !b.paymentStatus)) {
        b.paymentStatus = "FAILED";
        b.status = "CANCELLED";
        if (paymentId) b.paymentId = paymentId;
        updated = true;
      }
    }
    for (const m of Object.values(db2.companionMemberships)) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === "PENDING" || !m.paymentStatus)) {
        m.paymentStatus = "FAILED";
        if (paymentId) m.paymentId = paymentId;
        updated = true;
      }
    }
    return updated;
  }
  async markRazorpayOrderCancelled(orderId) {
    const db2 = this.getDB();
    let updated = false;
    for (const b of Object.values(db2.bookings)) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === "PENDING" || !b.paymentStatus)) {
        b.paymentStatus = "CANCELLED";
        b.status = "CANCELLED";
        updated = true;
      }
    }
    for (const m of Object.values(db2.companionMemberships)) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === "PENDING" || !m.paymentStatus)) {
        m.paymentStatus = "CANCELLED";
        updated = true;
      }
    }
    return updated;
  }
  async reservePaymentRefund() {
    throw new Error("Payment refunds require Supabase.");
  }
  async listPaymentRefunds() {
    throw new Error("Payment refunds require Supabase.");
  }
  async updatePaymentRefund() {
    throw new Error("Payment refunds require Supabase.");
  }
  async processBookingPayout() {
    throw new Error("Payout processing requires Supabase.");
  }
  async claimScheduledJobRun() {
    throw new Error("Scheduled jobs require Supabase.");
  }
  async finishScheduledJobRun() {
    throw new Error("Scheduled jobs require Supabase.");
  }
  async runScheduledMaintenance() {
    throw new Error("Scheduled maintenance requires Supabase.");
  }
  async reserveAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async completeAdminSensitiveMfaDelivery() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async verifyAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async consumeAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async reserveOtp(phone, otpHash) {
    const challenges = loadJsonOtpChallenges();
    const now = Date.now();
    const current = challenges[phone];
    if (current && now - current.lastSentAt < 6e4) {
      return {
        allowed: false,
        reason: "cooldown",
        waitSeconds: Math.ceil((6e4 - (now - current.lastSentAt)) / 1e3)
      };
    }
    const inWindow = Boolean(current && now - current.windowStartTime < 6e4);
    if (inWindow && current.windowCount >= 3) {
      return {
        allowed: false,
        reason: "rate_limit",
        waitSeconds: Math.ceil((6e4 - (now - current.windowStartTime)) / 1e3)
      };
    }
    const windowStartTime = current && inWindow ? current.windowStartTime : now;
    const windowCount = current && inWindow ? current.windowCount + 1 : 1;
    challenges[phone] = {
      otpHash,
      expiresAt: now + 5 * 6e4,
      attempts: 0,
      lastSentAt: now,
      windowStartTime,
      windowCount,
      status: "PENDING"
    };
    saveJsonOtpChallenges(challenges);
    return { allowed: true };
  }
  async setOtpDeliveryResult(phone, sent, requestId) {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record || record.status !== "PENDING") {
      throw new Error("OTP challenge was not pending delivery.");
    }
    record.status = sent ? "SENT" : "FAILED";
    if (requestId) record.requestId = requestId;
    saveJsonOtpChallenges(challenges);
  }
  async verifyOtp(phone, otpHash) {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record) return "not_found";
    if (record.status === "LOCKED") return "locked";
    if (record.status !== "SENT") return "not_found";
    const now = Date.now();
    if (now >= record.expiresAt) {
      record.status = "EXPIRED";
      saveJsonOtpChallenges(challenges);
      return "expired";
    }
    if (record.attempts >= 4) {
      record.status = "LOCKED";
      saveJsonOtpChallenges(challenges);
      return "locked";
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = "LOCKED";
      saveJsonOtpChallenges(challenges);
      return record.status === "LOCKED" ? "locked" : "invalid";
    }
    record.status = "CONSUMED";
    saveJsonOtpChallenges(challenges);
    return "verified";
  }
  async reserveAdminMfa(email, otpHash) {
    const challenges = loadJsonAdminMfaChallenges();
    const now = Date.now();
    const current = challenges[email];
    if (current && now - current.lastSentAt < 6e4) {
      return { allowed: false, reason: "cooldown", waitSeconds: Math.ceil((6e4 - (now - current.lastSentAt)) / 1e3) };
    }
    const inWindow = Boolean(current && now - current.windowStartTime < 6e4);
    if (inWindow && current.windowCount >= 3) {
      return { allowed: false, reason: "rate_limit", waitSeconds: Math.ceil((6e4 - (now - current.windowStartTime)) / 1e3) };
    }
    challenges[email] = {
      otpHash,
      expiresAt: now + 5 * 6e4,
      attempts: 0,
      lastSentAt: now,
      windowStartTime: inWindow ? current.windowStartTime : now,
      windowCount: inWindow ? current.windowCount + 1 : 1,
      status: "PENDING"
    };
    saveJsonAdminMfaChallenges(challenges);
    return { allowed: true };
  }
  async setAdminMfaDeliveryResult(email, sent, requestId) {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record || record.status !== "PENDING") throw new Error("Administrator MFA challenge was not pending delivery.");
    record.status = sent ? "SENT" : "FAILED";
    if (requestId) record.requestId = requestId;
    saveJsonAdminMfaChallenges(challenges);
  }
  async verifyAdminMfa(email, otpHash) {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record) return "not_found";
    if (record.status === "LOCKED") return "locked";
    if (record.status !== "SENT") return "not_found";
    if (Date.now() >= record.expiresAt) {
      record.status = "EXPIRED";
      saveJsonAdminMfaChallenges(challenges);
      return "expired";
    }
    if (record.attempts >= 4) {
      record.status = "LOCKED";
      saveJsonAdminMfaChallenges(challenges);
      return "locked";
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = "LOCKED";
      saveJsonAdminMfaChallenges(challenges);
      return record.status === "LOCKED" ? "locked" : "invalid";
    }
    record.status = "CONSUMED";
    saveJsonAdminMfaChallenges(challenges);
    return "verified";
  }
};
var SupabaseDatabaseAdapter = class {
  async getUser(id) {
    const { data, error } = await db.users().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.mapUser(data) : null;
  }
  async getUserByPhone(phone) {
    const { data, error } = await db.users().select("*").eq("phone", phone).maybeSingle();
    if (error) throw error;
    return data ? this.mapUser(data) : null;
  }
  async createUser(user) {
    const { data, error } = await db.users().insert({
      id: user.id,
      phone: user.phone,
      password_hash: user.passwordHash,
      legal_name: user.legalName || null,
      email: user.email || null,
      role: user.role,
      active_role: user.activeRole,
      kyc_status: user.kycStatus || "NOT_SUBMITTED",
      dob: user.dob || null,
      age: user.age || null,
      bio: user.bio || null,
      photos: user.photos || null,
      city: user.city || null,
      state: user.state || null,
      address: user.address || null,
      created_at: user.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) throw error;
    return this.mapUser(data);
  }
  mapUser(user) {
    if (!user) return null;
    let fallbackProfileName;
    let fallbackPhotos;
    let fallbackBio;
    let fallbackProfilePhoto;
    let fallbackSuspended;
    let fallbackSuspendedReason;
    let fallbackSuspendedAt;
    let fallbackWarningCount;
    let fallbackLastWarningReason;
    let fallbackLastWarningAt;
    if (typeof user.address === "string" && user.address.startsWith("__META__:")) {
      try {
        const meta = JSON.parse(user.address.slice(9));
        if (meta?.profileName) fallbackProfileName = meta.profileName;
        if (Array.isArray(meta?.photos) && meta.photos.length > 0) fallbackPhotos = meta.photos;
        if (typeof meta?.bio === "string") fallbackBio = meta.bio;
        if (typeof meta?.profilePhoto === "string" && meta.profilePhoto) fallbackProfilePhoto = meta.profilePhoto;
        if (meta?.isSuspended !== void 0) fallbackSuspended = meta.isSuspended;
        if (meta?.suspendedReason) fallbackSuspendedReason = meta.suspendedReason;
        if (meta?.suspendedAt) fallbackSuspendedAt = meta.suspendedAt;
        if (meta?.warningCount !== void 0) fallbackWarningCount = meta.warningCount;
        if (meta?.lastWarningReason) fallbackLastWarningReason = meta.lastWarningReason;
        if (meta?.lastWarningAt) fallbackLastWarningAt = meta.lastWarningAt;
      } catch {
      }
    }
    const resolvedProfileName = user.profile_name || user.profileName || fallbackProfileName || user.legal_name || "User";
    const resolvedPhotos = Array.isArray(user.photos) && user.photos.length > 0 ? user.photos : fallbackPhotos || [];
    const resolvedProfilePhoto = user.profile_photo || user.profilePhoto || fallbackProfilePhoto || resolvedPhotos[0] || null;
    const resolvedBio = user.bio !== void 0 && user.bio !== null ? user.bio : fallbackBio || "";
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
      address: typeof user.address === "string" && user.address.startsWith("__META__:") ? "" : user.address,
      isSuspended: user.is_suspended !== void 0 ? !!user.is_suspended : user.isSuspended !== void 0 ? !!user.isSuspended : !!fallbackSuspended,
      suspendedReason: user.suspended_reason || user.suspendedReason || fallbackSuspendedReason,
      suspendedAt: user.suspended_at || user.suspendedAt || fallbackSuspendedAt,
      warningCount: typeof user.warning_count === "number" ? user.warning_count : typeof user.warningCount === "number" ? user.warningCount : fallbackWarningCount || 0,
      lastWarningReason: user.last_warning_reason || user.lastWarningReason || fallbackLastWarningReason,
      lastWarningAt: user.last_warning_at || user.lastWarningAt || fallbackLastWarningAt,
      createdAt: user.created_at
    };
  }
  async updateUser(id, updates) {
    const columnNames = {
      role: "role",
      activeRole: "active_role",
      kycStatus: "kyc_status",
      legalName: "legal_name",
      profileName: "profile_name",
      kycSubmittedAt: "kyc_submitted_at",
      kycDecidedAt: "kyc_decided_at",
      kycDecidedBy: "kyc_decided_by",
      kycDecidedByAdminId: "kyc_decided_by_admin_id",
      kycRejectionReason: "kyc_rejection_reason",
      profilePhoto: "profile_photo",
      dob: "dob",
      age: "age",
      bio: "bio",
      photos: "photos",
      city: "city",
      state: "state",
      address: "address",
      isSuspended: "is_suspended",
      suspendedReason: "suspended_reason",
      suspendedAt: "suspended_at",
      warningCount: "warning_count",
      lastWarningReason: "last_warning_reason",
      lastWarningAt: "last_warning_at",
      createdAt: "created_at",
      passwordHash: "password_hash"
    };
    const rowUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (columnNames[key]) {
        rowUpdates[columnNames[key]] = value;
      }
    }
    let existingMeta = {};
    try {
      const { data: cur } = await db.users().select("address").eq("id", id).maybeSingle();
      if (cur?.address && typeof cur.address === "string" && cur.address.startsWith("__META__:")) {
        existingMeta = JSON.parse(cur.address.slice(9));
      }
    } catch {
    }
    const metaUpdates = { ...existingMeta };
    if (updates.profileName !== void 0) metaUpdates.profileName = updates.profileName;
    if (Array.isArray(updates.photos)) metaUpdates.photos = updates.photos;
    if (updates.bio !== void 0) metaUpdates.bio = updates.bio;
    if (updates.profilePhoto !== void 0) metaUpdates.profilePhoto = updates.profilePhoto;
    if (updates.isSuspended !== void 0) metaUpdates.isSuspended = updates.isSuspended;
    if (updates.suspendedReason !== void 0) metaUpdates.suspendedReason = updates.suspendedReason;
    if (updates.suspendedAt !== void 0) metaUpdates.suspendedAt = updates.suspendedAt;
    if (updates.warningCount !== void 0) metaUpdates.warningCount = updates.warningCount;
    if (updates.lastWarningReason !== void 0) metaUpdates.lastWarningReason = updates.lastWarningReason;
    if (updates.lastWarningAt !== void 0) metaUpdates.lastWarningAt = updates.lastWarningAt;
    if (Object.keys(metaUpdates).length > 0 && !updates.address) {
      rowUpdates["address"] = "__META__:" + JSON.stringify(metaUpdates);
    }
    const applyMetaOverrides = (userObj) => {
      if (metaUpdates.profileName) userObj.profileName = metaUpdates.profileName;
      if (Array.isArray(metaUpdates.photos)) userObj.photos = metaUpdates.photos;
      if (metaUpdates.bio !== void 0) userObj.bio = metaUpdates.bio;
      if (metaUpdates.profilePhoto) userObj.profilePhoto = metaUpdates.profilePhoto;
      if (metaUpdates.isSuspended !== void 0) userObj.isSuspended = metaUpdates.isSuspended;
      if (metaUpdates.suspendedReason !== void 0) userObj.suspendedReason = metaUpdates.suspendedReason;
      if (metaUpdates.warningCount !== void 0) userObj.warningCount = metaUpdates.warningCount;
      if (metaUpdates.lastWarningReason !== void 0) userObj.lastWarningReason = metaUpdates.lastWarningReason;
      return userObj;
    };
    try {
      const { data, error } = await db.users().update(rowUpdates).eq("id", id).select().maybeSingle();
      if (error) {
        if (error.message?.includes("profile_name") || error.code === "42703" || String(error.message).includes("column")) {
          const fallbackUpdates = { ...rowUpdates };
          delete fallbackUpdates.profile_name;
          delete fallbackUpdates.is_suspended;
          delete fallbackUpdates.suspended_reason;
          delete fallbackUpdates.suspended_at;
          delete fallbackUpdates.warning_count;
          delete fallbackUpdates.last_warning_reason;
          delete fallbackUpdates.last_warning_at;
          let retry = await db.users().update(fallbackUpdates).eq("id", id).select().maybeSingle();
          if (retry.error && (retry.error.code === "42703" || String(retry.error.message).includes("column"))) {
            delete fallbackUpdates.photos;
            delete fallbackUpdates.bio;
            delete fallbackUpdates.profile_photo;
            retry = await db.users().update(fallbackUpdates).eq("id", id).select().maybeSingle();
          }
          if (retry.error) {
            console.warn("Supabase updateUser fallback error:", retry.error.message);
          }
          return applyMetaOverrides(this.mapUser(retry.data || { id, ...updates }));
        }
        console.warn("Supabase updateUser error:", error.message);
      }
      return applyMetaOverrides(this.mapUser(data || { id, ...updates }));
    } catch (err) {
      console.warn("Supabase updateUser exception:", err.message);
      return applyMetaOverrides(this.mapUser({ id, ...updates }));
    }
  }
  async listUsers(filters) {
    let query = db.users().select("*");
    if (filters?.role) query = query.eq("role", filters.role);
    if (filters?.kycStatus) query = query.eq("kyc_status", filters.kycStatus);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((user) => this.mapUser(user));
  }
  async deleteUser(userId) {
    await Promise.allSettled([
      db.kycSubmissions().delete().eq("user_id", userId),
      db.companionProfiles().delete().eq("user_id", userId),
      db.companionMemberships().delete().eq("user_id", userId),
      db.bankVerifications().delete().eq("user_id", userId),
      db.userLocations().delete().eq("user_id", userId),
      db.userPresence().delete().eq("user_id", userId),
      db.firebaseDeviceTokens().delete().eq("user_id", userId),
      db.notifications().delete().eq("user_id", userId),
      db.chatMessages().delete().eq("sender_id", userId),
      db.supportMessages().delete().eq("sender_id", userId)
    ]);
    const { error } = await db.users().delete().eq("id", userId);
    if (error) {
      console.warn("Supabase deleteUser error:", error.message);
      throw error;
    }
  }
  async createKycSubmission(submission) {
    const { data, error } = await db.kycSubmissions().insert(mapKycSubmissionToRow(submission)).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }
  async submitKycSubmission(submission) {
    const { data, error } = await supabase.rpc("submit_profile_kyc", {
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
    if (!data || typeof data !== "object") {
      throw new Error("Supabase returned an invalid KYC submission response.");
    }
    return mapKycSubmissionFromRow(data);
  }
  async getKycSubmission(id) {
    const { data, error } = await db.kycSubmissions().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }
  async getUserKycSubmission(userId, submissionRole) {
    const { data, error } = await db.kycSubmissions().select("*").eq("user_id", userId).eq("submission_role", submissionRole).maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }
  async listKycSubmissions(filters) {
    let query = db.kycSubmissions().select("*");
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.submissionRole) query = query.eq("submission_role", filters.submissionRole);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapKycSubmissionFromRow);
  }
  async updateKycSubmission(id, updates) {
    const rowUpdates = {};
    const fields = {
      legalName: "legal_name",
      dob: "dob",
      idType: "id_type",
      idReference: "id_reference",
      idFrontUrl: "id_front_document_path",
      idBackUrl: "id_back_document_path",
      selfieUrl: "selfie_document_path",
      status: "status",
      decidedAt: "reviewed_at",
      decidedByAdminId: "reviewed_by_admin_id",
      rejectionReason: "rejection_reason",
      bio: "profile_bio",
      photos: "profile_photos",
      city: "city"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.kycSubmissions().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }
  async reviewKycSubmission(id, decision, rejectionReason, adminUserId) {
    const { data, error } = await supabase.rpc("review_profile_kyc", {
      p_submission_id: id,
      p_decision: decision,
      p_rejection_reason: rejectionReason,
      p_admin_user_id: adminUserId
    });
    if (error) throw error;
    if (!data?.submission) throw new Error("Supabase returned an invalid KYC review response.");
    return mapKycSubmissionFromRow(data.submission);
  }
  async createKycDocumentSignedUrls(id) {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    const bucket = submission.userType === "COMPANION" ? "companion-kyc-documents" : "client-kyc-documents";
    const documents = {
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
  async uploadKycDocument(bucket, objectPath, bytes, contentType) {
    if (bucket !== "client-kyc-documents" && bucket !== "companion-kyc-documents") {
      throw new Error("Invalid private KYC storage bucket.");
    }
    const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType,
      upsert: false
    });
    if (error) throw error;
  }
  async deleteKycDocuments(bucket, paths) {
    if (bucket !== "client-kyc-documents" && bucket !== "companion-kyc-documents") {
      throw new Error("Invalid private KYC storage bucket.");
    }
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
  async getCompanionProfile(userId) {
    const { data, error } = await db.companionProfiles().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapCompanionProfileFromRow(data) : null;
  }
  async createCompanionProfile(profile) {
    const { data, error } = await db.companionProfiles().upsert(mapCompanionProfileToRow(profile), { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }
  async upsertCompanionProfile(profile) {
    return this.createCompanionProfile(profile);
  }
  async updateCompanionProfile(userId, updates) {
    const rowUpdates = mapCompanionProfilePatchToRow(updates);
    const { data, error } = await db.companionProfiles().update(rowUpdates).eq("user_id", userId).select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }
  async listCompanionProfiles(filters) {
    let query = db.companionProfiles().select("*");
    if (filters?.isLive !== void 0) query = query.eq("is_live", filters.isLive);
    if (filters?.state) query = query.eq("state", filters.state);
    if (Number.isInteger(filters?.limit) && filters.limit > 0) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapCompanionProfileFromRow);
  }
  async createMembership(membership) {
    const { data, error } = await db.companionMemberships().insert({
      ...uuidOrUndefined(membership.id) ? { id: membership.id } : {},
      user_id: membership.userId,
      plan: membership.plan,
      amount_paise: membership.pricePaise ?? membership.amountPaise,
      currency: membership.currency || "INR",
      start_date: membership.startDate,
      expiry_date: membership.expiryDate,
      payment_order_id: membership.paymentOrderId || null,
      payment_id: membership.paymentId || null,
      payment_status: membership.paymentStatus || "PENDING",
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
      isActive: data.payment_status === "PAID" && new Date(data.expiry_date) > /* @__PURE__ */ new Date()
    };
  }
  async getActiveMembership(userId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await db.companionMemberships().select("*").eq("user_id", userId).eq("payment_status", "PAID").gt("expiry_date", now).order("expiry_date", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status,
      isActive: true
    } : null;
  }
  async getMembershipByPaymentOrder(orderId) {
    const { data, error } = await db.companionMemberships().select("*").eq("payment_order_id", orderId).maybeSingle();
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
  async listMemberships(filters) {
    let query = db.companionMemberships().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      pricePaise: row.amount_paise,
      startDate: row.start_date,
      expiryDate: row.expiry_date,
      paymentOrderId: row.payment_order_id,
      paymentId: row.payment_id,
      paymentStatus: row.payment_status || (row.payment_id ? "PAID" : "PENDING")
    }));
  }
  async updateMembershipOrder(id, orderId) {
    const { data, error } = await db.companionMemberships().update({ payment_order_id: orderId }).eq("id", id).select().single();
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
  async createBankVerification(verification) {
    const { data, error } = await db.bankVerifications().upsert({
      ...uuidOrUndefined(verification.id) ? { id: verification.id } : {},
      user_id: verification.userId,
      account_number_encrypted: verification.accountNumberEncrypted,
      account_number_last4: verification.accountNumberLast4,
      ifsc: verification.ifsc,
      bank_name: verification.bankName || null,
      account_holder_name: verification.accountHolderName,
      verification_status: verification.verificationStatus || "PENDING",
      name_at_bank: verification.nameAtBank || null,
      name_matched: verification.nameMatched ?? null,
      provider_request_id: verification.providerRequestId || null,
      verified_at: verification.verifiedAt || null
    }, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return data;
  }
  async getBankVerification(userId) {
    const { data, error } = await db.bankVerifications().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      accountNumberEncrypted: data.account_number_encrypted,
      accountNumberMasked: data.account_number_last4 ? `\u2022\u2022\u2022\u2022${data.account_number_last4}` : null,
      accountNumberLast4: data.account_number_last4,
      bankName: data.bank_name,
      accountHolderName: data.account_holder_name,
      verificationStatus: data.verification_status,
      nameAtBank: data.name_at_bank,
      nameMatched: data.name_matched,
      providerRequestId: data.provider_request_id,
      verifiedAt: data.verified_at
    } : null;
  }
  async updateBankVerification(userId, updates) {
    const rowUpdates = {};
    const fields = {
      accountNumberEncrypted: "account_number_encrypted",
      ifsc: "ifsc",
      accountHolderName: "account_holder_name",
      verificationStatus: "verification_status",
      nameAtBank: "name_at_bank",
      nameMatched: "name_matched",
      providerRequestId: "provider_request_id",
      verifiedAt: "verified_at"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.bankVerifications().update(rowUpdates).eq("user_id", userId).select().single();
    if (error) throw error;
    return data;
  }
  async createBooking(booking) {
    const { data, error } = await db.bookings().insert(mapBookingToRow(booking)).select().single();
    if (error) throw error;
    return mapBookingFromRow(data);
  }
  async reserveBookingPayment(booking) {
    try {
      const { data, error } = await supabase.rpc("reserve_booking_payment", {
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
      if (!error && data && typeof data === "object") {
        return mapBookingFromRow(data);
      }
      if (error) {
        console.warn("reserve_booking_payment RPC returned error, using direct booking table reservation:", error.message || error);
      }
    } catch (rpcErr) {
      console.warn("reserve_booking_payment RPC threw, using direct booking table reservation:", rpcErr?.message || rpcErr);
    }
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
      status: "PENDING",
      payment_status: "PENDING",
      admin_platform_fee_paise: feePaise,
      companion_gross_share_paise: amountPaise - feePaise,
      companion_net_share_paise: amountPaise - feePaise,
      settlement_status: "LOCKED"
    };
    const { data: inserted, error: insertErr } = await db.bookings().insert(bookingRow).select().single();
    if (insertErr) {
      console.error("Direct booking insert failed:", insertErr);
      throw insertErr;
    }
    return mapBookingFromRow(inserted);
  }
  async getBooking(id) {
    const { data, error } = await db.bookings().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async getBookingByCode(code) {
    const { data, error } = await db.bookings().select("*").eq("booking_code", code).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async getBookingByPaymentOrder(orderId) {
    const { data, error } = await db.bookings().select("*").eq("payment_order_id", orderId).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async listBookings(filters) {
    let query = db.bookings().select("*");
    if (filters?.participantId) {
      query = query.or(`client_id.eq.${filters.participantId},companion_id.eq.${filters.participantId}`);
    } else {
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.companionId) query = query.eq("companion_id", filters.companionId);
    }
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapBookingFromRow);
  }
  async updateBooking(id, updates) {
    const fields = {
      bookingCode: "booking_code",
      booking_code: "booking_code",
      status: "status",
      paymentOrderId: "payment_order_id",
      payment_order_id: "payment_order_id",
      paymentId: "payment_id",
      payment_id: "payment_id",
      paymentStatus: "payment_status",
      payment_status: "payment_status",
      startOtpHmac: "start_otp_hash",
      start_otp_hash: "start_otp_hash",
      endOtpHmac: "completion_otp_hash",
      completion_otp_hash: "completion_otp_hash",
      startOtpAttempts: "start_otp_attempts",
      start_otp_attempts: "start_otp_attempts",
      endOtpAttempts: "completion_otp_attempts",
      completion_otp_attempts: "completion_otp_attempts",
      startOtpVerified: "start_otp_verified",
      start_otp_verified: "start_otp_verified",
      endOtpVerified: "completion_otp_verified",
      completion_otp_verified: "completion_otp_verified",
      companionArrivedAt: "companion_arrived_at",
      companion_arrived_at: "companion_arrived_at",
      startedAt: "started_at",
      started_at: "started_at",
      meetingStartedAt: "meeting_started_at",
      meeting_started_at: "meeting_started_at",
      completedAt: "completed_at",
      completed_at: "completed_at",
      delayMinutes: "delay_minutes",
      delay_minutes: "delay_minutes",
      latePenaltyPaise: "late_penalty_paise",
      late_penalty_paise: "late_penalty_paise",
      companionNetSharePaise: "companion_net_share_paise",
      companion_net_share_paise: "companion_net_share_paise",
      clientRefundPenaltyPaise: "client_refund_penalty_paise",
      client_refund_penalty_paise: "client_refund_penalty_paise",
      settlementStatus: "settlement_status",
      settlement_status: "settlement_status",
      settlementUnlockUtc: "settlement_unlock_at",
      settlement_unlock_at: "settlement_unlock_at",
      payoutId: "payout_id",
      payout_id: "payout_id",
      companionCurrentArea: "companion_current_area",
      companion_current_area: "companion_current_area",
      companionEtaText: "companion_eta_text",
      companion_eta_text: "companion_eta_text",
      lastEtaUpdatedAt: "last_eta_updated_at",
      last_eta_updated_at: "last_eta_updated_at",
      sessionOtp: "session_otp",
      session_otp: "session_otp",
      companionAccepted: "companion_accepted",
      companion_accepted: "companion_accepted",
      rejectionReason: "rejection_reason",
      rejection_reason: "rejection_reason",
      bookingLocationName: "booking_location_name",
      booking_location_name: "booking_location_name",
      bookingLat: "booking_lat",
      booking_lat: "booking_lat",
      bookingLng: "booking_lng",
      booking_lng: "booking_lng"
    };
    const rowUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => fields[key]).map(([key, value]) => [fields[key], value])
    );
    if (Object.keys(rowUpdates).length === 0) throw new Error("No supported booking fields were provided for update.");
    const { data, error } = await db.bookings().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return mapBookingFromRow(data);
  }
  async markBookingCompanionArrived(bookingId, companionId) {
    const { data, error } = await supabase.rpc("mark_booking_companion_arrived", {
      p_booking_id: bookingId,
      p_companion_id: companionId
    });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid booking arrival response.");
    return mapBookingFromRow(data);
  }
  async verifyBookingOtp(bookingId, companionId, otpType, otpHash, delayMinutes = 0) {
    const { data, error } = await supabase.rpc("verify_booking_otp", {
      p_booking_id: bookingId,
      p_companion_id: companionId,
      p_otp_type: otpType,
      p_otp_hash: otpHash,
      p_delay_minutes: delayMinutes
    });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid booking OTP response.");
    return {
      ...data,
      booking: data.booking ? mapBookingFromRow(data.booking) : void 0
    };
  }
  async finalizeRazorpayPayment(orderId, paymentId, amountPaise, startOtpHash, completionOtpHash, startOtpEncrypted, completionOtpEncrypted) {
    try {
      const { data, error } = await supabase.rpc("finalize_razorpay_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_amount_paise: amountPaise,
        p_start_otp_hash: startOtpHash,
        p_completion_otp_hash: completionOtpHash,
        p_start_otp_encrypted: startOtpEncrypted,
        p_completion_otp_encrypted: completionOtpEncrypted
      });
      if (!error && data && typeof data === "object" && data.record) {
        return {
          type: data.type,
          duplicate: Boolean(data.duplicate),
          record: data.type === "BOOKING" ? mapBookingFromRow(data.record) : data.record
        };
      }
      if (error) {
        console.warn("finalize_razorpay_payment RPC notice, applying resilient direct table update:", error.message);
      }
    } catch (rpcErr) {
      console.warn("finalize_razorpay_payment RPC exception, applying resilient direct table update:", rpcErr?.message);
    }
    const { data: bookingRow } = await db.bookings().select("*").eq("payment_order_id", orderId).maybeSingle();
    if (bookingRow) {
      const { data: updatedBooking, error: bErr } = await db.bookings().update({
        status: "CONFIRMED",
        payment_status: "PAID",
        payment_id: paymentId,
        start_otp_hash: startOtpHash,
        completion_otp_hash: completionOtpHash,
        start_otp_encrypted: startOtpEncrypted,
        completion_otp_encrypted: completionOtpEncrypted,
        payment_expires_at: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", bookingRow.id).select().single();
      if (!bErr && updatedBooking) {
        return {
          type: "BOOKING",
          duplicate: false,
          record: mapBookingFromRow(updatedBooking)
        };
      }
    }
    const { data: memRow } = await db.memberships().select("*").eq("payment_order_id", orderId).maybeSingle();
    if (memRow) {
      const durationDays = memRow.plan === "STARTER" ? 30 : memRow.plan === "PROFESSIONAL" ? 90 : 365;
      const { data: updatedMem, error: mErr } = await db.memberships().update({
        payment_status: "PAID",
        payment_id: paymentId,
        paid_at: (/* @__PURE__ */ new Date()).toISOString(),
        start_date: (/* @__PURE__ */ new Date()).toISOString(),
        expiry_date: new Date(Date.now() + durationDays * 864e5).toISOString()
      }).eq("id", memRow.id).select().single();
      if (!mErr && updatedMem) {
        return {
          type: "MEMBERSHIP",
          duplicate: false,
          record: updatedMem
        };
      }
    }
    throw new Error("Supabase payment finalization record not found for order " + orderId);
  }
  async createWalletEntry(entry) {
    const { data, error } = await db.walletLedger().insert({
      ...uuidOrUndefined(entry.id) ? { id: entry.id } : {},
      user_id: entry.userId,
      booking_id: entry.bookingId || null,
      transaction_type: entry.transactionType,
      gross_amount_paise: entry.grossAmountPaise ?? null,
      commission_paise: entry.commissionPaise ?? null,
      penalty_paise: entry.penaltyPaise ?? null,
      net_amount_paise: entry.netAmountPaise ?? null,
      balance_locked_until: entry.balanceLockedUntil || null,
      balance_status: entry.balanceStatus || "AVAILABLE",
      description: entry.description || null,
      idempotency_key: entry.idempotencyKey || null
    }).select().single();
    if (error) throw error;
    return data;
  }
  async getWalletBalance(userId) {
    const { data, error } = await db.walletLedger().select("*").eq("user_id", userId);
    if (error) throw error;
    let available = 0;
    let locked = 0;
    for (const entry of data || []) {
      if (entry.balance_status === "AVAILABLE") {
        available += entry.net_amount_paise || 0;
      } else if (entry.balance_status === "LOCKED") {
        locked += entry.net_amount_paise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }
  async listWalletEntries(userId) {
    const { data, error } = await db.walletLedger().select("*").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((row) => ({
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
  async createPayout(payout) {
    const { data, error } = await db.payouts().insert({
      ...uuidOrUndefined(payout.id) ? { id: payout.id } : {},
      user_id: payout.userId || payout.companionId,
      booking_id: payout.bookingId || null,
      total_amount_paise: payout.totalAmountPaise ?? payout.amountPaise,
      commission_paise: payout.commissionPaise || 0,
      penalty_paise: payout.penaltyPaise || 0,
      net_amount_paise: payout.netAmountPaise ?? payout.amountPaise,
      payout_status: payout.payoutStatus || "PENDING",
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
  async listPayouts(filters) {
    let query = db.payouts().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.status) query = query.eq("payout_status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
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
  async updatePayout(id, updates) {
    const rowUpdates = {};
    const fields = {
      payoutStatus: "payout_status",
      utrReference: "utr_reference",
      adminUserId: "admin_user_id",
      processedAt: "processed_at"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.payouts().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async createConversation(conversation) {
    const { data, error } = await db.chatConversations().insert({
      ...uuidOrUndefined(conversation.id) ? { id: conversation.id } : {},
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
  async getConversation(id) {
    const { data, error } = await db.chatConversations().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      bookingId: data.booking_id,
      participantA: data.participant_a,
      participantB: data.participant_b
    } : null;
  }
  async listConversations(userId) {
    const { data, error } = await db.chatConversations().select("*").or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      bookingId: row.booking_id,
      participantA: row.participant_a,
      participantB: row.participant_b
    }));
  }
  async createMessage(message) {
    const { data, error } = await db.chatMessages().insert({
      ...uuidOrUndefined(message.id) ? { id: message.id } : {},
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      message: message.message
    }).select().single();
    if (error) throw error;
    return { ...data, conversationId: data.conversation_id, senderId: data.sender_id };
  }
  async listMessages(conversationId, after) {
    let query = db.chatMessages().select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
    if (after) query = query.gt("created_at", after);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id
    }));
  }
  async createSupportConversation(conversation) {
    const { data, error } = await db.supportConversations().insert({
      ...uuidOrUndefined(conversation.id) ? { id: conversation.id } : {},
      user_id: conversation.userId,
      status: conversation.status || "OPEN",
      subject: conversation.subject || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    };
  }
  async getSupportConversation(id) {
    const { data, error } = await db.supportConversations().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    } : null;
  }
  async listSupportConversations(filters) {
    let query = db.supportConversations().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      assignedAdminId: row.assigned_admin_user_id || row.assigned_admin_id
    }));
  }
  async createSupportMessage(message) {
    const { data, error } = await db.supportMessages().insert({
      ...uuidOrUndefined(message.id) ? { id: message.id } : {},
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
  async listSupportMessages(conversationId, after) {
    let query = db.supportMessages().select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(200);
    if (after) {
      query = query.or(`created_at.gt.${after.createdAt},and(created_at.eq.${after.createdAt},id.gt.${after.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      adminUserId: row.admin_user_id,
      isAdmin: row.is_admin
    }));
  }
  async updateSupportConversation(id, updates) {
    const row = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if ("status" in updates) row.status = updates.status;
    if ("assignedAdminId" in updates) row.assigned_admin_user_id = updates.assignedAdminId;
    const { data, error } = await db.supportConversations().update(row).eq("id", id).select().single();
    if (error) throw error;
    return { ...data, userId: data.user_id, assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id };
  }
  async getAdminUser(email) {
    const { data, error } = await db.adminUsers().select("*").eq("email", email.toLowerCase()).eq("is_active", true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }
  async getAdminUserById(id) {
    const { data, error } = await db.adminUsers().select("*").eq("id", id).eq("is_active", true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }
  async updateAdminPasswordHash(id, passwordHash) {
    const { error } = await db.adminUsers().update({ password_hash: passwordHash }).eq("id", id);
    if (error) throw error;
  }
  mapAdminUser(admin) {
    return {
      ...admin,
      passwordHash: admin.password_hash,
      name: admin.legal_name
    };
  }
  async createAdminUser(admin) {
    const { data, error } = await db.adminUsers().insert({
      ...uuidOrUndefined(admin.id) ? { id: admin.id } : {},
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
  async listAdminUsers() {
    const { data, error } = await db.adminUsers().select("*");
    if (error) throw error;
    return (data || []).map((admin) => this.mapAdminUser(admin));
  }
  async updateAdminUserRole(id, role) {
    const { data, error } = await db.adminUsers().update({ role }).eq("id", id).select().single();
    if (error) throw error;
    return this.mapAdminUser(data);
  }
  async deleteAdminUser(id) {
    const { error } = await db.adminUsers().delete().eq("id", id);
    if (error) throw error;
  }
  async createAuditLog(log) {
    const { error } = await db.auditLogs().insert({
      ...uuidOrUndefined(log.id) ? { id: log.id } : {},
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
  async listAuditLogs(filters) {
    let query = db.auditLogs().select("*");
    if (filters?.adminId) query = query.or(`admin_id.eq.${filters.adminId},admin_user_id.eq.${filters.adminId}`);
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.action) query = query.eq("action", filters.action);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }
  async createNotification(notification) {
    const { data, error } = await db.notifications().insert({
      ...uuidOrUndefined(notification.id) ? { id: notification.id } : {},
      user_id: notification.userId,
      type: notification.type || "GENERAL",
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
  async listNotifications(userId) {
    const { data, error } = await db.notifications().select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      readAt: row.read_at,
      createdAt: row.created_at
    }));
  }
  async markNotificationRead(id, userId) {
    let query = db.notifications().update({ read_at: (/* @__PURE__ */ new Date()).toISOString() }, { count: "exact" }).eq("id", id);
    if (userId) query = query.eq("user_id", userId);
    const { error, count } = await query;
    if (error) throw error;
    if (count === 0) throw new Error("Notification was not found.");
  }
  async claimNotificationPushes(notificationId, limit = 100) {
    const { data, error } = await db.rpc("claim_notification_pushes", {
      p_notification_id: notificationId || null,
      p_limit: Math.min(500, Math.max(1, Math.trunc(limit)))
    });
    if (error) throw error;
    return (data || []).map((row) => ({
      notification: row.notification,
      deviceTokens: row.device_tokens || []
    }));
  }
  async finishNotificationPush(id, success, errorMessage) {
    const { data, error } = await db.rpc("finish_notification_push", {
      p_notification_id: id,
      p_success: success,
      p_error: errorMessage || null
    });
    if (error) throw error;
    if (data !== true) throw new Error("Supabase did not complete the notification push claim.");
  }
  async registerDeviceToken(userId, token, platform) {
    const { error } = await db.firebaseDeviceTokens().upsert({
      user_id: userId,
      token,
      platform,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "token" });
    if (error) throw error;
  }
  async listDeviceTokens(userId) {
    const { data, error } = await db.firebaseDeviceTokens().select("token").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((row) => row.token);
  }
  async deleteDeviceToken(token, userId) {
    let query = db.firebaseDeviceTokens().delete().eq("token", token);
    if (userId) query = query.eq("user_id", userId);
    const { error } = await query;
    if (error) throw error;
  }
  async upsertUserLocation(location) {
    const { data, error } = await db.userLocations().upsert({
      user_id: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      booking_id: location.bookingId || null,
      sharing_enabled: location.sharingEnabled ?? false,
      updated_at: location.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select().single();
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
  async getUserLocation(userId) {
    const { data, error } = await db.userLocations().select("*").eq("user_id", userId).maybeSingle();
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
  async deleteUserLocation(userId) {
    const { error, count } = await db.userLocations().delete({ count: "exact" }).eq("user_id", userId);
    if (error) throw error;
    if (count === 0) throw new Error("User location was not found.");
  }
  async upsertUserPresence(presence) {
    const { data, error } = await db.userPresence().upsert({
      user_id: presence.userId,
      is_online: presence.online,
      last_seen_at: presence.lastSeen || (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at };
  }
  async getUserPresence(userId) {
    const { data, error } = await db.userPresence().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at } : null;
  }
  async setBookingLocationSharing(bookingId, userId, enabled) {
    const { error } = await supabase.from("booking_location_sharing").upsert({
      booking_id: bookingId,
      user_id: userId,
      sharing_enabled: enabled,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "booking_id,user_id" });
    if (error) throw error;
  }
  async getBookingLocationSharing(bookingId, userId) {
    const { data, error } = await supabase.from("booking_location_sharing").select("sharing_enabled").eq("booking_id", bookingId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.sharing_enabled === true;
  }
  async consumeRateLimit(bucketKey, limit, windowSeconds) {
    try {
      const { data, error } = await supabase.rpc("consume_api_rate_limit", {
        p_bucket_key: bucketKey,
        p_limit: limit,
        p_window_seconds: windowSeconds
      });
      if (!error && typeof data?.allowed === "boolean") {
        return data;
      }
    } catch (err) {
      console.warn("Supabase consume_api_rate_limit fallback to in-memory:", err);
    }
    const now = Date.now();
    let bucket = localRateLimitBuckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowSeconds * 1e3) {
      bucket = { startedAt: now, count: 0 };
      localRateLimitBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowSeconds * 1e3 - now) / 1e3)) };
  }
  async isSessionRevoked(tokenId) {
    try {
      const { data, error } = await supabase.rpc("is_session_revoked", { p_token_id: tokenId });
      if (!error && typeof data === "boolean") {
        return data;
      }
    } catch (err) {
      console.warn("Supabase is_session_revoked fallback to in-memory:", err);
    }
    return localRevokedSessions.has(tokenId);
  }
  async revokeSession(tokenId, principalId, principalType, expiresAt) {
    const { error } = await supabase.rpc("revoke_session", {
      p_token_id: tokenId,
      p_principal_id: principalId,
      p_principal_type: principalType,
      p_expires_at: expiresAt
    });
    if (error) throw error;
  }
  async claimPaymentWebhookEvent(eventId, eventType, payload) {
    const { data, error } = await supabase.rpc("claim_payment_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload
    });
    if (error) throw error;
    if (!data || typeof data.claimed !== "boolean" || typeof data.processed !== "boolean") {
      throw new Error("Supabase returned an invalid webhook event claim.");
    }
    return data;
  }
  async completePaymentWebhookEvent(eventId, errorMessage) {
    const { error } = await supabase.rpc("complete_payment_webhook_event", {
      p_event_id: eventId,
      p_error: errorMessage || null
    });
    if (error) throw error;
  }
  async markRazorpayOrderFailed(orderId, paymentId) {
    try {
      const { data, error } = await supabase.rpc("mark_razorpay_order_failed", {
        p_order_id: orderId,
        p_payment_id: paymentId || null
      });
      if (!error && typeof data === "boolean") return data;
    } catch (e) {
      console.warn("mark_razorpay_order_failed rpc warning:", e);
    }
    try {
      await db.bookings().update({ payment_status: "FAILED", status: "CANCELLED", ...paymentId ? { payment_id: paymentId } : {} }).eq("payment_order_id", orderId);
      await db.companionMemberships().update({ payment_status: "FAILED", ...paymentId ? { payment_id: paymentId } : {} }).eq("payment_order_id", orderId);
      return true;
    } catch (e) {
      console.warn("markRazorpayOrderFailed direct update warning:", e);
      return false;
    }
  }
  async markRazorpayOrderCancelled(orderId) {
    try {
      await db.bookings().update({ payment_status: "CANCELLED", status: "CANCELLED" }).eq("payment_order_id", orderId);
      await db.companionMemberships().update({ payment_status: "CANCELLED" }).eq("payment_order_id", orderId);
      return true;
    } catch (e) {
      console.warn("markRazorpayOrderCancelled direct update warning:", e);
      return false;
    }
  }
  async reservePaymentRefund(refund) {
    const { data, error } = await supabase.rpc("reserve_payment_refund", {
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
      throw new Error("Supabase returned an invalid refund reservation.");
    }
    return data;
  }
  async listPaymentRefunds(filters) {
    let query = db.paymentRefunds().select("*");
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.bookingId) query = query.eq("booking_id", filters.bookingId);
    if (filters?.paymentId) query = query.eq("payment_id", filters.paymentId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data || [];
  }
  async updatePaymentRefund(idempotencyKey, status, providerRefundId) {
    const { data, error } = await supabase.rpc("update_payment_refund", {
      p_idempotency_key: idempotencyKey,
      p_status: status,
      p_provider_refund_id: providerRefundId || null
    });
    if (error) throw error;
    return data;
  }
  async processBookingPayout(bookingId, adminUserId, utrReference) {
    const { data, error } = await supabase.rpc("process_booking_payout", {
      p_booking_id: bookingId,
      p_admin_user_id: adminUserId,
      p_utr_reference: utrReference
    });
    if (error) throw error;
    if (!data?.id) throw new Error("Supabase returned an invalid payout result.");
    return data;
  }
  async claimScheduledJobRun(jobName, idempotencyKey) {
    const { data, error } = await supabase.rpc("claim_scheduled_job_run", {
      p_job_name: jobName,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid scheduled-job claim.");
    return data;
  }
  async finishScheduledJobRun(jobName, idempotencyKey, errorMessage) {
    const { error } = await supabase.rpc("finish_scheduled_job_run", {
      p_job_name: jobName,
      p_idempotency_key: idempotencyKey,
      p_error: errorMessage || null
    });
    if (error) throw error;
  }
  async runScheduledMaintenance() {
    const { data, error } = await supabase.rpc("run_scheduled_maintenance");
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid scheduled-maintenance result.");
    return data;
  }
  async reserveAdminSensitiveMfa(adminUserId, action, otpHash) {
    const { data, error } = await supabase.rpc("reserve_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (typeof data?.allowed !== "boolean") throw new Error("Supabase returned an invalid sensitive MFA reservation.");
    return data;
  }
  async completeAdminSensitiveMfaDelivery(adminUserId, action, sent) {
    const { data, error } = await supabase.rpc("complete_admin_sensitive_mfa_delivery", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_sent: sent
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid sensitive MFA delivery result.");
    return data;
  }
  async verifyAdminSensitiveMfa(adminUserId, action, otpHash) {
    const { data, error } = await supabase.rpc("verify_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!["verified", "not_found", "expired", "locked", "invalid"].includes(data)) {
      throw new Error("Supabase returned an invalid sensitive MFA verification result.");
    }
    return data;
  }
  async consumeAdminSensitiveMfa(adminUserId, action) {
    const { data, error } = await supabase.rpc("consume_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid sensitive Admin MFA result.");
    return data;
  }
  async reserveOtp(phone, otpHash) {
    const { data, error } = await supabase.rpc("reserve_auth_otp", {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== "boolean") {
      throw new Error("Supabase returned an invalid OTP reservation response.");
    }
    return {
      allowed: data.allowed,
      reason: data.reason === "cooldown" || data.reason === "rate_limit" ? data.reason : void 0,
      waitSeconds: typeof data.waitSeconds === "number" ? data.waitSeconds : void 0
    };
  }
  async setOtpDeliveryResult(phone, sent, requestId) {
    const { data, error } = await supabase.rpc("complete_auth_otp_delivery", {
      p_phone: phone,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error("OTP challenge was not pending delivery.");
  }
  async verifyOtp(phone, otpHash) {
    const { data, error } = await supabase.rpc("verify_auth_otp", {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === "verified" || data === "not_found" || data === "expired" || data === "locked" || data === "invalid") {
      return data;
    }
    throw new Error("Supabase returned an invalid OTP verification response.");
  }
  async reserveAdminMfa(email, otpHash) {
    const { data, error } = await supabase.rpc("reserve_admin_mfa", {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== "boolean") {
      throw new Error("Supabase returned an invalid administrator MFA reservation response.");
    }
    return {
      allowed: data.allowed,
      reason: data.reason === "cooldown" || data.reason === "rate_limit" ? data.reason : void 0,
      waitSeconds: typeof data.waitSeconds === "number" ? data.waitSeconds : void 0
    };
  }
  async setAdminMfaDeliveryResult(email, sent, requestId) {
    const { data, error } = await supabase.rpc("complete_admin_mfa_delivery", {
      p_email: email,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error("Administrator MFA challenge was not pending delivery.");
  }
  async verifyAdminMfa(email, otpHash) {
    const { data, error } = await supabase.rpc("verify_admin_mfa", {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === "verified" || data === "not_found" || data === "expired" || data === "locked" || data === "invalid") {
      return data;
    }
    throw new Error("Supabase returned an invalid administrator MFA verification response.");
  }
  async createIncidentReport(report) {
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || "PENDING_REVIEW",
      createdAt: report.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await db.auditLogs().insert({
        action: "INCIDENT_REPORT",
        entity_type: "incident_report",
        entity_id: uuidOrUndefined(item.bookingId) || null,
        details: item
      });
    } catch (e) {
      console.warn("Supabase createIncidentReport audit log warning:", e.message);
    }
    return item;
  }
  async listIncidentReports(filters) {
    try {
      const { data, error } = await db.auditLogs().select("*").eq("action", "INCIDENT_REPORT").order("created_at", { ascending: false });
      if (error) throw error;
      const reports = (data || []).map((row) => {
        const details = row.details || {};
        return {
          id: details.id || row.id,
          ...details,
          createdAt: details.createdAt || row.created_at
        };
      });
      return reports;
    } catch (e) {
      console.warn("Supabase listIncidentReports error:", e.message);
      return [];
    }
  }
  async updateIncidentReport(id, updates) {
    try {
      const reports = await this.listIncidentReports();
      const existing = reports.find((r) => r.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await db.auditLogs().insert({
        action: "INCIDENT_REPORT_UPDATE",
        entity_type: "incident_report",
        entity_id: uuidOrUndefined(existing.bookingId) || null,
        details: updated
      });
      return updated;
    } catch (e) {
      console.warn("Supabase updateIncidentReport error:", e.message);
      return null;
    }
  }
};
var production = process.env.NODE_ENV === "production";
if (production && !isSupabaseConfigured()) {
  throw new Error("Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; JSON database fallback is disabled.");
}
var databaseAdapter = isSupabaseConfigured() ? new SupabaseDatabaseAdapter() : new JsonDatabaseAdapter();
function getDatabaseType() {
  return databaseAdapter instanceof SupabaseDatabaseAdapter ? "supabase" : "json";
}

// server/services/firebase.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
var firebaseApp = null;
var rtdb = null;
function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const databaseURL = process.env.FIREBASE_DATABASE_URL?.trim();
  if (!serviceAccountKey || !projectId || !clientEmail || !databaseURL) {
    console.warn("Firebase Admin credentials or FIREBASE_DATABASE_URL are not configured. Firebase features will be disabled.");
    return null;
  }
  try {
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, "\n")
    };
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL
    });
    rtdb = getDatabase(firebaseApp);
    console.log("Firebase Admin SDK initialized successfully");
    return firebaseApp;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}
function getRTDB() {
  if (!rtdb) {
    initializeFirebase();
  }
  if (!rtdb) throw new Error("Firebase Realtime Database is not configured.");
  return rtdb;
}
async function cleanupExpiredLocations() {
  const db2 = getRTDB();
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1e3;
  const bookingsSnapshot = await db2.ref("bookings").once("value");
  const bookings = bookingsSnapshot.val();
  let cleanedCount = 0;
  for (const [bookingId, booking] of Object.entries(bookings || {})) {
    const locations = booking?.locations;
    for (const [userId, location] of Object.entries(locations || {})) {
      if (typeof location.timestamp === "number" && location.timestamp < cutoffTime) {
        await db2.ref(`bookings/${bookingId}/locations/${userId}`).remove();
        cleanedCount++;
      }
    }
  }
  return cleanedCount;
}
function isFirebaseConfigured() {
  return !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_DATABASE_URL);
}

// server/services/fcm.ts
import { getApps, initializeApp as initializeApp2, cert as cert2 } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
var messaging = null;
function initializeFCM() {
  try {
    const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (!serviceAccountKey || !projectId || !clientEmail) {
      console.warn("Firebase credentials not configured. FCM will be disabled.");
      return null;
    }
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, "\n")
    };
    const app = getApps().find((candidate) => candidate.name === "fcm-app") || initializeApp2({
      credential: cert2(serviceAccount),
      ...process.env.FIREBASE_DATABASE_URL ? { databaseURL: process.env.FIREBASE_DATABASE_URL } : {}
    }, "fcm-app");
    messaging = getMessaging(app);
    console.log("Firebase Cloud Messaging initialized successfully");
    return messaging;
  } catch (error) {
    console.error("Failed to initialize FCM:", error);
    return null;
  }
}
function getFCM() {
  if (!messaging) {
    messaging = initializeFCM();
  }
  return messaging;
}
async function sendToMultipleDevices(tokens, notification, data) {
  const fcm = getFCM();
  if (!fcm) {
    throw new Error("Firebase Cloud Messaging is not configured.");
  }
  if (tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
  try {
    const invalidTokens = [];
    let success = 0;
    let failure = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const message = {
        tokens: batch,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data
      };
      const response = await fcm.sendEachForMulticast(message);
      success += response.successCount;
      failure += response.failureCount;
      response.responses.forEach((resp, index) => {
        if (!resp.success && (resp.error?.code === "messaging/registration-token-not-registered" || resp.error?.code === "messaging/invalid-registration-token")) {
          invalidTokens.push(batch[index]);
        }
      });
    }
    return {
      success,
      failure,
      invalidTokens
    };
  } catch (error) {
    throw error;
  }
}

// server/jobs/maintenance.ts
async function deliverPendingPushNotifications() {
  const claims = await databaseAdapter.claimNotificationPushes(void 0, 100);
  for (const claim of claims) {
    const notification = claim.notification;
    try {
      const data = Object.fromEntries(
        Object.entries(notification.data || {}).filter((entry) => typeof entry[1] === "string")
      );
      if (!claim.deviceTokens.length) {
        await databaseAdapter.finishNotificationPush(notification.id, true);
        continue;
      }
      const result = await sendToMultipleDevices(claim.deviceTokens, {
        title: notification.title,
        body: notification.body || ""
      }, data);
      await Promise.all(result.invalidTokens.map(
        (token) => databaseAdapter.deleteDeviceToken(token, notification.user_id)
      ));
      await databaseAdapter.finishNotificationPush(
        notification.id,
        result.failure === 0,
        result.failure ? `${result.failure} device(s) rejected the push.` : void 0
      );
    } catch (error) {
      try {
        await databaseAdapter.finishNotificationPush(
          notification.id,
          false,
          error instanceof Error ? error.message : "FCM delivery failed."
        );
      } catch (finishError) {
        console.error(JSON.stringify({
          severity: "ERROR",
          notificationId: notification.id,
          message: "Could not persist notification delivery retry state.",
          error: finishError instanceof Error ? finishError.message : String(finishError)
        }));
      }
      console.error(JSON.stringify({
        severity: "ERROR",
        notificationId: notification.id,
        message: "FCM notification delivery failed.",
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}
async function runMaintenanceJob() {
  if (getDatabaseType() !== "supabase") throw new Error("Scheduled maintenance requires Supabase.");
  if (!isFirebaseConfigured()) throw new Error("Scheduled maintenance requires Firebase Realtime Database.");
  const jobName = "maintenance";
  const idempotencyKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
  const claimed = await databaseAdapter.claimScheduledJobRun(jobName, idempotencyKey);
  if (!claimed) {
    console.info(JSON.stringify({ severity: "INFO", jobName, idempotencyKey, duplicate: true }));
    return;
  }
  try {
    const maintenance = await databaseAdapter.runScheduledMaintenance();
    const removedLocations = await cleanupExpiredLocations();
    await deliverPendingPushNotifications();
    await databaseAdapter.finishScheduledJobRun(jobName, idempotencyKey);
    console.info(JSON.stringify({
      severity: "INFO",
      jobName,
      idempotencyKey,
      maintenance,
      removedLocations
    }));
  } catch (error) {
    try {
      await databaseAdapter.finishScheduledJobRun(
        jobName,
        idempotencyKey,
        error instanceof Error ? error.message : "Scheduled maintenance failed."
      );
    } catch (finishError) {
      console.error(JSON.stringify({
        severity: "ERROR",
        jobName,
        idempotencyKey,
        message: "Could not persist scheduled-job failure state.",
        error: finishError instanceof Error ? finishError.message : String(finishError)
      }));
    }
    throw error;
  }
}
runMaintenanceJob().catch((error) => {
  console.error(JSON.stringify({
    severity: "ERROR",
    jobName: "maintenance",
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
});
