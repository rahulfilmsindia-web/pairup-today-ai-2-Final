import { db, isSupabaseConfigured } from './supabase';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'pairuptoday_db.json');

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
  bankVerifications?: Record<string, any>;
  userLocations?: Record<string, any>;
  userPresence?: Record<string, any>;
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
  listUsers(filters?: any): Promise<any[]>;

  // KYC
  createKycSubmission(submission: any): Promise<any>;
  getKycSubmission(id: string): Promise<any | null>;
  listKycSubmissions(filters?: any): Promise<any[]>;
  updateKycSubmission(id: string, updates: any): Promise<any>;

  // Companion Profiles
  getCompanionProfile(userId: string): Promise<any | null>;
  createCompanionProfile(profile: any): Promise<any>;
  updateCompanionProfile(userId: string, updates: any): Promise<any>;
  listCompanionProfiles(filters?: any): Promise<any[]>;

  // Memberships
  createMembership(membership: any): Promise<any>;
  getActiveMembership(userId: string): Promise<any | null>;
  listMemberships(filters?: any): Promise<any[]>;

  // Bank Verification
  createBankVerification(verification: any): Promise<any>;
  getBankVerification(userId: string): Promise<any | null>;
  updateBankVerification(userId: string, updates: any): Promise<any>;

  // Bookings
  createBooking(booking: any): Promise<any>;
  getBooking(id: string): Promise<any | null>;
  getBookingByCode(code: string): Promise<any | null>;
  listBookings(filters?: any): Promise<any[]>;
  updateBooking(id: string, updates: any): Promise<any>;

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
  listMessages(conversationId: string): Promise<any[]>;

  // Support
  createSupportConversation(conversation: any): Promise<any>;
  getSupportConversation(id: string): Promise<any | null>;
  listSupportConversations(filters?: any): Promise<any[]>;
  createSupportMessage(message: any): Promise<any>;
  listSupportMessages(conversationId: string): Promise<any[]>;

  // Admin
  getAdminUser(email: string): Promise<any | null>;
  createAdminUser(admin: any): Promise<any>;
  listAdminUsers(): Promise<any[]>;

  // Audit Logs
  createAuditLog(log: any): Promise<void>;
  listAuditLogs(filters?: any): Promise<any[]>;

  // Notifications
  createNotification(notification: any): Promise<any>;
  listNotifications(userId: string): Promise<any[]>;
  markNotificationRead(id: string): Promise<void>;

  // OTP Store (in-memory only for security)
  setOtp(phone: string, data: any): void;
  getOtp(phone: string): any | null;
  deleteOtp(phone: string): void;

  // Admin MFA Store (in-memory only for security)
  setAdminMfa(adminId: string, data: any): void;
  getAdminMfa(adminId: string): any | null;
  deleteAdminMfa(adminId: string): void;
}

// In-memory stores for OTP and MFA (always in-memory for security)
const otpStore: Record<string, any> = {};
const adminMfaStore: Record<string, any> = {};

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

  async getKycSubmission(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.kycSubmissions[id] || null;
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

  async updateCompanionProfile(userId: string, updates: any): Promise<any> {
    const db = this.getDB();
    const profile = Object.values(db.companionProfiles).find((p: any) => p.userId === userId);
    if (!profile) return null;
    db.companionProfiles[profile.id] = { ...profile, ...updates };
    this.saveDB(db);
    return db.companionProfiles[profile.id];
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

  async listMemberships(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return Object.values(db.companionMemberships);
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

  async getBooking(id: string): Promise<any | null> {
    const db = this.getDB();
    return db.bookings[id] || null;
  }

  async getBookingByCode(code: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.bookings).find((b: any) => b.bookingCode === code) || null;
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

  async listMessages(conversationId: string): Promise<any[]> {
    const db = this.getDB();
    if (!db.chatMessages || !db.chatMessages[conversationId]) return [];
    return db.chatMessages[conversationId];
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

  async listSupportMessages(conversationId: string): Promise<any[]> {
    const db = this.getDB();
    if (!db.supportMessages || !db.supportMessages[conversationId]) return [];
    return db.supportMessages[conversationId];
  }

  async getAdminUser(email: string): Promise<any | null> {
    const db = this.getDB();
    return Object.values(db.adminUsers).find((a: any) => a.email === email) || null;
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

  async createAuditLog(log: any): Promise<void> {
    const db = this.getDB();
    db.auditLogs.push(log);
    this.saveDB(db);
  }

  async listAuditLogs(filters?: any): Promise<any[]> {
    const db = this.getDB();
    return db.auditLogs || [];
  }

  async createNotification(notification: any): Promise<any> {
    // For JSON DB, notifications are not persisted (optional feature)
    return notification;
  }

  async listNotifications(userId: string): Promise<any[]> {
    return [];
  }

  async markNotificationRead(id: string): Promise<void> {
    // No-op for JSON DB
  }

  setOtp(phone: string, data: any): void {
    otpStore[phone] = data;
  }

  getOtp(phone: string): any | null {
    return otpStore[phone] || null;
  }

  deleteOtp(phone: string): void {
    delete otpStore[phone];
  }

  setAdminMfa(adminId: string, data: any): void {
    adminMfaStore[adminId] = data;
  }

  getAdminMfa(adminId: string): any | null {
    return adminMfaStore[adminId] || null;
  }

  deleteAdminMfa(adminId: string): void {
    delete adminMfaStore[adminId];
  }
}

// Supabase-based adapter (production)
class SupabaseDatabaseAdapter implements DatabaseAdapter {
  async getUser(id: string): Promise<any | null> {
    const { data, error } = await db.users().select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async getUserByPhone(phone: string): Promise<any | null> {
    const { data, error } = await db.users().select('*').eq('phone', phone).single();
    if (error) return null;
    return data;
  }

  async createUser(user: any): Promise<any> {
    const { data, error } = await db.users().insert(user).select().single();
    if (error) throw error;
    return data;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const { data, error } = await db.users().update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async listUsers(filters?: any): Promise<any[]> {
    let query = db.users().select('*');
    if (filters?.role) query = query.eq('role', filters.role);
    if (filters?.kycStatus) query = query.eq('kyc_status', filters.kycStatus);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createKycSubmission(submission: any): Promise<any> {
    const { data, error } = await db.kycSubmissions().insert(submission).select().single();
    if (error) throw error;
    return data;
  }

  async getKycSubmission(id: string): Promise<any | null> {
    const { data, error } = await db.kycSubmissions().select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async listKycSubmissions(filters?: any): Promise<any[]> {
    let query = db.kycSubmissions().select('*');
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.submissionRole) query = query.eq('submission_role', filters.submissionRole);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateKycSubmission(id: string, updates: any): Promise<any> {
    const { data, error } = await db.kycSubmissions().update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async getCompanionProfile(userId: string): Promise<any | null> {
    const { data, error } = await db.companionProfiles().select('*').eq('user_id', userId).single();
    if (error) return null;
    return data;
  }

  async createCompanionProfile(profile: any): Promise<any> {
    const { data, error } = await db.companionProfiles().insert(profile).select().single();
    if (error) throw error;
    return data;
  }

  async updateCompanionProfile(userId: string, updates: any): Promise<any> {
    const { data, error } = await db.companionProfiles().update(updates).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  }

  async listCompanionProfiles(filters?: any): Promise<any[]> {
    let query = db.companionProfiles().select('*');
    if (filters?.isLive !== undefined) query = query.eq('is_live', filters.isLive);
    if (filters?.state) query = query.eq('state', filters.state);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createMembership(membership: any): Promise<any> {
    const { data, error } = await db.companionMemberships().insert(membership).select().single();
    if (error) throw error;
    return data;
  }

  async getActiveMembership(userId: string): Promise<any | null> {
    const now = new Date().toISOString();
    const { data, error } = await db.companionMemberships()
      .select('*')
      .eq('user_id', userId)
      .eq('payment_status', 'PAID')
      .gt('expiry_date', now)
      .order('expiry_date', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data;
  }

  async listMemberships(filters?: any): Promise<any[]> {
    let query = db.companionMemberships().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createBankVerification(verification: any): Promise<any> {
    const { data, error } = await db.bankVerifications().insert(verification).select().single();
    if (error) throw error;
    return data;
  }

  async getBankVerification(userId: string): Promise<any | null> {
    const { data, error } = await db.bankVerifications().select('*').eq('user_id', userId).single();
    if (error) return null;
    return data;
  }

  async updateBankVerification(userId: string, updates: any): Promise<any> {
    const { data, error } = await db.bankVerifications().update(updates).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  }

  async createBooking(booking: any): Promise<any> {
    const { data, error } = await db.bookings().insert(booking).select().single();
    if (error) throw error;
    return data;
  }

  async getBooking(id: string): Promise<any | null> {
    const { data, error } = await db.bookings().select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async getBookingByCode(code: string): Promise<any | null> {
    const { data, error } = await db.bookings().select('*').eq('booking_code', code).single();
    if (error) return null;
    return data;
  }

  async listBookings(filters?: any): Promise<any[]> {
    let query = db.bookings().select('*');
    if (filters?.clientId) query = query.eq('client_id', filters.clientId);
    if (filters?.companionId) query = query.eq('companion_id', filters.companionId);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateBooking(id: string, updates: any): Promise<any> {
    const { data, error } = await db.bookings().update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async createWalletEntry(entry: any): Promise<any> {
    const { data, error } = await db.walletLedger().insert(entry).select().single();
    if (error) throw error;
    return data;
  }

  async getWalletBalance(userId: string): Promise<any> {
    const { data, error } = await db.walletLedger().select('*').eq('user_id', userId);
    if (error) return { available: 0, locked: 0, total: 0 };
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
    return data || [];
  }

  async createPayout(payout: any): Promise<any> {
    const { data, error } = await db.payouts().insert(payout).select().single();
    if (error) throw error;
    return data;
  }

  async listPayouts(filters?: any): Promise<any[]> {
    let query = db.payouts().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.status) query = query.eq('payout_status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updatePayout(id: string, updates: any): Promise<any> {
    const { data, error } = await db.payouts().update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async createConversation(conversation: any): Promise<any> {
    const { data, error } = await db.chatConversations().insert(conversation).select().single();
    if (error) throw error;
    return data;
  }

  async getConversation(id: string): Promise<any | null> {
    const { data, error } = await db.chatConversations().select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async listConversations(userId: string): Promise<any[]> {
    const { data, error } = await db.chatConversations()
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (error) throw error;
    return data || [];
  }

  async createMessage(message: any): Promise<any> {
    const { data, error } = await db.chatMessages().insert(message).select().single();
    if (error) throw error;
    return data;
  }

  async listMessages(conversationId: string): Promise<any[]> {
    const { data, error } = await db.chatMessages().select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createSupportConversation(conversation: any): Promise<any> {
    const { data, error } = await db.supportConversations().insert(conversation).select().single();
    if (error) throw error;
    return data;
  }

  async getSupportConversation(id: string): Promise<any | null> {
    const { data, error } = await db.supportConversations().select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async listSupportConversations(filters?: any): Promise<any[]> {
    let query = db.supportConversations().select('*');
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createSupportMessage(message: any): Promise<any> {
    const { data, error } = await db.supportMessages().insert(message).select().single();
    if (error) throw error;
    return data;
  }

  async listSupportMessages(conversationId: string): Promise<any[]> {
    const { data, error } = await db.supportMessages().select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getAdminUser(email: string): Promise<any | null> {
    const { data, error } = await db.adminUsers().select('*').eq('email', email).single();
    if (error) return null;
    return data;
  }

  async createAdminUser(admin: any): Promise<any> {
    const { data, error } = await db.adminUsers().insert(admin).select().single();
    if (error) throw error;
    return data;
  }

  async listAdminUsers(): Promise<any[]> {
    const { data, error } = await db.adminUsers().select('*');
    if (error) throw error;
    return data || [];
  }

  async createAuditLog(log: any): Promise<void> {
    await db.auditLogs().insert(log);
  }

  async listAuditLogs(filters?: any): Promise<any[]> {
    let query = db.auditLogs().select('*');
    if (filters?.adminId) query = query.eq('admin_id', filters.adminId);
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.action) query = query.eq('action', filters.action);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  async createNotification(notification: any): Promise<any> {
    const { data, error } = await db.notifications().insert(notification).select().single();
    if (error) throw error;
    return data;
  }

  async listNotifications(userId: string): Promise<any[]> {
    const { data, error } = await db.notifications().select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.notifications().update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  setOtp(phone: string, data: any): void {
    otpStore[phone] = data;
  }

  getOtp(phone: string): any | null {
    return otpStore[phone] || null;
  }

  deleteOtp(phone: string): void {
    delete otpStore[phone];
  }

  setAdminMfa(adminId: string, data: any): void {
    adminMfaStore[adminId] = data;
  }

  getAdminMfa(adminId: string): any | null {
    return adminMfaStore[adminId] || null;
  }

  deleteAdminMfa(adminId: string): void {
    delete adminMfaStore[adminId];
  }
}

// Export the appropriate adapter based on configuration
export const databaseAdapter: DatabaseAdapter = isSupabaseConfigured()
  ? new SupabaseDatabaseAdapter()
  : new JsonDatabaseAdapter();

export function getDatabaseType(): 'supabase' | 'json' {
  return isSupabaseConfigured() ? 'supabase' : 'json';
}
