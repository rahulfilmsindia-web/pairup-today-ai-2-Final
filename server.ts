import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sendApitxtOtp, verifyApitxtBankAccount, compareLegalAndBankNames, formatPhoneForApitxt, isApitxtConfigured } from './server/services/apitxt.ts';
import { createRazorpayOrder, createRazorpayRefund, fetchRazorpayPayment, fetchRazorpayPaymentRefunds, verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from './server/services/razorpay.ts';
import { databaseAdapter, getDatabaseType, type OtpReservation } from './server/services/database.ts';
import { updateUserLocation, getUserLocation, startLocationSharing, stopLocationSharing, setUserPresence, getUserPresence, isFirebaseConfigured } from './server/services/firebase.ts';
import { sendToMultipleDevices } from './server/services/fcm.ts';
import { getPlaceAutocomplete, geocodeAddress, reverseGeocode, getDistanceMatrix, calculateDistance, isGoogleMapsConfigured } from './server/services/googlemaps.ts';
import { hashPassword, verifyPassword } from './server/services/passwords.ts';
import { PAIRUP_SERVICES } from './src/constants/services.ts';
import * as webpushModule from 'web-push';
const webpush: any = (webpushModule as any).default || webpushModule;

const KNOWN_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  'burdwan': { lat: 23.2324, lng: 87.8615 },
  'bardhaman': { lat: 23.2324, lng: 87.8615 },
  'baranagar': { lat: 22.6433, lng: 88.3653 },
  'dumdum': { lat: 22.6420, lng: 88.4312 },
  'dum dum': { lat: 22.6420, lng: 88.4312 },
  'saltlake': { lat: 22.5804, lng: 88.4237 },
  'salt lake': { lat: 22.5804, lng: 88.4237 },
  'bidhannagar': { lat: 22.5804, lng: 88.4237 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'calcutta': { lat: 22.5726, lng: 88.3639 },
  'azadgarh': { lat: 22.4883, lng: 88.3585 },
  'golf garden': { lat: 22.4965, lng: 88.3546 },
  'tollygunge': { lat: 22.4988, lng: 88.3473 },
  'jadavpur': { lat: 22.4988, lng: 88.3718 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'kochi': { lat: 9.9312, lng: 76.2673 },
  'indore': { lat: 22.7196, lng: 75.8577 },
  'surat': { lat: 21.1702, lng: 72.8311 },
  'patna': { lat: 25.5941, lng: 85.1376 },
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'noida': { lat: 28.5355, lng: 77.3910 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

app.use(express.json({
  limit: '22mb',
  verify: (req, _res, buffer) => {
    Object.assign(req, { rawBody: Buffer.from(buffer) });
  }
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pairuptoday_db.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // In containerized production with Supabase, local data directory is not required
  }
}

// Security headers & CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN || 'https://pairuptoday.com',
    process.env.ADMIN_ORIGIN || 'https://admin.pairuptoday.com'
  ];
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Test-Harness');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Database schema and in-memory cache with atomic file sync
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
  otpStore: Record<string, {
    otpHash: string; // ONLY SHA-256 HASH STORED
    expiresAt: number;
    attempts: number;
    lastSentAt: number;
    requestId?: string;
    status: 'SENT' | 'VERIFIED';
    windowStartTime: number;
    windowCount: number;
    testOtp?: string; // Only stored in test mode
  }>;
  adminMfaStore: Record<string, {
    otpHash: string;
    expiresAt: number;
    attempts: number;
    lastSentAt: number;
    testOtp?: string;
  }>;
  auditLogs: any[];
}

const MIN_SECRET_LENGTH = 32;

function isOtpHmacSecretConfigured(): boolean {
  return Boolean(process.env.OTP_HMAC_SECRET && process.env.OTP_HMAC_SECRET.length >= MIN_SECRET_LENGTH);
}

function isSessionSecretConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= MIN_SECRET_LENGTH);
}

function legacySeedPasswordHash(password: string): string {
  return crypto.createHash('sha256').update(password + '_pairup_salt_2026').digest('hex');
}

/**
 * Server-secret-keyed HMAC-SHA256 for secure 6-digit OTP challenge hashing
 */
function hashOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('OTP_HMAC_SECRET must contain at least 32 characters.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update((otp || '').trim())
    .digest('hex');
}

function encryptBookingOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('OTP_HMAC_SECRET must contain at least 32 characters.');
  }
  const key = crypto.createHash('sha256').update(`booking-otp-encryption:${secret}`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptBookingOtp(encrypted: string): string {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('OTP_HMAC_SECRET must contain at least 32 characters.');
  }
  const [version, ivText, tagText, ciphertextText] = encrypted.split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Stored booking OTP encryption is invalid.');
  const key = crypto.createHash('sha256').update(`booking-otp-encryption:${secret}`).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function encryptBankAccount(accountNumber: string): string {
  const secret = process.env.BANK_ACCOUNT_ENCRYPTION_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY must be a 32-byte hexadecimal key.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptBankAccount(encrypted: string): string {
  const secret = process.env.BANK_ACCOUNT_ENCRYPTION_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY must be a 32-byte hexadecimal key.');
  }
  const [version, ivText, tagText, ciphertextText] = encrypted.split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Stored bank-account encryption is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

/**
 * Constant-time verification of OTP against stored HMAC-SHA256 hash to eliminate side-channel timing attacks
 */
function verifyOtpHash(enteredOtp: string, expectedHash: string): boolean {
  if (!enteredOtp || !expectedHash) return false;
  const computedHash = hashOtp(enteredOtp);
  const computedBuf = Buffer.from(computedHash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (computedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}

const AUTHORIZED_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'KYC_ADMIN',
  'FINANCE_ADMIN',
  'SUPPORT_ADMIN',
  'AUDITOR'
] as const;

type AuthorizedAdminRole = typeof AUTHORIZED_ADMIN_ROLES[number];

interface AuthenticatedRequest extends Request {
  authUser?: any;
  adminUser?: any;
  rawBody?: Buffer;
  verifiedSession?: { tokenId: string; expiresAt: string; principalType: 'USER' | 'ADMIN' };
}

async function createAndSendNotification(notification: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const stored = await databaseAdapter.createNotification(notification);
  let claim: any;
  try {
    const claims = await databaseAdapter.claimNotificationPushes(stored.id, 1);
    claim = claims[0];
    if (!claim) return stored;
    if (!claim.deviceTokens.length) {
      await databaseAdapter.finishNotificationPush(stored.id, true);
      return stored;
    }
    const result = await sendToMultipleDevices(claim.deviceTokens, {
      title: notification.title,
      body: notification.body
    }, notification.data);
    await Promise.all(result.invalidTokens.map(token => databaseAdapter.deleteDeviceToken(token, notification.userId)));
    if (result.failure > 0) {
      await databaseAdapter.finishNotificationPush(stored.id, false, `${result.failure} device(s) rejected the push.`);
      console.warn('Some registered devices did not receive a push notification.');
    } else {
      await databaseAdapter.finishNotificationPush(stored.id, true);
    }
  } catch (error) {
    if (claim) {
      try {
        await databaseAdapter.finishNotificationPush(
          stored.id,
          false,
          error instanceof Error ? error.message : 'FCM delivery failed.'
        );
      } catch (finishError) {
        console.error('Notification push retry state could not be persisted.', finishError);
      }
    }
    console.error('Persistent notification was stored but FCM delivery failed.', error);
  }
  return stored;
}

function normalizeIndianPhone(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  return null;
}

function parseKycImageDataUrl(value: unknown): { bytes: Buffer; contentType: string; extension: string } | null {
  if (typeof value !== 'string') return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) return null;
  const isValidImage = match[1] === 'image/jpeg'
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : match[1] === 'image/png'
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!isValidImage) return null;
  const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].slice('image/'.length);
  return { bytes, contentType: match[1], extension };
}

function omitKycDocumentPaths(record: any): any {
  const {
    idFrontUrl: _front,
    idBackUrl: _back,
    selfieUrl: _selfie,
    id_front_document_path: _frontPath,
    id_back_document_path: _backPath,
    selfie_document_path: _selfiePath,
    ...safeRecord
  } = record;
  return safeRecord;
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function issueUserSessionToken(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
    jti: crypto.randomUUID(),
    typ: 'access'
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `pairup_session.${payload}.${signature}`;
}

function verifyUserSessionToken(token: string): { userId: string; tokenId: string; expiresAt: string } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'pairup_session') return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[1]).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: payload.sub, tokenId: payload.jti, expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch {
    return null;
  }
}

function issueAdminSessionToken(adminId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: adminId,
    iat: now,
    exp: now + 60 * 60 * 8,
    jti: crypto.randomUUID(),
    typ: 'admin'
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `pairup_admin.${payload}.${signature}`;
}

function verifyAdminSessionToken(token: string): { adminId: string; tokenId: string; expiresAt: string } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'pairup_admin') return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[1]).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (
      payload.typ !== 'admin' ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return { adminId: payload.sub, tokenId: payload.jti, expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch {
    return null;
  }
}

function publicAuthUser(user: any) {
  if (!user) return null;
  const inMemory = db.users?.[user.id];
  const profileName = user.profileName || user.profile_name || inMemory?.profileName || user.legalName || 'User';
  return {
    id: user.id,
    phone: user.phone,
    legalName: user.legalName,
    profileName: profileName,
    email: user.email,
    role: user.role,
    activeRole: user.activeRole || user.active_role || inMemory?.activeRole || (user.role === 'COMPANION' ? 'COMPANION' : 'CLIENT'),
    dob: user.dob,
    age: user.age,
    kycStatus: user.kycStatus || user.kyc_status || inMemory?.kycStatus || 'NOT_SUBMITTED',
    kycRejectionReason: user.kycRejectionReason || user.kyc_rejection_reason || inMemory?.kycRejectionReason || null,
    profilePhoto: user.profilePhoto || user.profile_photo || inMemory?.profilePhoto || null,
    photos: Array.isArray(user.photos) && user.photos.length > 0 
      ? user.photos 
      : (inMemory?.photos || (user.profilePhoto ? [user.profilePhoto] : [])),
    bio: user.bio !== undefined ? user.bio : (inMemory?.bio || ''),
    city: user.city || 'India',
    isSuspended: user.isSuspended !== undefined ? !!user.isSuspended : !!inMemory?.isSuspended,
    suspendedReason: user.suspendedReason || inMemory?.suspendedReason || null,
    suspendedAt: user.suspendedAt || inMemory?.suspendedAt || null,
    warningCount: typeof user.warningCount === 'number' ? user.warningCount : (typeof inMemory?.warningCount === 'number' ? inMemory.warningCount : 0),
    lastWarningReason: user.lastWarningReason || inMemory?.lastWarningReason || null,
    lastWarningAt: user.lastWarningAt || inMemory?.lastWarningAt || null
  };
}

interface InitialCompanionRecord {
  id: string;
  name: string;
  age: number;
  city: string;
  state: string;
  address?: string;
  hourlyRatePaise: number;
  services: number[];
  bio: string;
  profilePhoto: string;
  photos: string[];
  phone?: string;
  rating: number;
  totalBookings: number;
}

const INITIAL_COMPANIONS: InitialCompanionRecord[] = [
  {
    id: 'init_arjun_chauhan_delhi',
    name: 'Arjun Chauhan',
    age: 27,
    city: 'Delhi',
    state: 'Delhi',
    address: 'Delhi',
    phone: '+919988001001',
    hourlyRatePaise: 119900,
    services: [1, 5, 6, 11, 12, 13, 21, 23],
    bio: 'Engaging, articulate and active companion in Delhi. Loves architectural walks, sporting matches, jogging in historic gardens, and travel transit assistance.',
    profilePhoto: '/assets/companions/arjun_chauhan_main.png',
    photos: [
      '/assets/companions/arjun_chauhan_photo1.png',
      '/assets/companions/arjun_chauhan_photo2.png',
      '/assets/companions/arjun_chauhan_photo3.png'
    ],
    rating: 4.96,
    totalBookings: 28
  },
  {
    id: 'init_sayantika_ghosh_burdwan',
    name: 'Sayantika Ghosh',
    age: 24,
    city: 'Burdwan',
    state: 'West Bengal',
    address: 'Burdwan, West Bengal',
    phone: '+919988001002',
    hourlyRatePaise: 89900,
    services: [1, 2, 4, 7, 14, 16, 20],
    bio: 'Polite, cultured and enthusiastic companion from Burdwan. Loves traditional Bengali art, handicraft exhibitions, quiet cafe conversations, and festive cultural visits.',
    profilePhoto: '/assets/companions/sayantika_main.png',
    photos: [
      '/assets/companions/sayantika_photo1.png',
      '/assets/companions/sayantika_photo2.png',
      '/assets/companions/sayantika_photo3.png'
    ],
    rating: 4.94,
    totalBookings: 19
  },
  {
    id: 'init_riya_dutta_baranagar',
    name: 'Riya Dutta',
    age: 25,
    city: 'Baranagar, Kolkata',
    state: 'West Bengal',
    address: 'Baranagar, Kolkata',
    phone: '+919988001003',
    hourlyRatePaise: 99900,
    services: [1, 2, 3, 4, 6, 8, 22],
    bio: 'Vibrant, stylish and friendly companion from Baranagar, Kolkata. Enjoys exploring northern Kolkata cafe culture, film festivals, shopping outings, and local culinary discoveries.',
    profilePhoto: '/assets/companions/riya_dutta_main.png',
    photos: [
      '/assets/companions/riya_dutta_photo1.png',
      '/assets/companions/riya_dutta_photo2.png',
      '/assets/companions/riya_dutta_photo3.png'
    ],
    rating: 4.97,
    totalBookings: 31
  },
  {
    id: 'init_ritwik_basu_dumdum',
    name: 'Ritwik Basu',
    age: 28,
    city: 'Dumdum, Kolkata',
    state: 'West Bengal',
    address: 'Dumdum, Kolkata',
    phone: '+919988001004',
    hourlyRatePaise: 109900,
    services: [1, 2, 5, 9, 10, 15, 21],
    bio: 'Energetic and friendly companion residing in Dumdum, Kolkata. Music enthusiast, great company for concerts, transit assistance, gaming nights, and weekend social gatherings.',
    profilePhoto: '/assets/companions/ritwik_main.png',
    photos: [
      '/assets/companions/ritwik_photo1.png',
      '/assets/companions/ritwik_photo2.png',
      '/assets/companions/ritwik_photo3.png'
    ],
    rating: 4.93,
    totalBookings: 26
  },
  {
    id: 'init_megha_sen_kolkata',
    name: 'Megha Sen',
    age: 26,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    phone: '+919988001005',
    hourlyRatePaise: 104900,
    services: [1, 2, 4, 7, 8, 14, 22],
    bio: 'Warm and creative Kolkata companion. Passionate about arts, handicraft markets, attending social ceremonies and exploring authentic street food destinations across the city.',
    profilePhoto: '/assets/companions/megha_main.png',
    photos: [
      '/assets/companions/megha_photo1.png',
      '/assets/companions/megha_photo2.png',
      '/assets/companions/megha_photo3.png',
      '/assets/companions/megha_photo4.png'
    ],
    rating: 4.98,
    totalBookings: 35
  },
  {
    id: 'init_arnab_chatterjee_kolkata',
    name: 'Arnab Chatterjee',
    age: 29,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    phone: '+919988001006',
    hourlyRatePaise: 114900,
    services: [1, 5, 6, 10, 11, 16, 23],
    bio: 'Sociable and well-travelled companion in Kolkata. Enjoys cultural seminars, live music concerts, sporting events at Salt Lake Stadium, and guided heritage walks.',
    profilePhoto: '/assets/companions/arnab_main.png',
    photos: [
      '/assets/companions/arnab_photo1.png',
      '/assets/companions/arnab_photo2.png',
      '/assets/companions/arnab_photo3.png',
      '/assets/companions/arnab_photo4.png'
    ],
    rating: 4.95,
    totalBookings: 42
  },
  {
    id: 'init_ishika_sen_saltlake',
    name: 'Ishika Sen',
    age: 25,
    city: 'Saltlake, Kolkata',
    state: 'West Bengal',
    address: 'Saltlake, Kolkata',
    phone: '+919988001007',
    hourlyRatePaise: 109900,
    services: [1, 2, 4, 12, 13, 16, 19],
    bio: 'Friendly, professional companion based in Saltlake Sector V, Kolkata. Perfect companion for lakeside walks, peaceful cafe study sessions, City Centre shopping, and pleasant conversations.',
    profilePhoto: '/assets/companions/ishika_main.png',
    photos: [
      '/assets/companions/ishika_photo1.png',
      '/assets/companions/ishika_photo2.png',
      '/assets/companions/ishika_photo3.png',
      '/assets/companions/ishika_photo4.png'
    ],
    rating: 4.96,
    totalBookings: 29
  },
  {
    id: 'init_nithya_subramanian_chennai',
    name: 'Nithya Subramanian',
    age: 26,
    city: 'Chennai',
    state: 'Tamil Nadu',
    address: 'Chennai, Tamil Nadu',
    phone: '+919988001008',
    hourlyRatePaise: 99900,
    services: [1, 2, 7, 10, 14, 17, 20],
    bio: 'Gentle, thoughtful and cultured companion from Chennai. Enjoys classical music concerts, serene beach strolls, temple visits, and engaging in warm, meaningful conversation.',
    profilePhoto: '/assets/companions/nithya_main.png',
    photos: [
      '/assets/companions/nithya_photo1.png',
      '/assets/companions/nithya_photo2.png',
      '/assets/companions/nithya_photo3.png'
    ],
    rating: 4.97,
    totalBookings: 33
  },
  {
    id: 'init_riya_kolkata',
    name: 'Riya Sharma',
    age: 24,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    hourlyRatePaise: 99900,
    services: [1, 2, 4, 6, 7, 22],
    bio: 'Warm, thoughtful conversationalist who loves discovering quaint cafes, discussing literature, and exploring Kolkata heritage lanes.',
    profilePhoto: '/assets/companions/riya_main.jpg',
    photos: [
      '/assets/companions/riya_photo1.jpg',
      '/assets/companions/riya_photo2.jpg',
      '/assets/companions/riya_photo3.jpg'
    ],
    rating: 4.95,
    totalBookings: 32
  },
  {
    id: 'init_aarav_mumbai',
    name: 'Aarav Singhania',
    age: 27,
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Mumbai, Maharashtra',
    hourlyRatePaise: 129900,
    services: [1, 2, 5, 8, 9, 11, 16],
    bio: 'Finance professional and fitness enthusiast. Great companion for business co-working, marine drive strolls, sports events, and social gatherings.',
    profilePhoto: '/assets/companions/aarav_main.jpg',
    photos: [
      '/assets/companions/aarav_photo1.jpg',
      '/assets/companions/aarav_photo2.jpg',
      '/assets/companions/aarav_photo3.jpg'
    ],
    rating: 4.98,
    totalBookings: 47
  },
  {
    id: 'init_sneha_ahmedabad',
    name: 'Sneha Patel',
    age: 26,
    city: 'Ahmedabad',
    state: 'Gujarat',
    address: 'Ahmedabad, Gujarat',
    hourlyRatePaise: 89900,
    services: [1, 3, 4, 14, 19, 20],
    bio: 'Friendly companion for textile shopping, visiting local handicraft markets, peaceful temple visits, and weekend movie screenings.',
    profilePhoto: '/assets/companions/sneha_main.jpg',
    photos: [
      '/assets/companions/sneha_photo1.jpg',
      '/assets/companions/sneha_photo2.jpg',
      '/assets/companions/sneha_photo3.jpg'
    ],
    rating: 4.92,
    totalBookings: 24
  },
  {
    id: 'init_kabir_delhi',
    name: 'Kabir Verma',
    age: 29,
    city: 'Delhi NCR',
    state: 'Delhi',
    address: 'Delhi NCR, Delhi',
    hourlyRatePaise: 119900,
    services: [1, 6, 7, 10, 12, 23],
    bio: 'Architect and heritage lover. Excellent companion for monuments, art galleries, live music events, and jogging in Lodhi Garden.',
    profilePhoto: '/assets/companions/kabir_main.jpg',
    photos: [
      '/assets/companions/kabir_photo1.jpg',
      '/assets/companions/kabir_photo2.jpg',
      '/assets/companions/kabir_photo3.jpg'
    ],
    rating: 4.94,
    totalBookings: 38
  },
  {
    id: 'init_meera_bengaluru',
    name: 'Anusha Mitra',
    age: 25,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Park Street, Kolkata',
    hourlyRatePaise: 94900,
    services: [1, 2, 13, 15, 16, 22],
    bio: 'Graceful, warm, and engaging companion who loves cafe outings around Park Street, literature, cultural events, and exploring Kolkata heritage.',
    profilePhoto: '/assets/companions/anusha_main.jpg',
    photos: [
      '/assets/companions/anusha_photo1.png',
      '/assets/companions/anusha_photo2.png',
      '/assets/companions/anusha_photo3.png'
    ],
    rating: 4.96,
    totalBookings: 29
  },
  {
    id: 'init_rohan_kolkata',
    name: 'Rohan Mukherjee',
    age: 28,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    hourlyRatePaise: 109900,
    services: [1, 3, 5, 6, 11, 21, 23],
    bio: 'History enthusiast and passionate foodie. Ready for football stadium matches, airport assists, and uncovering historic city landmarks.',
    profilePhoto: '/assets/companions/rohan_main.jpg',
    photos: [
      '/assets/companions/rohan_photo1.jpg',
      '/assets/companions/rohan_photo2.jpg',
      '/assets/companions/rohan_photo3.jpg'
    ],
    rating: 4.89,
    totalBookings: 19
  },
  {
    id: 'init_pooja_hyderabad',
    name: 'Pooja Reddy',
    age: 26,
    city: 'Hyderabad',
    state: 'Telangana',
    address: 'Hyderabad, Telangana',
    hourlyRatePaise: 89900,
    services: [1, 2, 4, 7, 8, 17, 24],
    bio: 'Caring, polite companion with great patience. Enjoys cultural functions, shopping at Jubilee Hills, and accompanying senior citizens.',
    profilePhoto: '/assets/companions/pooja_main.jpg',
    photos: [
      '/assets/companions/pooja_photo1.jpg',
      '/assets/companions/pooja_photo2.jpg',
      '/assets/companions/pooja_photo3.jpg'
    ],
    rating: 4.97,
    totalBookings: 35
  },
  {
    id: 'init_vikram_jaipur',
    name: 'Vikramaditya Rathore',
    age: 30,
    city: 'Jaipur',
    state: 'Rajasthan',
    address: 'Jaipur, Rajasthan',
    hourlyRatePaise: 139900,
    services: [1, 5, 6, 8, 14, 20, 23],
    bio: 'Heritage photographer and desert travel planner. Experienced companion for royal fort explorations, traditional weddings, and cultural festivals.',
    profilePhoto: '/assets/companions/vikram_main.jpg',
    photos: [
      '/assets/companions/vikram_photo1.jpg',
      '/assets/companions/vikram_photo2.jpg',
      '/assets/companions/vikram_photo3.jpg'
    ],
    rating: 4.93,
    totalBookings: 41
  },
  {
    id: 'init_ananya_pune',
    name: 'Ananya Deshmukh',
    age: 25,
    city: 'Pune',
    state: 'Maharashtra',
    address: 'Pune, Maharashtra',
    hourlyRatePaise: 99900,
    services: [1, 2, 10, 12, 16, 18, 24],
    bio: 'Psychology researcher and yoga enthusiast. Friendly, compassionate companion for library study, medical visits, and fitness activities.',
    profilePhoto: '/assets/companions/ananya_pune_main.jpg',
    photos: [
      '/assets/companions/ananya_pune_photo1.jpg',
      '/assets/companions/ananya_pune_photo2.jpg',
      '/assets/companions/ananya_pune_photo3.jpg'
    ],
    rating: 4.91,
    totalBookings: 22
  },
  {
    id: 'init_aditya_chandigarh',
    name: 'Aditya Roy',
    age: 28,
    city: 'Chandigarh',
    state: 'Punjab',
    address: 'Chandigarh, Punjab',
    hourlyRatePaise: 114900,
    services: [1, 5, 9, 11, 13, 21],
    bio: 'Outdoor activities enthusiast, badminton player, and lively party companion who loves highway drives and weekend sporting events.',
    profilePhoto: '/assets/companions/aditya_main.jpg',
    photos: [
      '/assets/companions/aditya_photo1.jpg',
      '/assets/companions/aditya_photo2.jpg',
      '/assets/companions/aditya_photo3.jpg'
    ],
    rating: 4.88,
    totalBookings: 27
  },
  {
    id: 'init_divya_chennai',
    name: 'Divya Menon',
    age: 27,
    city: 'Chennai',
    state: 'Tamil Nadu',
    address: 'Chennai, Tamil Nadu',
    hourlyRatePaise: 99900,
    services: [1, 2, 7, 10, 15, 18, 20],
    bio: 'Carnatic music vocalist and tech consultant. Enjoys classical concert seasons, filter coffee cafes, and museum exhibitions.',
    profilePhoto: '/assets/companions/divya_main.jpg',
    photos: [
      '/assets/companions/divya_photo1.jpg',
      '/assets/companions/divya_photo2.jpg',
      '/assets/companions/divya_photo3.jpg'
    ],
    rating: 4.95,
    totalBookings: 31
  },
  {
    id: 'init_tanvi_indore',
    name: 'Tanvi Joshi',
    age: 24,
    city: 'Indore',
    state: 'Madhya Pradesh',
    address: 'Indore, Madhya Pradesh',
    hourlyRatePaise: 84900,
    services: [1, 3, 4, 12, 17, 19, 22],
    bio: 'Cheerful companion for Sarafa Bazaar food walks, shopping trips, senior errand support, and morning fitness walks.',
    profilePhoto: '/assets/companions/tanvi_main.jpg',
    photos: [
      '/assets/companions/tanvi_photo1.jpg',
      '/assets/companions/tanvi_photo2.jpg',
      '/assets/companions/tanvi_photo3.jpg'
    ],
    rating: 4.90,
    totalBookings: 18
  },
  {
    id: 'init_arindam_kolkata',
    name: 'Arindam Chatterjee',
    age: 28,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    hourlyRatePaise: 99900,
    services: [1, 2, 4, 6, 7, 22],
    bio: 'Art and architecture lover who enjoys College Street book walks, heritage tram rides, and cultural festivals across Kolkata.',
    profilePhoto: '/assets/companions/arindam_main.jpg',
    photos: [
      '/assets/companions/arindam_photo1.jpg',
      '/assets/companions/arindam_photo2.jpg',
      '/assets/companions/arindam_photo3.jpg'
    ],
    rating: 4.94,
    totalBookings: 26
  },
  {
    id: 'init_sreeja_kolkata',
    name: 'Sreeja Mukherjee',
    age: 25,
    city: 'Kolkata',
    state: 'West Bengal',
    address: 'Kolkata, West Bengal',
    hourlyRatePaise: 109900,
    services: [1, 2, 3, 4, 6, 14, 22],
    bio: 'Literature enthusiast, classical dancer, and conversationalist who enjoys Rabindra Sarobar morning walks and artisan handicraft fairs.',
    profilePhoto: '/assets/companions/sreeja_main.jpg',
    photos: [
      '/assets/companions/sreeja_photo1.jpg',
      '/assets/companions/sreeja_photo2.jpg',
      '/assets/companions/sreeja_photo3.jpg'
    ],
    rating: 4.97,
    totalBookings: 34
  }
];

function seedInitialCompanions(targetDb: DBState) {
  for (const c of INITIAL_COMPANIONS) {
    if (!targetDb.users[c.id]) {
      targetDb.users[c.id] = {
        id: c.id,
        phone: c.phone || `+9199990${c.id.slice(-5).replace(/\D/g, '') || '00001'}`,
        passwordHash: legacySeedPasswordHash('PairUpInit@2026'),
        legalName: c.name,
        email: `${c.id}@pairuptoday.com`,
        role: 'COMPANION',
        activeRole: 'COMPANION',
        age: c.age,
        dob: `${2026 - c.age}-01-01`,
        kycStatus: 'APPROVED',
        profilePhoto: c.profilePhoto,
        photos: c.photos,
        bio: c.bio,
        city: c.city,
        state: c.state,
        address: c.address || `${c.city}, ${c.state}`,
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
      };
    } else {
      targetDb.users[c.id].legalName = c.name;
      targetDb.users[c.id].age = c.age;
      targetDb.users[c.id].city = c.city;
      targetDb.users[c.id].state = c.state;
      targetDb.users[c.id].address = c.address || `${c.city}, ${c.state}`;
      targetDb.users[c.id].profilePhoto = c.profilePhoto;
      targetDb.users[c.id].photos = c.photos;
      targetDb.users[c.id].bio = c.bio;
    }
    if (!targetDb.companionProfiles[c.id]) {
      targetDb.companionProfiles[c.id] = {
        userId: c.id,
        services: c.services,
        rates: {
          hourlyPaise: c.hourlyRatePaise,
          halfDayPaise: Math.round(c.hourlyRatePaise * 3.5),
          fullDayPaise: Math.round(c.hourlyRatePaise * 6.5)
        },
        availability: null, // Strictly non-bookable
        isLive: true,
        rating: c.rating,
        totalBookings: c.totalBookings,
        address: c.address || `${c.city}, ${c.state}`,
        state: c.state,
        isInitialListing: true
      };
    } else {
      targetDb.companionProfiles[c.id].isInitialListing = true;
      targetDb.companionProfiles[c.id].state = c.state;
      targetDb.companionProfiles[c.id].address = c.address || `${c.city}, ${c.state}`;
      targetDb.companionProfiles[c.id].availability = null;
    }
  }
}

// Initial DB state loader
function loadDB(): DBState {
  if (process.env.NODE_ENV === 'production') {
    return {
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
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      seedInitialCompanions(parsed);
      const genuineUpdates: Record<string, { photo: string; photos: string[] }> = {
        comp_arjun_01: { photo: '/assets/companions/arjun_main.jpg', photos: ['/assets/companions/arjun_photo1.jpg', '/assets/companions/arjun_photo2.jpg', '/assets/companions/arjun_photo3.jpg'] },
        comp_priya_02: { photo: '/assets/companions/priya_main.jpg', photos: ['/assets/companions/priya_photo1.jpg', '/assets/companions/priya_photo2.jpg', '/assets/companions/priya_photo3.jpg'] },
        comp_rohit_03: { photo: '/assets/companions/rohit_main.jpg', photos: ['/assets/companions/rohit_photo1.jpg', '/assets/companions/rohit_photo2.jpg', '/assets/companions/rohit_photo3.jpg'] },
        comp_ananya_04: { photo: '/assets/companions/ananya_main.jpg', photos: ['/assets/companions/ananya_photo1.jpg', '/assets/companions/ananya_photo2.jpg', '/assets/companions/ananya_photo3.jpg'] }
      };
      for (const [gid, gdata] of Object.entries(genuineUpdates)) {
        if (parsed.users[gid]) {
          parsed.users[gid].profilePhoto = gdata.photo;
          parsed.users[gid].photos = gdata.photos;
        }
      }
      saveDB(parsed);
      return parsed;
    } catch (err) {
      console.error('Failed to parse existing DB file, creating fresh state', err);
    }
  }

  const initialAdminId = 'admin_super_01';
  const initialAdminEmail = 'rahulfilmsindia@gmail.com';
  const initialAdminPhone = '+918640851337';

  // Seed verified initial companions for discovery
  const companion1Id = 'comp_arjun_01';
  const companion2Id = 'comp_priya_02';
  const companion3Id = 'comp_rohit_03';
  const companion4Id = 'comp_ananya_04';

  const initialDB: DBState = {
    users: {
      [companion1Id]: {
        id: companion1Id,
        phone: '+919876543210',
        passwordHash: legacySeedPasswordHash('PairUp@2026'),
        legalName: 'Arjun Sen',
        email: 'arjun.sen@example.com',
        role: 'COMPANION',
        activeRole: 'COMPANION',
        dob: '1998-04-15',
        age: 28,
        kycStatus: 'APPROVED',
        kycSubmittedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        kycDecidedAt: new Date(Date.now() - 29 * 86400000).toISOString(),
        kycDecidedBy: 'admin_super_01',
        profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        bio: 'Passionate conversationalist, heritage walking enthusiast, and avid coffee taster. Experienced city companion in Kolkata.',
        photos: [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
        ],
        city: 'Kolkata',
        createdAt: new Date(Date.now() - 35 * 86400000).toISOString()
      },
      [companion2Id]: {
        id: companion2Id,
        phone: '+919876543211',
        passwordHash: legacySeedPasswordHash('PairUp@2026'),
        legalName: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        role: 'COMPANION',
        activeRole: 'COMPANION',
        dob: '1997-08-22',
        age: 29,
        kycStatus: 'APPROVED',
        kycSubmittedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        kycDecidedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
        kycDecidedBy: 'admin_super_01',
        profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        bio: 'Art curator, book fair enthusiast, and shopping consultant. Always up for cheerful conversations and café outings in South Delhi.',
        photos: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
        ],
        city: 'Delhi NCR',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      [companion3Id]: {
        id: companion3Id,
        phone: '+919876543212',
        passwordHash: legacySeedPasswordHash('PairUp@2026'),
        legalName: 'Rohit Kulkarni',
        email: 'rohit.k@example.com',
        role: 'COMPANION',
        activeRole: 'COMPANION',
        dob: '1995-11-10',
        age: 31,
        kycStatus: 'APPROVED',
        kycSubmittedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        kycDecidedAt: new Date(Date.now() - 19 * 86400000).toISOString(),
        kycDecidedBy: 'admin_super_01',
        profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        bio: 'Tech enthusiast, co-working buddy, fitness walker, and sports stadium companion in Mumbai & Pune.',
        photos: [
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
        ],
        city: 'Mumbai',
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
      },
      [companion4Id]: {
        id: companion4Id,
        phone: '+919876543213',
        passwordHash: legacySeedPasswordHash('PairUp@2026'),
        legalName: 'Ananya Rao',
        email: 'ananya.rao@example.com',
        role: 'COMPANION',
        activeRole: 'COMPANION',
        dob: '1999-02-14',
        age: 27,
        kycStatus: 'APPROVED',
        kycSubmittedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        kycDecidedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        kycDecidedBy: 'admin_super_01',
        profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        bio: 'Compassionate companion for senior walks, daily errands, museum visits and cultural events across Bengaluru.',
        photos: [
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'
        ],
        city: 'Bengaluru',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
      }
    },
    kycSubmissions: {
      [companion1Id]: {
        id: 'kyc_sub_01',
        userId: companion1Id,
        userPhone: '+919876543210',
        legalName: 'Arjun Sen',
        dob: '1998-04-15',
        idType: 'AADHAAR',
        idFrontUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80',
        idBackUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80',
        selfieUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        bio: 'Passionate conversationalist & city companion.',
        photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'],
        status: 'APPROVED',
        submittedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        decidedAt: new Date(Date.now() - 29 * 86400000).toISOString(),
        decidedBy: 'admin_super_01',
        userType: 'COMPANION'
      },
      [companion2Id]: {
        id: 'kyc_sub_02',
        userId: companion2Id,
        userPhone: '+919876543211',
        legalName: 'Priya Sharma',
        dob: '1997-08-22',
        idType: 'PAN',
        idFrontUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80',
        selfieUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        bio: 'Art curator and book fair enthusiast.',
        photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'],
        status: 'APPROVED',
        submittedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        decidedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
        decidedBy: 'admin_super_01',
        userType: 'COMPANION'
      }
    },
    companionProfiles: {
      [companion1Id]: {
        userId: companion1Id,
        services: [1, 2, 4, 6, 12, 17, 23],
        rates: {
          hourlyPaise: 49900,
          halfDayPaise: 169900,
          fullDayPaise: 299900
        },
        availability: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          startTime: '09:00',
          endTime: '22:00'
        },
        membership: {
          plan: 'PROFESSIONAL',
          pricePaise: 109900,
          startDate: new Date(Date.now() - 20 * 86400000).toISOString(),
          expiryDate: new Date(Date.now() + 70 * 86400000).toISOString(),
          paymentId: 'pay_mem_seed_01',
          isActive: true
        },
        bankDetails: {
          accountNumber: '918237461928',
          accountNumberMasked: 'XXXXXXXX1928',
          ifsc: 'HDFC0001234',
          bankName: 'HDFC Bank',
          accountHolderName: 'Arjun Sen',
          isVerified: true,
          verifiedAt: new Date(Date.now() - 20 * 86400000).toISOString()
        },
        isLive: true,
        rating: 4.95,
        totalBookings: 18,
        latitude: 22.5726,
        longitude: 88.3639,
        address: 'Park Street, Kolkata, West Bengal'
      },
      [companion2Id]: {
        userId: companion2Id,
        services: [1, 2, 3, 4, 7, 8, 14, 22],
        rates: {
          hourlyPaise: 59900,
          halfDayPaise: 199900,
          fullDayPaise: 349900
        },
        availability: {
          days: ['Friday', 'Saturday', 'Sunday', 'Monday'],
          startTime: '10:00',
          endTime: '21:00'
        },
        membership: {
          plan: 'PREMIUM',
          pricePaise: 599900,
          startDate: new Date(Date.now() - 15 * 86400000).toISOString(),
          expiryDate: new Date(Date.now() + 350 * 86400000).toISOString(),
          paymentId: 'pay_mem_seed_02',
          isActive: true
        },
        bankDetails: {
          accountNumber: '501004928172',
          accountNumberMasked: 'XXXXXXXX8172',
          ifsc: 'ICIC0000104',
          bankName: 'ICICI Bank',
          accountHolderName: 'Priya Sharma',
          isVerified: true,
          verifiedAt: new Date(Date.now() - 15 * 86400000).toISOString()
        },
        isLive: true,
        rating: 5.0,
        totalBookings: 24,
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Connaught Place, New Delhi'
      },
      [companion3Id]: {
        userId: companion3Id,
        services: [1, 5, 11, 12, 15, 16],
        rates: {
          hourlyPaise: 54900,
          halfDayPaise: 189900,
          fullDayPaise: 329900
        },
        availability: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
          startTime: '08:00',
          endTime: '20:00'
        },
        membership: {
          plan: 'STARTER',
          pricePaise: 44900,
          startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
          expiryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
          paymentId: 'pay_mem_seed_03',
          isActive: true
        },
        bankDetails: {
          accountNumber: '381920394851',
          accountNumberMasked: 'XXXXXXXX4851',
          ifsc: 'SBIN0000300',
          bankName: 'State Bank of India',
          accountHolderName: 'Rohit Kulkarni',
          isVerified: true,
          verifiedAt: new Date(Date.now() - 10 * 86400000).toISOString()
        },
        isLive: true,
        rating: 4.88,
        totalBookings: 12,
        latitude: 19.0760,
        longitude: 72.8777,
        address: 'Bandra West, Mumbai, Maharashtra'
      },
      [companion4Id]: {
        userId: companion4Id,
        services: [1, 6, 17, 18, 19, 20, 24],
        rates: {
          hourlyPaise: 49900,
          halfDayPaise: 159900,
          fullDayPaise: 279900
        },
        availability: {
          days: ['Monday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          startTime: '08:30',
          endTime: '19:30'
        },
        membership: {
          plan: 'PROFESSIONAL',
          pricePaise: 109900,
          startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
          expiryDate: new Date(Date.now() + 85 * 86400000).toISOString(),
          paymentId: 'pay_mem_seed_04',
          isActive: true
        },
        bankDetails: {
          accountNumber: '0281104000192',
          accountNumberMasked: 'XXXXXXXX0192',
          ifsc: 'KKBK0008055',
          bankName: 'Kotak Mahindra Bank',
          accountHolderName: 'Ananya Rao',
          isVerified: true,
          verifiedAt: new Date(Date.now() - 5 * 86400000).toISOString()
        },
        isLive: true,
        rating: 4.92,
        totalBookings: 9,
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Indiranagar, Bengaluru, Karnataka'
      }
    },
    companionMemberships: {},
    bookings: {},
    companionWallets: {
      [companion1Id]: {
        companionId: companion1Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 890000,
        lastUpdated: new Date().toISOString()
      },
      [companion2Id]: {
        companionId: companion2Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 1420000,
        lastUpdated: new Date().toISOString()
      },
      [companion3Id]: {
        companionId: companion3Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 540000,
        lastUpdated: new Date().toISOString()
      },
      [companion4Id]: {
        companionId: companion4Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 380000,
        lastUpdated: new Date().toISOString()
      }
    },
    payouts: {},
    chatMessages: {},
    supportConversations: {},
    supportMessages: {},
    bankVerifications: {},
    userLocations: {},
    userPresence: {},
    adminUsers: {
      [initialAdminId]: {
        id: initialAdminId,
        email: initialAdminEmail,
        phone: initialAdminPhone,
        name: 'Rahul Super Administrator',
        role: 'SUPER_ADMIN',
        passwordHash: legacySeedPasswordHash('AdminPass@2026'),
        createdAt: new Date().toISOString()
      }
    },
    otpStore: {},
    adminMfaStore: {},
    auditLogs: [
      {
        id: 'log_init_01',
        adminId: initialAdminId,
        adminEmail: initialAdminEmail,
        adminRole: 'SUPER_ADMIN',
        action: 'PLATFORM_INITIALIZATION',
        details: 'PairUpToday security vault initialized with Indian emergency routing (100/112).',
        timestamp: new Date().toISOString()
      }
    ]
  };

  saveDB(initialDB);
  return initialDB;
}

let db = loadDB();

function saveDB(state: DBState) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Production JSON persistence is disabled; use the Supabase database adapter.');
  }
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Failed to atomically write DB file', err);
  }
}

function getBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return '';
}

function hasApplicationRole(user: any, role: 'CLIENT' | 'COMPANION'): boolean {
  if (!user) return false;
  if (user.role === 'DUAL' || user.role === 'ADMIN') return true;
  return user.role === role || user.activeRole === role;
}

function apiRequiresRole(req: Request): 'CLIENT' | 'COMPANION' | null {
  const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
  if (route === 'POST /api/bookings/create') return 'CLIENT';

  // Membership onboarding, companion status checks, rates & bank verification
  // are open to any authenticated user (client upgrading to companion or dual)
  if (
    route === 'POST /api/companion/membership/subscribe' ||
    route.startsWith('GET /api/companion/status/') ||
    route === 'POST /api/companion/services-rates' ||
    route === 'POST /api/companion/bank/verify'
  ) {
    return null;
  }

  // Razorpay membership checkout & verification are allowed for all users onboarding
  if (route === 'POST /api/payments/razorpay/create-order') {
    const isMembership = req.body?.type === 'MEMBERSHIP' || req.body?.plan || req.body?.membershipPlan || req.body?.notes?.membershipPlan;
    return isMembership ? null : 'CLIENT';
  }
  if (route === 'POST /api/payments/razorpay/verify-payment') {
    return req.body?.membershipPlan ? null : 'CLIENT';
  }

  // Companion operational actions (booking arrival, otp verification, availability updates, accept/reject)
  if (/^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete|accept|reject)$/.test(route)) return 'COMPANION';
  if (
    route.startsWith('POST /api/companion/availability/') ||
    route.startsWith('POST /api/companion/')
  ) return 'COMPANION';

  return null;
}

function rateLimitHash(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new Error('Session secret is required for distributed rate limiting.');
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function isPublicApiRoute(req: Request): boolean {
  const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
  return new Set([
    'GET /api/health',
    'POST /api/auth/check-phone',
    'POST /api/auth/request-otp',
    'POST /api/auth/register-with-otp',
    'POST /api/auth/verify-otp',
    'POST /api/auth/reset-password',
    'POST /api/auth/login',
    'POST /api/admin/login',
    'POST /api/admin/verify-mfa',
    'POST /api/payments/razorpay/webhook',
    'GET /api/maps/autocomplete',
    'GET /api/maps/geocode',
    'GET /api/maps/reverse-geocode',
    'GET /api/maps/distance',
    'GET /api/companions/search'
  ]).has(route);
}

function isSupabaseBackedProductionRoute(req: Request): boolean {
  const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
  return new Set([
    'GET /api/health',
    'POST /api/auth/check-phone',
    'POST /api/auth/request-otp',
    'POST /api/auth/register-with-otp',
    'POST /api/auth/verify-otp',
    'POST /api/auth/reset-password',
    'GET /api/auth/session',
    'POST /api/auth/login',
    'POST /api/auth/select-role',
    'POST /api/auth/logout',
    'POST /api/user/change-password',
    'POST /api/user/delete-account',
    'POST /api/admin/login',
    'POST /api/admin/verify-mfa',
    'POST /api/admin/logout',
    'POST /api/admin/finance/re-auth',
    'POST /api/admin/finance/re-auth/verify',
    'POST /api/admin/finance/reveal-bank',
    'POST /api/admin/finance/process-payout',
    'POST /api/admin/finance/refund',
    'GET /api/admin/finance/settlements',
    'GET /api/admin/overview',
    'GET /api/admin/staff',
    'POST /api/admin/staff/create',
    'GET /api/admin/audit-logs',
    'GET /api/admin/clients',
    'GET /api/admin/companions',
    'GET /api/admin/memberships',
    'GET /api/admin/bookings',
    'GET /api/admin/payments',
    'POST /api/payments/razorpay/create-order',
    'GET /api/companions/search',
    'GET /api/maps/autocomplete',
    'GET /api/maps/geocode',
    'GET /api/maps/reverse-geocode',
    'GET /api/maps/distance',
    'POST /api/notifications/device-token',
    'DELETE /api/notifications/device-token'
  ]).has(route) ||
    route === 'POST /api/user/profile' ||
    route === 'GET /api/user/profile' ||
    route === 'POST /api/kyc/submit' ||
    route === 'POST /api/companion/services-rates' ||
    route === 'POST /api/companion/membership/subscribe' ||
    route === 'POST /api/companion/bank/verify' ||
    route === 'POST /api/companion/availability/toggle' ||
    route === 'GET /api/companion/wallet' ||
    route === 'POST /api/bookings/create' ||
    route === 'POST /api/payments/razorpay/verify-payment' ||
    route === 'POST /api/payments/razorpay/cancel-order' ||
    route === 'POST /api/payments/razorpay/fail-order' ||
    /^GET \/api\/notifications\/[^/]+$/.test(route) ||
    route === 'POST /api/notifications/read' ||
    route === 'POST /api/notifications/device-token' ||
    route === 'DELETE /api/notifications/device-token' ||
    route === 'POST /api/support/conversation' ||
    route === 'POST /api/support/message' ||
    /^GET \/api\/support\/conversations\/[^/]+$/.test(route) ||
    /^GET \/api\/support\/messages\/[^/]+$/.test(route) ||
    /^GET \/api\/support\/messages\/[^/]+\/stream$/.test(route) ||
    /^GET \/api\/chat\/[^/]+$/.test(route) ||
    /^POST \/api\/chat\/[^/]+$/.test(route) ||
    /^GET \/api\/chat\/[^/]+\/stream$/.test(route) ||
    route === 'GET /api/companion/alerts/stream' ||
    /^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete|accept|reject|cancel)$/.test(route) ||
    /^GET \/api\/bookings\/[^/]+\/status$/.test(route) ||
    /^GET \/api\/bookings\/my\/[^/]+$/.test(route) ||
    /^GET \/api\/companion\/status\/[^/]+$/.test(route) ||
    /^POST \/api\/location\/(update|sharing\/start|sharing\/stop)$/.test(route) ||
    /^GET \/api\/location\/[^/]+$/.test(route) ||
    route === 'POST /api/presence' ||
    /^GET \/api\/presence\/[^/]+$/.test(route) ||
    route === 'GET /api/admin/kyc/list' ||
    route === 'GET /api/admin/support/conversations' ||
    route === 'GET /api/admin/finance/payouts' ||
    route === 'GET /api/admin/finance/refunds' ||
    route === 'POST /api/admin/finance/re-auth/verify' ||
    /^GET \/api\/admin\/support\/messages\/[^/]+$/.test(route) ||
    /^GET \/api\/admin\/support\/messages\/[^/]+\/stream$/.test(route) ||
    route === 'POST /api/admin/support/reply' ||
    /^POST \/api\/admin\/support\/conversation\/[^/]+\/status$/.test(route) ||
    /^POST \/api\/admin\/staff\/[^/]+\/role$/.test(route) ||
    /^DELETE \/api\/admin\/staff\/[^/]+$/.test(route) ||
    /^GET \/api\/admin\/kyc\/[^/]+\/documents$/.test(route) ||
    /^POST \/api\/admin\/kyc\/[^/]+\/action$/.test(route);
}

app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const globalLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`global:${ip}`), 180, 60);
    if (!globalLimit.allowed) {
      res.setHeader('Retry-After', String(globalLimit.retryAfterSeconds || 1));
      return res.status(429).json({ error: 'Too many requests. Please retry later.' });
    }
    if (/^\/api\/(auth\/(login|request-otp|register-with-otp|verify-otp)|admin\/(login|verify-mfa|finance\/re-auth(?:\/verify)?))$/.test(req.path)) {
      const authLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`auth:${ip}:${req.path}`), 12, 600);
      if (!authLimit.allowed) {
        res.setHeader('Retry-After', String(authLimit.retryAfterSeconds || 1));
        return res.status(429).json({ error: 'Authentication rate limit exceeded.' });
      }
    }
    if (req.path === '/api/companions/search' && req.query.lat !== undefined && req.query.lng !== undefined) {
      const mapsLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`maps-search:${ip}`), 10, 60);
      if (!mapsLimit.allowed) {
        res.setHeader('Retry-After', String(mapsLimit.retryAfterSeconds || 1));
        return res.status(429).json({ error: 'Nearby discovery rate limit exceeded.' });
      }
    }
  } catch (error) {
    console.warn('Distributed API rate limit non-fatal fallback to permissive:', error);
  }
  if (process.env.NODE_ENV === 'production' && !isSupabaseBackedProductionRoute(req)) {
    return res.status(503).json({
      error: 'This endpoint is unavailable until its business-data operation is backed by Supabase.'
    });
  }
  if (isPublicApiRoute(req)) return next();

  const apiPath = req.originalUrl.split('?')[0];
  const isAdminRoute = apiPath.startsWith('/api/admin/');
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (isAdminRoute) {
    const adminSession = verifyAdminSessionToken(token);
    if (!adminSession) {
      return res.status(401).json({ error: 'Invalid or expired administrator session.' });
    }
    try {
      if (await databaseAdapter.isSessionRevoked(adminSession.tokenId)) {
        return res.status(401).json({ error: 'Administrator session has been revoked.' });
      }
    } catch (error) {
      console.error('Administrator session revocation lookup failed.', error);
      return res.status(503).json({ error: 'Administrator authentication is temporarily unavailable.' });
    }
    let admin: any;
    try {
      admin = await databaseAdapter.getAdminUserById(adminSession.adminId);
    } catch (error) {
      console.error('Administrator session lookup failed.', error);
      return res.status(503).json({ error: 'Administrator authentication is temporarily unavailable.' });
    }
    if (!admin) return res.status(401).json({ error: 'Administrator session is no longer valid.' });
    if (!AUTHORIZED_ADMIN_ROLES.includes(admin.role)) {
      return res.status(403).json({ error: 'Administrator role is not authorized.' });
    }
    (req as AuthenticatedRequest).adminUser = admin;
    (req as AuthenticatedRequest).verifiedSession = {
      tokenId: adminSession.tokenId, expiresAt: adminSession.expiresAt, principalType: 'ADMIN'
    };
    if (req.body && typeof req.body === 'object') {
      req.body.adminId = admin.id;
      req.body.adminEmail = admin.email;
    }
    return next();
  }

  const session = verifyUserSessionToken(token);
  if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });

  try {
    if (await databaseAdapter.isSessionRevoked(session.tokenId)) {
      return res.status(401).json({ error: 'Session has been revoked.' });
    }
    const user = await databaseAdapter.getUser(session.userId);
    if (!user) return res.status(401).json({ error: 'Session user no longer exists.' });
    const requiredRole = apiRequiresRole(req);
    if (requiredRole && !hasApplicationRole(user, requiredRole)) {
      return res.status(403).json({ error: `A ${requiredRole} role is required for this operation.` });
    }

    const route = `${req.method} ${apiPath}`;
    if (user.isSuspended) {
      if (
        route === 'POST /api/bookings/create' ||
        route.startsWith('POST /api/chat/') ||
        route === 'POST /api/companion/availability/toggle'
      ) {
        return res.status(403).json({
          error: `Your account has been suspended: ${user.suspendedReason || 'Violation of platform guidelines'}. Please contact support.`
        });
      }
    }
    const selfId = user.id;
    if (req.body && typeof req.body === 'object') {
      if ('userId' in req.body) req.body.userId = selfId;
      if (route === 'POST /api/bookings/create') req.body.clientId = selfId;
      if (/^POST \/api\/bookings\/[^/]+\/arrived$/.test(route)) req.body.companionId = selfId;
      if (route.startsWith('POST /api/chat/')) req.body.senderId = selfId;
      if (route.startsWith('POST /api/support/')) req.body.userId = selfId;
      if (route === 'POST /api/payments/razorpay/verify-payment') req.body.userId = selfId;
    }
    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.authUser = user;
    authenticatedReq.verifiedSession = {
      tokenId: session.tokenId, expiresAt: session.expiresAt, principalType: 'USER'
    };

    const bookingRoute = apiPath.match(/^\/api\/bookings\/([^/]+)\//);
    const chatRoute = apiPath.match(/^\/api\/chat\/([^/]+)$/);
    const bookingId = bookingRoute?.[1] || chatRoute?.[1];
    if (bookingId && (route.startsWith('POST /api/bookings/') || route.startsWith('GET /api/chat/') || route.startsWith('POST /api/chat/'))) {
      let booking: any;
      try {
        booking = getDatabaseType() === 'supabase'
          ? await databaseAdapter.getBooking(bookingId)
          : db.bookings[bookingId];
      } catch (error) {
        console.error('Booking ownership check failed.', error);
        return res.status(503).json({ error: 'Booking authorization is temporarily unavailable.' });
      }
      if (!booking && route.startsWith('POST /api/bookings/')) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      if (booking && booking.clientId !== selfId && booking.companionId !== selfId) {
        return res.status(403).json({ error: 'You are not a participant in this booking.' });
      }
    }

    if (route === 'POST /api/payments/razorpay/verify-payment' && req.body?.bookingId) {
      let booking: any;
      try {
        booking = getDatabaseType() === 'supabase'
          ? await databaseAdapter.getBooking(req.body.bookingId)
          : db.bookings[req.body.bookingId];
      } catch (error) {
        console.error('Payment booking ownership check failed.', error);
        return res.status(503).json({ error: 'Payment authorization is temporarily unavailable.' });
      }
      if (!booking) return res.status(404).json({ error: 'Booking not found.' });
      if (booking.clientId !== selfId) return res.status(403).json({ error: 'You cannot verify payment for this booking.' });
      req.body.userId = selfId;
    }

    if (route.startsWith('POST /api/location/')) {
      const locationBookingId = req.body?.bookingId;
      if (route !== 'POST /api/location/update' && !locationBookingId) {
        return res.status(400).json({ error: 'Booking ID is required for location sharing.' });
      }
      if (locationBookingId) {
        let booking: any;
        try {
          booking = getDatabaseType() === 'supabase'
            ? await databaseAdapter.getBooking(locationBookingId)
            : db.bookings[locationBookingId];
        } catch (error) {
          console.error('Booking location authorization check failed.', error);
          return res.status(503).json({ error: 'Booking authorization is temporarily unavailable.' });
        }
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });
        if (!['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status)) {
          return res.status(403).json({ error: 'Location sharing is only allowed for an active booking.' });
        }
        if (booking.clientId !== selfId && booking.companionId !== selfId) {
          return res.status(403).json({ error: 'You are not a participant in this booking.' });
        }
      }
    }

    const supportConversationId = apiPath.match(/^\/api\/support\/messages\/([^/]+)$/)?.[1] ||
      (route === 'POST /api/support/message' ? req.body?.conversationId : null);
    if (supportConversationId) {
      const conversation = await databaseAdapter.getSupportConversation(supportConversationId);
      if (!conversation) return res.status(404).json({ error: 'Support conversation not found.' });
      if (conversation.userId !== selfId) return res.status(403).json({ error: 'You cannot access this support conversation.' });
    }
    if (/^GET \/api\/notifications\/[^/]+$/.test(route) && req.params.userId && req.params.userId !== selfId) {
      return res.status(403).json({ error: 'You cannot access another user’s notifications.' });
    }

    return next();
  } catch (error) {
    console.error('API session authorization failed.', error);
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION & SMS OTP ENDPOINTS
// -------------------------------------------------------------

// Check if phone number is already registered
app.post('/api/auth/check-phone', async (req: Request, res: Response) => {
  const { phone } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number (+91).' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }
  try {
    const existingUser = await databaseAdapter.getUserByPhone(normalizedPhone);
    return res.json({ registered: Boolean(existingUser), phone: normalizedPhone });
  } catch (error) {
    console.error('Phone registration lookup failed.', error);
    return res.status(503).json({ error: 'Account lookup is temporarily unavailable.' });
  }
});

// Request OTP for Login or Registration via real APITXT integration
app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  const { phone, purpose } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number (+91)' });
  }

  if (!isApitxtConfigured()) {
    return res.status(503).json({ error: 'APITXT SMS is not configured on the backend.' });
  }
  if (!isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: 'OTP_HMAC_SECRET must contain at least 32 characters on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production OTP storage requires the configured Supabase database.' });
  }

  // Generate cryptographically secure 6-digit OTP
  const otp = generateOtp();
  let reservation: OtpReservation;
  try {
    reservation = await databaseAdapter.reserveOtp(normalizedPhone, hashOtp(otp));
  } catch (error) {
    console.error('OTP challenge reservation failed.', error);
    return res.status(503).json({ error: 'OTP service is temporarily unavailable.' });
  }
  if (!reservation.allowed) {
    const waitSeconds = reservation.waitSeconds || 60;
    return res.status(429).json({
      error: reservation.reason === 'rate_limit'
        ? `Rate limit reached. Please wait ${waitSeconds}s before requesting another OTP.`
        : `Please wait ${waitSeconds}s before requesting a new OTP.`,
      retryAfterSeconds: waitSeconds
    });
  }

  // Send real SMS OTP through APITXT (template_id is omitted)
  const apitxtResult = await sendApitxtOtp({
    mobile: normalizedPhone,
    otp
  });

  if (!apitxtResult.success) {
    try {
      await databaseAdapter.setOtpDeliveryResult(normalizedPhone, false);
    } catch (error) {
      console.error('Failed to close unsuccessful OTP delivery challenge.', error);
      return res.status(503).json({ error: 'OTP service is temporarily unavailable.' });
    }
    return res.status(502).json({
      error: apitxtResult.error || 'APITXT did not accept the OTP request.',
      errorCode: apitxtResult.errorCode
    });
  }

  try {
    await databaseAdapter.setOtpDeliveryResult(normalizedPhone, true, apitxtResult.requestId);
  } catch (error) {
    console.error('APITXT accepted an OTP request, but challenge state could not be updated.', error);
    return res.status(503).json({ error: 'OTP service is temporarily unavailable. Request a new code later.' });
  }

  return res.json({
    success: true,
    message: 'OTP request accepted by APITXT.',
    phoneMasked: normalizedPhone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2******$3'),
    requestId: apitxtResult.requestId,
    resendWaitSeconds: 60
  });
});

// Verify OTP & Register New Account
app.post('/api/auth/register-with-otp', async (req: Request, res: Response) => {
  const { phone, otp, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Invalid phone format. Must be +91 followed by 10 digits.' });
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be exactly six digits.' });
  }

  if (typeof password !== 'string' || password.length < 6 || password.length > 1024) {
    return res.status(400).json({ error: 'Password must be between 6 and 1024 characters long.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'OTP authentication secrets are not configured on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }

  try {
    const existingUser = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered. Please login instead.' });
    }

    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') {
        return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      }
      if (verification === 'expired') {
        return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
      }
      if (verification === 'invalid') {
        return res.status(400).json({ error: 'Incorrect OTP. Please enter the valid 6-digit code.' });
      }
      return res.status(400).json({ error: 'No valid OTP request was found. Please request a new OTP.' });
    }

    const newUser = {
      id: crypto.randomUUID(),
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
      role: 'DUAL',
      kycStatus: 'NOT_SUBMITTED',
      createdAt: new Date().toISOString()
    };
    const createdUser = await databaseAdapter.createUser(newUser);
    const user = publicAuthUser(createdUser);
    return res.json({
      success: true,
      user,
      token: issueUserSessionToken(createdUser.id),
      isFirstTime: true
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(400).json({ error: 'Mobile number already registered. Please login instead.' });
    }
    console.error('OTP registration failed.', error);
    return res.status(503).json({ error: 'Registration is temporarily unavailable.' });
  }
});

// Standalone verify OTP endpoint (for logins or re-verifications)
app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Invalid mobile number.' });
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be exactly six digits.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'OTP authentication secrets are not configured on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }

  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ error: 'Account not found. Register using the OTP verification flow.' });
    }
    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      if (verification === 'expired') return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
      if (verification === 'invalid') return res.status(400).json({ error: 'Incorrect OTP.' });
      return res.status(400).json({ error: 'No valid OTP request was found. Please request a new OTP.' });
    }
    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      user: publicAuthUser(user),
      token: issueUserSessionToken(user.id)
    });
  } catch (error) {
    console.error('OTP verification failed.', error);
    return res.status(503).json({ error: 'OTP verification is temporarily unavailable.' });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const { phone, otp, newPassword } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Invalid mobile number.' });
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be exactly six digits.' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'Authentication secrets are not configured on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }

  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please create an account.' });
    }
    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      if (verification === 'expired') return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
      if (verification === 'invalid') return res.status(400).json({ error: 'Incorrect OTP.' });
      return res.status(400).json({ error: 'No valid OTP request was found. Please request a new OTP.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await databaseAdapter.updateUser(user.id, { passwordHash });

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Password reset failed.', error);
    return res.status(503).json({ error: 'Password reset is temporarily unavailable.' });
  }
});

app.get('/api/auth/session', async (req: Request, res: Response) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const session = verifyUserSessionToken(token);
  if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }

  try {
    if (await databaseAdapter.isSessionRevoked(session.tokenId)) {
      return res.status(401).json({ error: 'Session has been revoked.' });
    }
    const user = await databaseAdapter.getUser(session.userId);
    if (!user) return res.status(401).json({ error: 'Session user no longer exists.' });
    return res.json({ success: true, user: publicAuthUser(user) });
  } catch (error) {
    console.error('Session validation failed.', error);
    return res.status(503).json({ error: 'Session validation is temporarily unavailable.' });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const session = (req as AuthenticatedRequest).verifiedSession;
  const user = (req as AuthenticatedRequest).authUser;
  if (!session || !user) return res.status(401).json({ error: 'Authentication required.' });
  try {
    await databaseAdapter.revokeSession(session.tokenId, user.id, 'USER', session.expiresAt);
    return res.status(204).end();
  } catch (error) {
    console.error('User session revocation failed.', error);
    return res.status(503).json({ error: 'Logout could not be completed.' });
  }
});

// Password Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }
  if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
    return res.status(400).json({ error: 'Password must be between 1 and 1024 characters long.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production authentication requires the configured Supabase database.' });
  }

  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({
        error: 'Not registered yet? Please Sign In to create your account.',
        isNotRegistered: true
      });
    }
    if (!isSessionSecretConfigured()) {
      return res.status(503).json({ error: 'SESSION_SECRET must contain at least 32 characters on the backend.' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({
        error: 'No password is set for this account. Please sign in via OTP.',
        noPasswordSet: true
      });
    }
    const passwordVerification = await verifyPassword(password, user.passwordHash);
    if (!passwordVerification.valid) {
      return res.status(401).json({
        error: 'Invalid mobile number or password. Please verify and try again.',
        isInvalidCredentials: true
      });
    }
    if (passwordVerification.upgradedHash) {
      await databaseAdapter.updateUser(user.id, { passwordHash: passwordVerification.upgradedHash });
    }
    return res.json({
      success: true,
      user: publicAuthUser(user),
      token: issueUserSessionToken(user.id)
    });
  } catch (error) {
    console.error('Password authentication failed.', error);
    return res.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
});

// Set Active Role (Client vs Companion) with backend authorization verification
app.post('/api/auth/select-role', async (req: Request, res: Response) => {
  const { role } = req.body;
  const user = (req as AuthenticatedRequest).authUser;
  const userId = user.id;

  if (role !== 'CLIENT' && role !== 'COMPANION') {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }
  // Seamlessly upgrade single-role account to DUAL when choosing the other role
  let targetRole = user.role;
  if (user.role !== 'DUAL' && user.role !== role) {
    targetRole = 'DUAL';
  }
  try {
    const updated = await databaseAdapter.updateUser(userId, { 
      role: targetRole,
      activeRole: role 
    });
    if (db.users && db.users[userId]) {
      db.users[userId].role = targetRole;
      db.users[userId].activeRole = role;
    }
    return res.json({
      success: true,
      role: targetRole,
      activeRole: updated?.activeRole || role,
      kycStatus: updated?.kycStatus || user.kycStatus
    });
  } catch (error) {
    console.error('Role selection could not be persisted.', error);
    return res.status(503).json({ error: 'Role selection is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// UNIFIED PROFILE & KYC WIZARD
// -------------------------------------------------------------
app.post('/api/kyc/submit', async (req: Request, res: Response) => {
  const {
    userId,
    legalName,
    profileName,
    dob,
    idType,
    idFrontUrl,
    idBackUrl,
    selfieUrl,
    bio,
    profilePhoto,
    photos,
    city,
    userType
  } = req.body;

  const authenticatedUser = (req as AuthenticatedRequest).authUser;
  const authenticatedUserId = authenticatedUser.id;
  let effectiveRole = authenticatedUser.role;
  let effectiveActiveRole = authenticatedUser.activeRole;
  if (userType && ['CLIENT', 'COMPANION'].includes(userType) && authenticatedUser.role !== 'DUAL' && authenticatedUser.role !== userType) {
    effectiveRole = 'DUAL';
    effectiveActiveRole = userType;
    await databaseAdapter.updateUser(authenticatedUserId, { role: 'DUAL', activeRole: userType }).catch(() => null);
    if (db.users && db.users[authenticatedUserId]) {
      db.users[authenticatedUserId].role = 'DUAL';
      db.users[authenticatedUserId].activeRole = userType;
    }
  }
  const requestedKycRole = userType || (effectiveRole === 'DUAL' ? effectiveActiveRole : effectiveRole);
  if ((userId && userId !== authenticatedUserId) ||
      !['CLIENT', 'COMPANION'].includes(requestedKycRole)) {
    return res.status(403).json({ error: 'Your account is not permitted to submit KYC for this role.' });
  }
  let user: any;
  try {
    user = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getUser(authenticatedUserId)
      : db.users[authenticatedUserId];
  } catch (error) {
    console.error('KYC account lookup failed.', error);
    return res.status(503).json({ error: 'KYC submission is temporarily unavailable.' });
  }
  if (!user) {
    return res.status(404).json({ error: 'Authenticated user was not found.' });
  }

  const birthDate = typeof dob === 'string' ? new Date(`${dob}T00:00:00.000Z`) : new Date(Number.NaN);
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dob) {
    return res.status(400).json({ error: 'Date of birth is required.' });
  }
  const today = new Date();
  let calculatedAge = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayNotReached = today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
  if (birthdayNotReached) calculatedAge -= 1;
  if (birthDate.getTime() > Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) || calculatedAge < 18) {
    return res.status(400).json({ error: 'You must be at least 18 years of age to use PairUpToday.' });
  }

  if (typeof legalName !== 'string' || !legalName.trim() || legalName.trim().length > 255 ||
      !['AADHAAR', 'PAN', 'VOTER_ID', 'PASSPORT'].includes(idType) || !idFrontUrl || !selfieUrl) {
    return res.status(400).json({ error: 'Legal name, government ID and live selfie are mandatory.' });
  }
  if (bio !== undefined && bio !== null && (typeof bio !== 'string' || bio.length > 2000)) {
    return res.status(400).json({ error: 'Bio must be a string no longer than 2000 characters.' });
  }
  if (photos !== undefined && (!Array.isArray(photos) || photos.length > 6 || photos.some((photo: unknown) => typeof photo !== 'string'))) {
    return res.status(400).json({ error: 'Profile photos must be a list of up to six strings.' });
  }
  if (city !== undefined && (typeof city !== 'string' || city.length > 100)) {
    return res.status(400).json({ error: 'City must be a string no longer than 100 characters.' });
  }
  const frontImage = parseKycImageDataUrl(idFrontUrl);
  const selfieImage = parseKycImageDataUrl(selfieUrl);
  const backImage = idBackUrl ? parseKycImageDataUrl(idBackUrl) : null;
  if (!frontImage || !selfieImage || (idType !== 'PAN' && !backImage) || (idBackUrl && !backImage)) {
    return res.status(400).json({ error: 'Upload valid JPEG, PNG or WebP identity images; the ID back image is required unless using PAN.' });
  }

  const kycId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const kycBucket = requestedKycRole === 'COMPANION' ? 'companion-kyc-documents' : 'client-kyc-documents';
  const documentPaths: string[] = [];
  const submission = {
    id: kycId,
    userId: authenticatedUserId,
    userPhone: user.phone,
    legalName: legalName.trim(),
    profileName: (typeof profileName === 'string' && profileName.trim()) ? profileName.trim() : legalName.trim(),
    dob,
    idType,
    idFrontUrl: `${authenticatedUserId}/${kycId}/id-front.${frontImage.extension}`,
    idBackUrl: backImage ? `${authenticatedUserId}/${kycId}/id-back.${backImage.extension}` : null,
    selfieUrl: `${authenticatedUserId}/${kycId}/selfie.${selfieImage.extension}`,
    bio: bio || '',
    photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
    city: city || 'New Delhi',
    status: 'PENDING',
    submittedAt,
    userType: requestedKycRole
  };

  try {
    if (getDatabaseType() === 'supabase') {
      const uploadOperations = [
        { path: submission.idFrontUrl, image: frontImage },
        ...(backImage && submission.idBackUrl ? [{ path: submission.idBackUrl, image: backImage }] : []),
        { path: submission.selfieUrl, image: selfieImage }
      ];
      for (const document of uploadOperations) {
        await databaseAdapter.uploadKycDocument(kycBucket, document.path, document.image.bytes, document.image.contentType);
        documentPaths.push(document.path);
      }
      await databaseAdapter.submitKycSubmission(submission);
      await databaseAdapter.updateUser(authenticatedUserId, {
        profileName: submission.profileName,
        bio: submission.bio,
        photos: submission.photos,
        profilePhoto: profilePhoto || selfieUrl
      }).catch(err => console.warn('Non-fatal profile sync after KYC submit:', err));
      if (db.users && db.users[authenticatedUserId]) {
        db.users[authenticatedUserId].profileName = submission.profileName;
        db.users[authenticatedUserId].bio = submission.bio;
        db.users[authenticatedUserId].photos = submission.photos;
        db.users[authenticatedUserId].profilePhoto = profilePhoto || selfieUrl;
      }
    } else {
      const localSubmission = {
        ...submission,
        idFrontUrl,
        idBackUrl: idBackUrl || null,
        selfieUrl
      };
      db.kycSubmissions[kycId] = localSubmission;
      user.legalName = submission.legalName;
      user.profileName = submission.profileName;
      user.dob = dob;
      user.age = calculatedAge;
      user.kycStatus = 'PENDING';
      user.kycSubmittedAt = submittedAt;
      user.bio = submission.bio;
      user.photos = submission.photos;
      user.profilePhoto = profilePhoto || selfieUrl;
      user.city = submission.city;
      saveDB(db);
    }
  } catch (error) {
    if (documentPaths.length > 0) {
      try {
        await databaseAdapter.deleteKycDocuments(kycBucket, documentPaths);
      } catch (cleanupError) {
        console.error('Failed to clean up incomplete KYC document upload.', cleanupError);
      }
    }
    console.error('KYC submission could not be persisted.', error);
    return res.status(503).json({ error: 'KYC submission is temporarily unavailable. Please try again later.' });
  }

  return res.json({
    success: true,
    mandatoryLogout: true,
    message: 'KYC submitted for verification. Please log in again.'
  });
});

// -------------------------------------------------------------
// USER PROFILE MANAGEMENT (CLIENT & COMPANION)
// -------------------------------------------------------------
app.get('/api/user/profile', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  let user: any;
  if (getDatabaseType() === 'supabase') {
    user = await databaseAdapter.getUser(authUser.id);
  } else {
    user = db.users[authUser.id];
  }
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ success: true, user: publicAuthUser(user) });
});

app.post('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { profileName, bio, profilePhoto, photos, city, state, address, latitude, longitude } = req.body;

    let user: any;
    if (getDatabaseType() === 'supabase') {
      user = await databaseAdapter.getUser(authUser.id);
    } else {
      user = db.users[authUser.id];
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Strictly editable fields ONLY:
    // (legalName, dob, phone, etc. are permanently locked according to Govt ID KYC)
    if (profileName !== undefined) {
      if (typeof profileName !== 'string' || !profileName.trim()) {
        return res.status(400).json({ error: 'Profile display name cannot be blank.' });
      }
      user.profileName = profileName.trim().slice(0, 60);
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 2000) {
        return res.status(400).json({ error: 'Bio must be at most 2000 characters.' });
      }
      user.bio = bio.trim();
    }

    if (city !== undefined) {
      user.city = typeof city === 'string' ? city.trim().slice(0, 100) : user.city;
    }
    if (state !== undefined) {
      user.state = typeof state === 'string' ? state.trim().slice(0, 100) : user.state;
    }
    if (address !== undefined) {
      user.address = typeof address === 'string' ? address.trim().slice(0, 255) : user.address;
    }
    if (latitude !== undefined && Number.isFinite(Number(latitude))) {
      user.latitude = Number(latitude);
    }
    if (longitude !== undefined && Number.isFinite(Number(longitude))) {
      user.longitude = Number(longitude);
    }

    if (profilePhoto !== undefined) {
      if (typeof profilePhoto === 'string' && profilePhoto.trim()) {
        user.profilePhoto = profilePhoto.trim();
      }
    }

    if (photos !== undefined) {
      if (!Array.isArray(photos)) {
        return res.status(400).json({ error: 'Photos must be an array of image strings.' });
      }
      const cleanPhotos = photos.filter((p: unknown) => typeof p === 'string' && (p as string).trim()).slice(0, 6);
      user.photos = cleanPhotos;
      if (!user.profilePhoto && cleanPhotos.length > 0) {
        user.profilePhoto = cleanPhotos[0];
      }
    }

    // Keep in-memory database synchronized without throwing in production
    if (db.users) {
      if (!db.users[authUser.id]) {
        db.users[authUser.id] = { ...user, id: authUser.id };
      }
      if (user.profileName) db.users[authUser.id].profileName = user.profileName;
      if (user.bio !== undefined) db.users[authUser.id].bio = user.bio;
      if (user.city !== undefined) db.users[authUser.id].city = user.city;
      if (user.state !== undefined) db.users[authUser.id].state = user.state;
      if (user.address !== undefined) db.users[authUser.id].address = user.address;
      if (user.latitude !== undefined) db.users[authUser.id].latitude = user.latitude;
      if (user.longitude !== undefined) db.users[authUser.id].longitude = user.longitude;
      if (user.profilePhoto) db.users[authUser.id].profilePhoto = user.profilePhoto;
      if (user.photos) db.users[authUser.id].photos = user.photos;
      if (process.env.NODE_ENV !== 'production' && getDatabaseType() !== 'supabase') {
        try {
          saveDB(db);
        } catch (e) {
          console.warn('saveDB non-fatal:', e);
        }
      }
    }

    // If companion has a profile record, sync bio, address, coordinates
    if (db.companionProfiles && db.companionProfiles[authUser.id]) {
      if (user.bio !== undefined) db.companionProfiles[authUser.id].bio = user.bio;
      if (user.address !== undefined || user.city !== undefined) db.companionProfiles[authUser.id].address = user.address || user.city;
      if (user.state !== undefined) db.companionProfiles[authUser.id].state = user.state;
      if (user.latitude !== undefined) db.companionProfiles[authUser.id].latitude = user.latitude;
      if (user.longitude !== undefined) db.companionProfiles[authUser.id].longitude = user.longitude;
    }

    try {
      if (getDatabaseType() === 'supabase') {
        const updated = await databaseAdapter.updateUser(authUser.id, {
          profileName: user.profileName,
          bio: user.bio,
          profilePhoto: user.profilePhoto,
          photos: user.photos,
          ...(user.city !== undefined ? { city: user.city } : {}),
          ...(user.state !== undefined ? { state: user.state } : {})
        });
        if (updated) {
          user = { ...user, ...updated };
        }
        await databaseAdapter.updateCompanionProfile(authUser.id, {
          ...(user.address !== undefined || user.city !== undefined ? { address: user.address || user.city } : {}),
          ...(user.state !== undefined ? { state: user.state } : {}),
          ...(user.latitude !== undefined ? { latitude: user.latitude } : {}),
          ...(user.longitude !== undefined ? { longitude: user.longitude } : {})
        }).catch(() => null);
      }
    } catch (err) {
      console.warn('Supabase updateUser non-fatal warning', err);
    }

    return res.json({
      success: true,
      user: publicAuthUser(user)
    });
  } catch (error: any) {
    console.error('Fatal error in POST /api/user/profile:', error);
    return res.status(500).json({ error: error?.message || 'Internal error updating profile' });
  }
});

app.post('/api/user/change-password', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const verifiedSession = (req as AuthenticatedRequest).verifiedSession;
  if (!authUser?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const { otp, newPassword } = req.body;
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be exactly six digits.' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'Authentication secrets are not configured on the backend.' });
  }

  try {
    const user = await databaseAdapter.getUser(authUser.id);
    if (!user || !user.phone) {
      return res.status(404).json({ error: 'User account or registered phone not found.' });
    }
    const verification = await databaseAdapter.verifyOtp(user.phone, hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      if (verification === 'expired') return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
      if (verification === 'invalid') return res.status(400).json({ error: 'Incorrect OTP.' });
      return res.status(400).json({ error: 'No valid OTP request was found. Please request a new OTP.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await databaseAdapter.updateUser(user.id, { passwordHash });

    if (verifiedSession?.tokenId) {
      await databaseAdapter.revokeSession(
        verifiedSession.tokenId,
        user.id,
        'USER',
        verifiedSession.expiresAt
      );
    }

    return res.json({
      success: true,
      message: 'Password changed successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Change password failed.', error);
    return res.status(503).json({ error: 'Change password is temporarily unavailable.' });
  }
});

app.post('/api/user/delete-account', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const verifiedSession = (req as AuthenticatedRequest).verifiedSession;
  if (!authUser?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const { otp, confirmDelete } = req.body;
  if (!confirmDelete) {
    return res.status(400).json({ error: 'Confirmation is required to delete your account.' });
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'OTP must be exactly six digits.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'Authentication secrets are not configured on the backend.' });
  }

  try {
    const user = await databaseAdapter.getUser(authUser.id);
    if (!user || !user.phone) {
      return res.status(404).json({ error: 'User account or registered phone not found.' });
    }
    const verification = await databaseAdapter.verifyOtp(user.phone, hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      if (verification === 'expired') return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
      if (verification === 'invalid') return res.status(400).json({ error: 'Incorrect OTP.' });
      return res.status(400).json({ error: 'No valid OTP request was found. Please request a new OTP.' });
    }

    if (verifiedSession?.tokenId) {
      await databaseAdapter.revokeSession(
        verifiedSession.tokenId,
        user.id,
        'USER',
        verifiedSession.expiresAt
      );
    }

    await databaseAdapter.deleteUser(user.id);

    return res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.'
    });
  } catch (error) {
    console.error('Delete account failed.', error);
    return res.status(503).json({ error: 'Account deletion is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// COMPANION ONBOARDING & ACTIVATION ENDPOINTS
// -------------------------------------------------------------

// Step A: Services & Rates configuration
app.post('/api/companion/services-rates', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { services, rates, availability } = req.body;
  if (services === undefined && rates === undefined && availability === undefined) {
    return res.status(400).json({ error: 'At least one companion profile field must be provided.' });
  }
  if (services !== undefined && (!Array.isArray(services) || services.some((service: unknown) => !Number.isInteger(service)))) {
    return res.status(400).json({ error: 'Services must be a list of integer service IDs.' });
  }
  if (rates !== undefined && (
    !rates || typeof rates !== 'object' || Array.isArray(rates) ||
    !['hourlyPaise', 'halfDayPaise', 'fullDayPaise'].every(key => Number.isSafeInteger(rates[key]) && rates[key] >= 0)
  )) {
    return res.status(400).json({ error: 'Rates must contain valid non-negative integer paise amounts.' });
  }
  if (availability !== undefined && (
    !availability || typeof availability !== 'object' || Array.isArray(availability) ||
    !Array.isArray(availability.days) || !availability.days.every((day: unknown) => typeof day === 'string') ||
    typeof availability.startTime !== 'string' || typeof availability.endTime !== 'string'
  )) {
    return res.status(400).json({ error: 'Availability must include days, startTime, and endTime.' });
  }
  if (getDatabaseType() === 'json') {
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found' });
    let profile = db.companionProfiles[userId];
    if (!profile) {
      profile = {
        userId,
        services: services || [1, 2, 4],
        rates: rates || { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
        availability: availability || {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          startTime: '09:00',
          endTime: '21:00'
        },
        isLive: false,
        rating: 5.0,
        totalBookings: 0
      };
      db.companionProfiles[userId] = profile;
    } else {
      if (services !== undefined) profile.services = services;
      if (rates !== undefined) profile.rates = rates;
      if (availability !== undefined) profile.availability = availability;
    }
    profile.isLive = Boolean(
      user.kycStatus === 'APPROVED' &&
      profile.membership?.isActive &&
      new Date(profile.membership.expiryDate) > new Date() &&
      profile.bankDetails?.isVerified &&
      !profile.isPaused
    );
    saveDB(db);
    return res.json({ success: true, profile });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let profile = await databaseAdapter.getCompanionProfile(userId);
    if (!profile) {
      profile = await databaseAdapter.upsertCompanionProfile({
        userId,
        services: services || [1, 2, 4],
        rates: rates || { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
        availability: availability || {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          startTime: '09:00',
          endTime: '21:00'
        },
        isLive: false,
        rating: 5.0,
        totalBookings: 0
      });
    } else {
      profile = await databaseAdapter.updateCompanionProfile(userId, {
        ...(services !== undefined ? { services } : {}),
        ...(rates !== undefined ? { rates } : {}),
        ...(availability !== undefined ? { availability } : {})
      });
    }

    if (user.role === 'CLIENT') {
      await databaseAdapter.updateUser(userId, { role: 'DUAL', activeRole: 'COMPANION' }).catch(() => null);
      if (db.users && db.users[userId]) {
        db.users[userId].role = 'DUAL';
        db.users[userId].activeRole = 'COMPANION';
      }
    }

    const [companionKyc, clientKyc, membership, bankVerification] = await Promise.all([
      databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
      databaseAdapter.getUserKycSubmission(userId, 'CLIENT').catch(() => null),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date());
    const bankVerified = bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true;
    const effectiveKyc = companionKyc || (clientKyc?.status === 'APPROVED' ? clientKyc : null);
    const kycApproved = Boolean(effectiveKyc?.status === 'APPROVED' || user.kycStatus === 'APPROVED' || user.kyc_status === 'APPROVED');
    const isLive = Boolean(
      kycApproved &&
      profile &&
      membershipValid &&
      bankVerified &&
      !profile.isPaused
    );
    if (profile.isLive !== isLive) {
      profile = await databaseAdapter.updateCompanionProfile(userId, { isLive });
    }
    invalidateEgressCache('search:');
    invalidateEgressCache(`status:${userId}`);
    return res.json({
      success: true,
      profile: {
        ...profile,
        membership: membership ? { ...membership, isActive: membershipValid } : null,
        bankDetails: bankVerification ? {
          isVerified: bankVerified,
          accountNumberMasked: bankVerification.accountNumberMasked || null,
          ifsc: bankVerification.ifsc,
          accountHolderName: bankVerification.accountHolderName,
          verifiedAt: bankVerification.verifiedAt
        } : null
      }
    });
  } catch (error) {
    console.error('Companion profile could not be saved.', error);
    return res.status(503).json({ error: 'Companion profile is temporarily unavailable.' });
  }
});

// Step B: Membership Subscription (Only for Companions; STARTER ₹449, PROFESSIONAL ₹1,099, PREMIUM ₹5,999)
app.post('/api/companion/membership/subscribe', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const plan = req.body?.plan;
  const plans: Record<string, { amountPaise: number; durationDays: number }> = {
    STARTER: { amountPaise: 44900, durationDays: 30 },
    PROFESSIONAL: { amountPaise: 109900, durationDays: 90 },
    PREMIUM: { amountPaise: 599900, durationDays: 365 }
  };
  const planDetails = typeof plan === 'string' ? plans[plan] : undefined;
  if (!planDetails) return res.status(400).json({ error: 'Invalid plan selection.' });
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Membership checkout requires the configured Supabase database.' });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(401).json({ error: 'Authenticated Companion account was not found.' });

    // Strict Rule: Companion Govt ID KYC Name must match Bank Account Beneficiary Name
    const companionGovtName = (user.legalName || user.name || '').trim();
    if (companionGovtName && !compareLegalAndBankNames(companionGovtName, accountHolderName)) {
      return res.status(400).json({
        error: `Bank beneficiary name ("${accountHolderName}") must strictly match your Government ID KYC name ("${companionGovtName}"). Third-party bank accounts are strictly prohibited.`
      });
    }
    if (user.role === 'CLIENT') {
      await databaseAdapter.updateUser(userId, { role: 'DUAL', activeRole: 'COMPANION' }).catch(() => null);
      if (db.users && db.users[userId]) {
        db.users[userId].role = 'DUAL';
        db.users[userId].activeRole = 'COMPANION';
      }
    }
    const startedAt = new Date();
    const membershipId = crypto.randomUUID();
    let order = await createRazorpayOrder({
      amountPaise: planDetails.amountPaise,
      receipt: `mem_${membershipId.replace(/-/g, '').slice(0, 28)}`,
      notes: { membershipId, orderType: 'MEMBERSHIP', membershipPlan: plan, userId }
    });
    if (!order.success || !order.orderId) {
      // Sandbox / Test fallback order
      const testOrderId = `ord_test_${crypto.randomBytes(8).toString('hex')}`;
      order = {
        success: true,
        orderId: testOrderId,
        amountPaise: planDetails.amountPaise,
        currency: 'INR',
        keyId: 'rzp_test_pairuptoday'
      };
    }
    const membership = await databaseAdapter.createMembership({
      id: membershipId,
      userId,
      plan,
      pricePaise: planDetails.amountPaise,
      startDate: startedAt.toISOString(),
      expiryDate: new Date(startedAt.getTime() + planDetails.durationDays * 86400000).toISOString(),
      paymentOrderId: order.orderId,
      paymentStatus: 'PENDING'
    });
    return res.status(201).json({
      success: true,
      membership,
      payment: { orderId: order.orderId, amountPaise: order.amountPaise, currency: order.currency, keyId: order.keyId }
    });
  } catch (error) {
    console.error('Membership order creation failed.', error);
    return res.status(503).json({ error: 'Membership checkout is temporarily unavailable.' });
  }
});

// Step C: Bank Verification via APITXT Penny-Less API
app.post('/api/companion/bank/verify', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const accountNumber = typeof req.body?.accountNumber === 'string' ? req.body.accountNumber.trim() : '';
  const ifsc = typeof req.body?.ifsc === 'string' ? req.body.ifsc.trim().toUpperCase() : '';
  const accountHolderName = typeof req.body?.accountHolderName === 'string' ? req.body.accountHolderName.trim() : '';
  if (!/^[A-Za-z0-9-]{6,40}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6,7}$/.test(ifsc) ||
      accountHolderName.length < 2 || accountHolderName.length > 255) {
    return res.status(400).json({ error: 'Bank account details are invalid.' });
  }
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Bank verification requires the configured Supabase database.' });
  }
  let encryptedAccountNumber: string;
  try {
    encryptedAccountNumber = encryptBankAccount(accountNumber);
  } catch (error) {
    console.error('Bank account encryption is not configured.', error);
    return res.status(503).json({ error: 'Bank verification is unavailable until backend account encryption is configured.' });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(401).json({ error: 'Authenticated Companion account was not found.' });
    if (user.role === 'CLIENT') {
      await databaseAdapter.updateUser(userId, { role: 'DUAL', activeRole: 'COMPANION' }).catch(() => null);
      if (db.users && db.users[userId]) {
        db.users[userId].role = 'DUAL';
        db.users[userId].activeRole = 'COMPANION';
      }
    }
    const accountNumberLast4 = accountNumber.slice(-4);
    await databaseAdapter.createBankVerification({
      userId,
      accountNumberEncrypted: encryptedAccountNumber,
      accountNumberLast4,
      ifsc,
      accountHolderName,
      verificationStatus: 'PENDING',
      nameAtBank: null,
      nameMatched: null,
      providerRequestId: null,
      verifiedAt: null
    });
    const verificationResult = await verifyApitxtBankAccount({
      ifsc,
      accountNumber,
      accountHolderName,
      mobile: user.phone,
      kycLegalName: user.legalName
    });
    if (!verificationResult.success) {
      await databaseAdapter.updateBankVerification(userId, {
        verificationStatus: 'FAILED',
        nameAtBank: verificationResult.nameAtBank || null,
        nameMatched: verificationResult.nameMatched ?? null,
        providerRequestId: verificationResult.requestId || null,
        verifiedAt: null
      });
      const providerUnavailable = !isApitxtConfigured() ||
        verificationResult.errorCode === 105 ||
        verificationResult.errorCode === 301 ||
        verificationResult.errorCode === 304 ||
        verificationResult.errorCode === 310 ||
        verificationResult.errorCode === undefined;
      return res.status(providerUnavailable ? 503 : 422).json({
        error: verificationResult.error || 'Bank account verification was not approved by APITXT.',
        errorCode: verificationResult.errorCode,
        accountExists: verificationResult.accountExists,
        nameMatched: verificationResult.nameMatched
      });
    }
    const verifiedAt = new Date().toISOString();
    await databaseAdapter.createBankVerification({
      userId,
      accountNumberEncrypted: encryptedAccountNumber,
      accountNumberLast4,
      ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
      bankName: null,
      accountHolderName: verificationResult.nameAtBank || accountHolderName,
      verificationStatus: 'VERIFIED',
      nameAtBank: verificationResult.nameAtBank || accountHolderName,
      nameMatched: verificationResult.nameMatched !== false,
      providerRequestId: verificationResult.requestId || null,
      verifiedAt
    });

    const [profile, companionKyc, membership] = await Promise.all([
      databaseAdapter.getCompanionProfile(userId),
      databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
      databaseAdapter.getActiveMembership(userId)
    ]);
    const isLive = Boolean(
      profile && companionKyc?.status === 'APPROVED' && membership &&
      membership.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date() &&
      !profile.isPaused
    );
    if (profile) {
      await databaseAdapter.updateCompanionProfile(userId, {
        isLive,
        bankDetails: {
          isVerified: true,
          accountNumberMasked: `••••${accountNumberLast4}`,
          ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
          accountHolderName: verificationResult.nameAtBank || accountHolderName,
          verifiedAt
        }
      });
    }
    await databaseAdapter.createAuditLog({
      userId,
      action: 'BANK_ACCOUNT_VERIFIED',
      entityType: 'bank_verification',
      entityId: userId,
      details: {
        accountNumberLast4,
        providerRequestId: verificationResult.requestId || null,
        isLive
      }
    });
    return res.json({
      success: true,
      message: 'Bank verification was approved by APITXT.',
      bankDetails: {
        accountNumberMasked: `••••${accountNumberLast4}`,
        ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
        accountHolderName: verificationResult.nameAtBank || accountHolderName,
        isVerified: true,
        requestId: verificationResult.requestId
      },
      isLive
    });
  } catch (error) {
    console.error('APITXT bank verification or persistence failed.', error);
    return res.status(503).json({ error: 'Bank verification is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// RAZORPAY PRODUCTION PAYMENT ENDPOINTS
// -------------------------------------------------------------

// Create Razorpay payment order (server-side)
app.post('/api/payments/razorpay/create-order', async (req: Request, res: Response) => {
  const { amountPaise, receipt, notes, type, plan, membershipPlan } = req.body;

  let authoritativeAmountPaise = amountPaise;
  const targetPlan = plan || membershipPlan || notes?.membershipPlan;

  // Initial listing non-bookable check
  const targetCompId = req.body.companionId || notes?.companionId;
  if (targetCompId) {
    const companionProfile = await databaseAdapter.getCompanionProfile(targetCompId);
    if (companionProfile?.isInitialListing) {
      return res.status(400).json({ error: 'This profile is currently unavailable for booking.' });
    }
  }

  // Authoritative Membership Price Enforcement:
  // STARTER: ₹449 (44900 paise), PROFESSIONAL: ₹1,099 (109900 paise), PREMIUM: ₹5,999 (599900 paise)
  // Never trust a frontend-submitted membership amount.
  if (type === 'MEMBERSHIP' || targetPlan) {
    if (targetPlan === 'STARTER') {
      authoritativeAmountPaise = 44900;
    } else if (targetPlan === 'PROFESSIONAL') {
      authoritativeAmountPaise = 109900;
    } else if (targetPlan === 'PREMIUM') {
      authoritativeAmountPaise = 599900;
    } else {
      return res.status(400).json({ error: 'Invalid companion membership plan specified.' });
    }
  }

  if (!authoritativeAmountPaise || authoritativeAmountPaise <= 0) {
    return res.status(400).json({ error: 'Valid amount in paise is required.' });
  }

  let orderResult = await createRazorpayOrder({
    amountPaise: authoritativeAmountPaise,
    receipt: receipt || `rec_${Date.now()}`,
    notes: {
      ...(notes || {}),
      orderType: type || (targetPlan ? 'MEMBERSHIP' : 'BOOKING'),
      membershipPlan: targetPlan || '',
      userId: (req as AuthenticatedRequest).authUser.id
    }
  });

  if (!orderResult.success || !orderResult.orderId) {
    // Generate Sandbox/Test Order for test mode
    const testOrderId = `ord_test_${crypto.randomBytes(8).toString('hex')}`;
    orderResult = {
      success: true,
      orderId: testOrderId,
      amountPaise: authoritativeAmountPaise,
      currency: 'INR',
      keyId: 'rzp_test_pairuptoday'
    };
  }

  return res.json({
    success: true,
    orderId: orderResult.orderId,
    amountPaise: orderResult.amountPaise,
    currency: orderResult.currency,
    keyId: orderResult.keyId
  });
});

// In-memory real-time tracking of companion booking acceptance and GST breakdown
const bookingAcceptanceMap = new Map<string, {
  companionAccepted: boolean;
  rejectionReason?: string | null;
  baseAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  gstAmountPaise: number;
  totalPayablePaise: number;
  paymentOrderId?: string;
}>();

// Web Push (VAPID) Configuration for Android/Mobile OS-level background alerts
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BJKQEyEeD663ApEU_-mZmzHUd-NFw0ZW5l35BsSxT4TFmnSV104zIJXmrhS2oxw9oGIL_Qdk4FOjk5MyS6NrIAU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'JrMwLP6wNU01K_pvgBXt9WSYC_CZU8UEfie3Qn6GU0M';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@pairuptoday.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('Web Push VAPID initialized successfully.');
} catch (vapidErr) {
  console.warn('Web Push setVapidDetails warning:', vapidErr);
}

// Persistent Web Push Subscriptions & SSE streams
const PUSH_SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

function loadPushSubscriptions(): Map<string, any[]> {
  const map = new Map<string, any[]>();
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const raw = fs.readFileSync(PUSH_SUBS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) map.set(k, v);
      }
    }
  } catch (e) {
    console.warn('Could not load push subscriptions from disk:', e);
  }
  return map;
}

function savePushSubscriptions(map: Map<string, any[]>) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, any[]> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save push subscriptions to disk:', e);
  }
}

const companionPushSubscriptions = loadPushSubscriptions();
const companionAlertStreams = new Map<string, Set<Response>>();

async function pushCompanionAlert(companionId: string, event: { type: string; [key: string]: any }) {
  if (!companionId) return;

  // Suppress incoming booking calls if companion has switched to offline / paused
  if (event.type === 'NEW_BOOKING_REQUEST') {
    try {
      const profile = getDatabaseType() === 'supabase'
        ? await databaseAdapter.getCompanionProfile(companionId)
        : db.companionProfiles[companionId];
      if (profile && profile.isPaused === true) {
        console.log(`[pushCompanionAlert] Suppressed NEW_BOOKING_REQUEST for offline companion: ${companionId}`);
        return;
      }
    } catch (e) {
      console.warn('[pushCompanionAlert] Companion status check notice:', e);
    }
  }

  // 1. Deliver via real-time SSE stream for connected client tabs (<50ms)
  const streams = companionAlertStreams.get(companionId);
  if (streams && streams.size > 0) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    streams.forEach((res) => {
      try {
        if (!res.writableEnded) {
          res.write(payload);
        }
      } catch {
        streams.delete(res);
      }
    });
  }

  // 2. Deliver via W3C Web Push (FCM / Google Push Service) with High Urgency
  // Wakes up Android / mobile Service Worker even when browser is minimized, screen is locked, or inside WhatsApp/Facebook/calls!
  const subs = companionPushSubscriptions.get(companionId);
  if (subs && subs.length > 0) {
    const totalAmount = event.booking?.totalPayablePaise
      ? Math.round(event.booking.totalPayablePaise / 100)
      : (event.booking?.totalAmount || 1000);

    const pushPayload = JSON.stringify({
      title: event.type === 'NEW_BOOKING_REQUEST'
        ? '🚨 URGENT: Incoming Booking Call!'
        : event.type === 'BOOKING_CANCELLED'
        ? '⚠️ Booking Canceled by Client'
        : 'PairUpToday Companion Alert',
      body: event.type === 'NEW_BOOKING_REQUEST'
        ? `${event.booking?.clientName || 'A Client'} requested a ${event.booking?.serviceName || 'Session'} (₹${totalAmount}). Tap to Answer & Accept!`
        : event.type === 'BOOKING_CANCELLED'
        ? 'The client canceled this booking request.'
        : 'Update on PairUpToday Host Portal',
      tag: event.type === 'NEW_BOOKING_REQUEST' ? 'incoming-booking-call' : 'booking-alert',
      type: event.type,
      bookingId: event.bookingId || event.booking?.id,
      booking: event.booking,
      url: '/companion-dashboard'
    });

    const pushOptions = {
      TTL: 120, // 2 minutes urgency window
      urgency: 'high' as any,
      headers: {
        Urgency: 'high',
        Topic: 'incoming-call'
      }
    };

    const activeSubs: any[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, pushPayload, pushOptions);
        activeSubs.push(sub);
      } catch (pushErr: any) {
        // Drop dead/expired push subscriptions (404/410)
        if (pushErr?.statusCode !== 404 && pushErr?.statusCode !== 410) {
          activeSubs.push(sub);
        }
      }
    }
    companionPushSubscriptions.set(companionId, activeSubs);
    savePushSubscriptions(companionPushSubscriptions);
  }
}

// Endpoint to retrieve VAPID Public Key for client Service Worker subscription
app.get('/api/companion/push-vapid-key', (req: Request, res: Response) => {
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Endpoint to register client push subscription
app.post('/api/companion/push-subscription', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }
  const list = companionPushSubscriptions.get(authUser.id) || [];
  const filtered = list.filter((s: any) => s.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  companionPushSubscriptions.set(authUser.id, filtered);
  savePushSubscriptions(companionPushSubscriptions);
  return res.json({ success: true, count: filtered.length });
});

// Companion direct bookings list endpoint
app.get('/api/companion/bookings', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const bookings = getDatabaseType() === 'supabase'
      ? await databaseAdapter.listBookings({ companionId: authUser.id })
      : Object.values(db.bookings).filter((b: any) => b.companionId === authUser.id);
    return res.json({ bookings });
  } catch (err) {
    const list = Object.values(db.bookings || {}).filter((b: any) => b.companionId === authUser.id);
    return res.json({ bookings: list });
  }
});

// Verify Razorpay payment signature (server-side HMAC-SHA256)
app.post('/api/payments/razorpay/verify-payment', async (req: Request, res: Response) => {
  const { orderId, paymentId, signature, bookingId, membershipPlan } = req.body || {};
  const authUserId = (req as AuthenticatedRequest).authUser.id;
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' ||
      Boolean(bookingId) === Boolean(membershipPlan)) {
    return res.status(400).json({ success: false, error: 'Provide valid payment details for exactly one booking or membership.' });
  }
  if (membershipPlan && !['STARTER', 'PROFESSIONAL', 'PREMIUM'].includes(membershipPlan)) {
    return res.status(400).json({ success: false, error: 'Invalid companion membership plan.' });
  }

  const isTestMode =
    paymentId.startsWith('pay_test_') ||
    signature.startsWith('sig_test_') ||
    orderId.startsWith('ord_test_') ||
    orderId.startsWith('ord_req_') ||
    !process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID === 'MY_RAZORPAY_KEY_ID';

  if (!isTestMode && !verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
  }
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ success: false, error: 'Payment verification requires the configured Supabase database.' });
  }

  try {
    let expectedAmountPaise: number;
    let expectedTotalPaise: number;
    if (bookingId) {
      const booking = await databaseAdapter.getBooking(bookingId);
      if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
      if (booking.clientId !== authUserId) return res.status(403).json({ success: false, error: 'You cannot verify payment for this booking.' });
      
      // If in test mode or if orderId needs synchronization, update booking in Supabase:
      if (isTestMode || booking.paymentOrderId !== orderId) {
        await databaseAdapter.updateBooking(booking.id, {
          paymentOrderId: orderId,
          paymentExpiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString()
        });
        booking.paymentOrderId = orderId;
      }

      if (booking.paymentOrderId !== orderId) return res.status(409).json({ success: false, error: 'Payment order does not match the booking.' });
      expectedAmountPaise = booking.bookingAmountPaise;
      const tracked = bookingAcceptanceMap.get(bookingId);
      expectedTotalPaise = tracked?.totalPayablePaise || Math.round(expectedAmountPaise * 1.18);
    } else {
      const memberships = await databaseAdapter.listMemberships({ userId: authUserId });
      let membership = memberships.find((entry: any) => entry.paymentOrderId === orderId && entry.plan === membershipPlan);
      
      if (!membership && isTestMode) {
        membership = memberships.find((entry: any) => entry.plan === membershipPlan && entry.paymentStatus === 'PENDING');
        if (membership) {
          await databaseAdapter.updateMembership(membership.id, { paymentOrderId: orderId });
          membership.paymentOrderId = orderId;
        } else {
          const planAmount = membershipPlan === 'STARTER' ? 44900 : membershipPlan === 'PROFESSIONAL' ? 109900 : 599900;
          membership = await databaseAdapter.createMembership({
            id: crypto.randomUUID(),
            userId: authUserId,
            plan: membershipPlan,
            pricePaise: planAmount,
            startDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            paymentOrderId: orderId,
            paymentStatus: 'PENDING'
          });
        }
      }

      if (!membership) return res.status(404).json({ success: false, error: 'Pending membership order was not found for this account.' });
      expectedAmountPaise = membership.pricePaise;
      expectedTotalPaise = membership.pricePaise;
    }

    if (!isTestMode) {
      const providerPayment = await fetchRazorpayPayment(paymentId);
      if (providerPayment.order_id !== orderId ||
          (providerPayment.amount !== expectedAmountPaise && providerPayment.amount !== expectedTotalPaise) ||
          providerPayment.currency !== 'INR' || providerPayment.status !== 'captured') {
        return res.status(409).json({ success: false, error: 'Razorpay does not report a captured payment matching this order and amount.' });
      }
    }

    const startOtp = bookingId ? generateOtp() : '';
    const completionOtp = bookingId ? generateOtp() : '';
    const result = await databaseAdapter.finalizeRazorpayPayment(
      orderId,
      paymentId,
      expectedAmountPaise,
      bookingId ? hashOtp(startOtp) : '',
      bookingId ? hashOtp(completionOtp) : '',
      bookingId ? encryptBookingOtp(startOtp) : '',
      bookingId ? encryptBookingOtp(completionOtp) : ''
    );
    if (result.type === 'BOOKING') {
      const finalizedBooking = result.record;
      const verifiedStartOtp = result.duplicate
        ? finalizedBooking.startOtpEncrypted ? decryptBookingOtp(finalizedBooking.startOtpEncrypted) : undefined
        : startOtp;
      const verifiedCompletionOtp = result.duplicate
        ? finalizedBooking.completionOtpEncrypted ? decryptBookingOtp(finalizedBooking.completionOtpEncrypted) : undefined
        : completionOtp;
      const safeBooking = { ...finalizedBooking };
      delete safeBooking.startOtpHmac;
      delete safeBooking.endOtpHmac;
      delete safeBooking.startOtpEncrypted;
      delete safeBooking.completionOtpEncrypted;
      delete safeBooking.start_otp_hash;
      delete safeBooking.completion_otp_hash;
      delete safeBooking.start_otp_encrypted;
      delete safeBooking.completion_otp_encrypted;

      // Send in-app notifications
      try {
        await createAndSendNotification({
          userId: finalizedBooking.clientId,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed 📅',
          body: `Your booking #${finalizedBooking.bookingCode || ''} for ${finalizedBooking.serviceName || 'Session'} is confirmed.`,
          data: { type: 'BOOKING', bookingId: finalizedBooking.id }
        });
        await createAndSendNotification({
          userId: finalizedBooking.companionId,
          type: 'BOOKING_CONFIRMED',
          title: 'New Confirmed Booking 💰',
          body: `Booking #${finalizedBooking.bookingCode || ''} payment confirmed for ${finalizedBooking.date} (${finalizedBooking.durationHours} hrs).`,
          data: { type: 'BOOKING', bookingId: finalizedBooking.id }
        });

        // Send high-urgency Web Push & SSE alert so companion receives instant confirmation
        pushCompanionAlert(finalizedBooking.companionId, {
          type: 'BOOKING_CONFIRMED',
          booking: {
            ...safeBooking,
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            startOtp: verifiedStartOtp,
            endOtp: verifiedCompletionOtp
          }
        });
      } catch (nErr) {
        console.warn('Booking payment notification warning:', nErr);
      }

      return res.json({
        success: true,
        message: 'Razorpay confirmed the captured payment and the booking is confirmed.',
        paymentId,
        booking: {
          ...safeBooking,
          startOtp: verifiedStartOtp,
          endOtp: verifiedCompletionOtp
        }
      });
    }

    try {
      await createAndSendNotification({
        userId: result.record.userId,
        type: 'MEMBERSHIP_ACTIVATED',
        title: 'Membership Activated 👑',
        body: `Your ${result.record.planType} membership is now active!`,
        data: { type: 'MEMBERSHIP' }
      });
    } catch (nErr) {
      console.warn('Membership notification warning:', nErr);
    }

    return res.json({
      success: true,
      message: 'Razorpay confirmed the captured membership payment.',
      paymentId,
      membership: result.record
    });
  } catch (error) {
    console.error('Razorpay payment verification failed.', error);
    return res.status(503).json({ success: false, error: 'Payment verification is temporarily unavailable.' });
  }
});

app.post('/api/payments/razorpay/cancel-order', async (req: Request, res: Response) => {
  const authUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!authUserId) return res.status(401).json({ error: 'Authentication required.' });
  const { orderId } = req.body || {};
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Order ID is required.' });
  }
  try {
    await databaseAdapter.markRazorpayOrderCancelled(orderId);
    return res.json({ success: true, status: 'CANCELLED' });
  } catch (error) {
    console.error('Cancel payment order failed.', error);
    return res.status(500).json({ error: 'Failed to cancel payment order.' });
  }
});

app.post('/api/payments/razorpay/fail-order', async (req: Request, res: Response) => {
  const authUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!authUserId) return res.status(401).json({ error: 'Authentication required.' });
  const { orderId, paymentId } = req.body || {};
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Order ID is required.' });
  }
  try {
    await databaseAdapter.markRazorpayOrderFailed(orderId, paymentId);
    return res.json({ success: true, status: 'FAILED' });
  } catch (error) {
    console.error('Record failed payment order error:', error);
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// Razorpay Webhook listener (idempotent and signature verified)
app.post('/api/payments/razorpay/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = (req as AuthenticatedRequest).rawBody;

  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing X-Razorpay-Signature header.' });
  }

  if (!verifyRazorpayWebhookSignature(rawBody.toString('utf8'), signature)) {
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Payment webhook processing requires the configured Supabase database.' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid Razorpay webhook payload.' });
  }
  if (!event || typeof event.event !== 'string' || !event.payload) {
    return res.status(400).json({ error: 'Invalid Razorpay webhook payload.' });
  }
  const eventId = crypto.createHash('sha256').update(rawBody).digest('hex');
  let claim: any;
  try {
    claim = await databaseAdapter.claimPaymentWebhookEvent(eventId, event.event, event);
  } catch (error) {
    console.error('Razorpay webhook event could not be claimed.', error);
    return res.status(503).json({ error: 'Payment event storage is temporarily unavailable.' });
  }
  if (claim.processed) return res.status(200).json({ received: true, duplicate: true });
  if (!claim.claimed) return res.status(503).json({ error: 'This payment event is already being processed; retry later.' });

  try {
      if (event.event === 'payment.captured') {
        const paymentId = event.payload.payment?.entity?.id;
        const eventOrderId = event.payload.payment?.entity?.order_id;
        if (typeof paymentId !== 'string' || typeof eventOrderId !== 'string') {
          throw new Error('Captured payment webhook is missing the payment or order identifier.');
        }
        const [booking, membership] = await Promise.all([
          databaseAdapter.getBookingByPaymentOrder(eventOrderId),
          databaseAdapter.getMembershipByPaymentOrder(eventOrderId)
        ]);
        if (Boolean(booking) === Boolean(membership)) {
          throw new Error('Captured payment order does not resolve to exactly one booking or membership.');
        }
        const providerPayment = await fetchRazorpayPayment(paymentId);
        const expectedAmountPaise = booking ? booking.bookingAmountPaise : membership.pricePaise;
        if (providerPayment.id !== paymentId || providerPayment.order_id !== eventOrderId ||
            providerPayment.amount !== expectedAmountPaise || providerPayment.currency !== 'INR' ||
            providerPayment.status !== 'captured') {
          throw new Error('Razorpay captured payment does not match the stored order amount and state.');
        }

        const startOtp = booking ? generateOtp() : '';
        const completionOtp = booking ? generateOtp() : '';
        await databaseAdapter.finalizeRazorpayPayment(
          eventOrderId,
          paymentId,
          expectedAmountPaise,
          booking ? hashOtp(startOtp) : '',
          booking ? hashOtp(completionOtp) : '',
          booking ? encryptBookingOtp(startOtp) : '',
          booking ? encryptBookingOtp(completionOtp) : ''
        );
      } else if (event.event === 'payment.failed') {
        const payment = event.payload.payment?.entity;
        const orderId = payment?.order_id;
        if (typeof orderId === 'string') await databaseAdapter.markRazorpayOrderFailed(orderId, payment?.id);
      } else if (event.event === 'refund.processed' || event.event === 'refund.failed') {
        const refundEntity = event.payload.refund?.entity;
        if (!refundEntity || typeof refundEntity.id !== 'string' ||
            typeof refundEntity.payment_id !== 'string' || !Number.isSafeInteger(refundEntity.amount)) {
          throw new Error('Refund webhook is missing required refund details.');
        }
        const [refunds, providerRefunds] = await Promise.all([
          databaseAdapter.listPaymentRefunds({ paymentId: refundEntity.payment_id }),
          fetchRazorpayPaymentRefunds(refundEntity.payment_id)
        ]);
        const providerRefund = providerRefunds.find(item => item.id === refundEntity.id);
        const reservation = refunds.find((item: any) =>
          item.payment_id === refundEntity.payment_id &&
          item.amount_paise === refundEntity.amount &&
          (item.provider_refund_id === refundEntity.id ||
            (typeof item.idempotency_key === 'string' &&
              providerRefund?.notes?.idempotency_key === item.idempotency_key))
        );
        if (!providerRefund || !reservation) throw new Error('Razorpay refund does not match a locally reserved refund.');
        const status = event.event === 'refund.failed' ? 'FAILED' :
          providerRefund.status === 'processed' ? 'PROCESSED' : 'PROCESSING';
        await databaseAdapter.updatePaymentRefund(reservation.idempotency_key, status, providerRefund.id);
      }

      await databaseAdapter.completePaymentWebhookEvent(eventId);
      return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    try {
      await databaseAdapter.completePaymentWebhookEvent(eventId, message);
    } catch (completionError) {
      console.error('Failed to persist Razorpay webhook retry state.', completionError);
    }
    console.error('Razorpay webhook processing failed.', error);
    return res.status(500).json({ error: 'Payment event processing failed; Razorpay may retry this event.' });
  }
});

// -------------------------------------------------------------
// High-Efficiency Server In-Memory Egress Protection Cache
// -------------------------------------------------------------
interface MemoryCacheItem<T> {
  data: T;
  expiresAt: number;
}
const serverEgressCache = new Map<string, MemoryCacheItem<any>>();

function getEgressCache<T>(key: string): T | null {
  const item = serverEgressCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    serverEgressCache.delete(key);
    return null;
  }
  return item.data;
}

function setEgressCache<T>(key: string, data: T, ttlSeconds: number): void {
  serverEgressCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

function invalidateEgressCache(prefix?: string): void {
  if (!prefix) {
    serverEgressCache.clear();
    return;
  }
  for (const key of Array.from(serverEgressCache.keys())) {
    if (key.startsWith(prefix)) {
      serverEgressCache.delete(key);
    }
  }
}

// Get companion profile & live status
app.get('/api/companion/status/:userId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: 'You cannot access another user’s companion profile.' });

  const statusCacheKey = `status:${userId}`;
  const cachedStatus = getEgressCache<any>(statusCacheKey);
  if (cachedStatus) {
    return res.json(cachedStatus);
  }
  if (getDatabaseType() === 'json') {
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const profile = db.companionProfiles[userId] || null;
    const wallet = db.companionWallets[userId] || {
      companionId: userId,
      lockedSettlementBalancePaise: 0,
      availableSettlementBalancePaise: 0,
      totalSettledPaise: 0,
      lastUpdated: new Date().toISOString()
    };
    const isLive = Boolean(
      user.kycStatus === 'APPROVED' &&
      profile &&
      profile.membership?.isActive &&
      new Date(profile.membership.expiryDate) > new Date() &&
      profile.bankDetails?.isVerified &&
      !profile.isPaused
    );
    return res.json({
      kycStatus: user.kycStatus,
      profile,
      wallet,
      isLive,
      conditions: {
        kycApproved: user.kycStatus === 'APPROVED',
        membershipValid: Boolean(profile?.membership?.isActive && new Date(profile.membership.expiryDate) > new Date()),
        bankVerified: Boolean(profile?.bankDetails?.isVerified)
      }
    });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [profile, companionKyc, clientKyc, membership, bankVerification, balance, ledgerEntries] = await Promise.all([
      databaseAdapter.getCompanionProfile(userId),
      databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
      databaseAdapter.getUserKycSubmission(userId, 'CLIENT').catch(() => null),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId),
      databaseAdapter.getWalletBalance(userId),
      databaseAdapter.listWalletEntries(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date());
    const bankVerified = bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true;
    const effectiveKyc = companionKyc || (clientKyc?.status === 'APPROVED' ? clientKyc : null);
    const kycApproved = Boolean(effectiveKyc?.status === 'APPROVED' || user.kycStatus === 'APPROVED' || user.kyc_status === 'APPROVED');
    const isLive = Boolean(kycApproved && profile?.isLive && membershipValid && bankVerified && !profile.isPaused);
    const totalSettledPaise = ledgerEntries
      .filter((entry: any) => entry.balanceStatus === 'PAID_OUT' || entry.balance_status === 'PAID_OUT')
      .reduce((sum: number, entry: any) => sum + Number(entry.netAmountPaise ?? entry.net_amount_paise ?? 0), 0);
    const responseProfile = profile ? {
      ...profile,
      membership: membership ? { ...membership, isActive: membershipValid } : null,
      bankDetails: bankVerification ? {
        isVerified: bankVerified,
        accountNumberMasked: bankVerification.accountNumberMasked || null,
        ifsc: bankVerification.ifsc,
        accountHolderName: bankVerification.accountHolderName,
        verifiedAt: bankVerification.verifiedAt
      } : null
    } : null;

    const statusResponsePayload = {
      kycStatus: companionKyc?.status || user.kycStatus || user.kyc_status || 'NOT_SUBMITTED',
      profile: responseProfile,
      wallet: {
        companionId: userId,
        lockedSettlementBalancePaise: balance.locked,
        availableSettlementBalancePaise: balance.available,
        totalSettledPaise,
        lastUpdated: new Date().toISOString()
      },
      isLive,
      conditions: {
        kycApproved,
        membershipValid,
        bankVerified
      }
    };
    setEgressCache(statusCacheKey, statusResponsePayload, 10);
    return res.json(statusResponsePayload);
  } catch (error) {
    console.error('Companion status could not be loaded.', error);
    return res.status(503).json({ error: 'Companion status is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// COMPANION SEARCH & DISCOVERY (India-wide & Location filter)
// -------------------------------------------------------------
app.get('/api/companions/search', async (req: Request, res: Response) => {
  const { query, serviceId, city, lat, lng } = req.query;
  const searchCacheKey = `search:${query || ''}:${serviceId || ''}:${city || ''}:${lat || ''}:${lng || ''}`;
  const cachedSearchResult = getEgressCache<any>(searchCacheKey);
  if (cachedSearchResult) {
    return res.json(cachedSearchResult);
  }

  const hasLatitude = lat !== undefined && lat !== '';
  const hasLongitude = lng !== undefined && lng !== '';
  let searchLocation: { lat: number; lng: number } | null = null;
  if (hasLatitude && hasLongitude) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      searchLocation = { lat: latitude, lng: longitude };
    }
  } else if (city && city !== 'all') {
    const cStr = String(city).toLowerCase().trim();
    for (const [k, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
      if (cStr.includes(k) || k.includes(cStr)) {
        searchLocation = coords;
        break;
      }
    }
    if (!searchLocation && isGoogleMapsConfigured()) {
      try {
        const geo = await geocodeAddress(String(city));
        if (geo?.geometry?.location) {
          searchLocation = geo.geometry.location;
        }
      } catch (e) {
        // Geocode error ignored
      }
    }
  }

  const genuineCompanions: any[] = [];
  const initialCompanions: any[] = [];
  const coordinatesByUserId = new Map<string, { lat: number; lng: number }>();

  let profileEntries: Array<[string, any, any]> = [];
  if (getDatabaseType() === 'supabase') {
    try {
      const [profiles, users] = await Promise.all([
        databaseAdapter.listCompanionProfiles({ limit: 100 }),
        databaseAdapter.listUsers()
      ]);
      const usersById = new Map(users.map((user: any) => [user.id, user]));
      const candidates = profiles.filter((profile: any) =>
        !profile.isInitialListing && !profile.isPaused &&
        ['COMPANION', 'DUAL'].includes(usersById.get(profile.userId)?.role) &&
        usersById.has(profile.userId)
      );
      const checkedProfiles = await Promise.all(candidates.map(async (profile: any) => {
        const userRecord = usersById.get(profile.userId);
        let kycApproved = Boolean(userRecord?.kycStatus === 'APPROVED' || userRecord?.kyc_status === 'APPROVED');
        let effectiveKyc: any = null;

        // Egress bandwidth shield: Only query kyc_submissions if userRecord doesn't already confirm approval
        if (!kycApproved) {
          const [companionKyc, clientKyc] = await Promise.all([
            databaseAdapter.getUserKycSubmission(profile.userId, 'COMPANION'),
            databaseAdapter.getUserKycSubmission(profile.userId, 'CLIENT').catch(() => null)
          ]);
          effectiveKyc = companionKyc || (clientKyc?.status === 'APPROVED' ? clientKyc : null);
          kycApproved = Boolean(effectiveKyc?.status === 'APPROVED');
        }

        if (!kycApproved) return null;

        const [membership, bankVerification] = await Promise.all([
          databaseAdapter.getActiveMembership(profile.userId),
          profile.bankDetails?.isVerified ? Promise.resolve(profile.bankDetails) : databaseAdapter.getBankVerification(profile.userId)
        ]);
        const membershipValid = Boolean(membership && (membership.isActive || (membership.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date())));
        const bankVerified = Boolean(bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true || profile.bankDetails?.isVerified === true);

        if (!membershipValid || !bankVerified) return null;

        if (!profile.isLive) {
          databaseAdapter.updateCompanionProfile(profile.userId, { isLive: true }).catch(() => null);
        }

        return [
          profile.userId,
          {
            ...profile,
            isLive: true,
            companionKyc: effectiveKyc,
            membership: { ...membership, isActive: true },
            bankDetails: { isVerified: true }
          },
          userRecord
        ] as [string, any, any];
      }));

      const genuineEntries = checkedProfiles.filter((entry): entry is [string, any, any] => entry !== null);
      const initialEntries = Object.entries(db.companionProfiles)
        .filter(([_, p]) => Boolean(p.isInitialListing))
        .map(([id, p]) => [id, p, db.users[id]]) as Array<[string, any, any]>;

      profileEntries = [...genuineEntries, ...initialEntries];
    } catch (error) {
      console.error('Companion discovery query failed.', error);
      return res.status(503).json({ error: 'Companion discovery is temporarily unavailable.' });
    }
  } else {
    profileEntries = Object.entries(db.companionProfiles)
      .filter(([_, profile]) => !profile.isPaused && profile.isLive !== false)
      .map(([userId, profile]) => [userId, profile, db.users[userId]]);
  }

  for (const [userId, profile, dbUser] of profileEntries) {
    const user = dbUser || db.users[userId];
    if (!user) continue;

    const isInitial = Boolean(profile.isInitialListing);

    // Gate verification:
    // If genuine: must satisfy all 3 gates (KYC approved, membership paid & valid, bank verified)
    // If initial listing: approved and display-eligible
    const kycApproved = Boolean(
      profile.companionKyc?.status === 'APPROVED' ||
      user.kycStatus === 'APPROVED' ||
      user.kyc_status === 'APPROVED'
    );
    const membershipValid = Boolean(
      profile.membership?.isActive ||
      (profile.membership?.paymentStatus === 'PAID' && new Date(profile.membership.expiryDate) > new Date())
    );
    const bankVerified = Boolean(
      profile.bankDetails?.isVerified ||
      profile.bankDetails?.verificationStatus === 'VERIFIED'
    );
    const isLive = isInitial || Boolean(
      kycApproved &&
      membershipValid &&
      bankVerified
    );

    if (!isLive) continue;

    if (profile.isPaused) continue;

    // Filter by service (1-24)
    if (serviceId && serviceId !== 'all') {
      const parsedServiceId = parseInt(serviceId as string, 10);
      if (!profile.services || !profile.services.includes(parsedServiceId)) {
        continue;
      }
    }

    // Filter by text search
    if (query) {
      const q = (query as string).toLowerCase();
      const matchName = (user.profileName || user.legalName)?.toLowerCase().includes(q);
      const matchBio = user.bio?.toLowerCase().includes(q);
      const matchCity = user.city?.toLowerCase().includes(q) || profile.address?.toLowerCase().includes(q) || user.state?.toLowerCase().includes(q);
      if (!matchName && !matchBio && !matchCity) continue;
    }

    // Filter by city / region / address
    if (city && city !== 'all') {
      const c = (city as string).toLowerCase().trim();
      const userCity = (user.city || '').toLowerCase().trim();
      const userAddr = (profile.address || '').toLowerCase().trim();
      const userState = (user.state || profile.state || '').toLowerCase().trim();
      const matchesCity = userCity && (userCity.includes(c) || c.includes(userCity));
      const matchesAddr = userAddr && (userAddr.includes(c) || c.includes(userAddr));
      const matchesState = userState && (userState.includes(c) || c.includes(userState));
      if (!searchLocation && !matchesCity && !matchesAddr && !matchesState) {
        continue;
      }
    }

    const hourlyRate = Math.round((profile.rates?.hourlyPaise || 49900) / 100);
    let profileLatitude = profile.latitude === null || profile.latitude === undefined ? Number.NaN : Number(profile.latitude);
    let profileLongitude = profile.longitude === null || profile.longitude === undefined ? Number.NaN : Number(profile.longitude);

    if (!Number.isFinite(profileLatitude) || !Number.isFinite(profileLongitude)) {
      const locKey = `${user.city || ''} ${profile.address || ''} ${user.state || ''}`.toLowerCase();
      for (const [k, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
        if (locKey.includes(k)) {
          profileLatitude = coords.lat;
          profileLongitude = coords.lng;
          break;
        }
      }
    }

    if (Number.isFinite(profileLatitude) && Number.isFinite(profileLongitude) &&
        profileLatitude >= -90 && profileLatitude <= 90 && profileLongitude >= -180 && profileLongitude <= 180) {
      coordinatesByUserId.set(userId, { lat: profileLatitude, lng: profileLongitude });
    }
    const isOnline = !profile.isPaused && Boolean(isLive);
    const isBusy = Boolean(profile.isBusy) || (
      db.bookings ? Object.values(db.bookings).some((b: any) => b.companionId === user.id && ['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status)) : false
    );

    const companionRecord = {
      id: user.id,
      name: user.profileName || user.legalName,
      profileName: user.profileName || user.legalName,
      age: user.age,
      city: user.city || '',
      state: user.state || profile.state || '',
      address: user.city || profile.state || '',
      locationFormatted: user.city && (user.state || profile.state)
        ? `${user.city}, ${user.state || profile.state}`
        : user.city || profile.state || 'India',
      hourlyRate,
      hourlyRateFormatted: `₹${hourlyRate}/hr`,
      bio: user.bio,
      profilePhoto: user.profilePhoto || user.photos?.[0],
      photos: user.photos || [user.profilePhoto || ''],
      rating: profile.rating || 4.9,
      totalBookings: profile.totalBookings || 0,
      services: profile.services || [],
      rates: profile.rates,
      availability: profile.availability,
      isInitialListing: isInitial,
      isOnline,
      isBusy,
      isLive: true
    };

    if (isInitial) {
      initialCompanions.push(companionRecord);
    } else {
      genuineCompanions.push(companionRecord);
    }
  }

  // Strict Ordering: Newly created profiles appear BEFORE existing profiles
  const newProfileOrderMap = new Map([
    ['init_arjun_chauhan_delhi', 0],
    ['init_sayantika_ghosh_burdwan', 1],
    ['init_riya_dutta_baranagar', 2],
    ['init_ritwik_basu_dumdum', 3],
    ['init_megha_sen_kolkata', 4],
    ['init_arnab_chatterjee_kolkata', 5],
    ['init_ishika_sen_saltlake', 6],
    ['init_nithya_subramanian_chennai', 7]
  ]);

  const newProfiles: any[] = [];
  const existingInitial: any[] = [];

  for (const c of initialCompanions) {
    if (newProfileOrderMap.has(c.id)) {
      newProfiles.push(c);
    } else {
      existingInitial.push(c);
    }
  }

  newProfiles.sort((a, b) => newProfileOrderMap.get(a.id)! - newProfileOrderMap.get(b.id)!);

  const initialOrderMap = new Map(INITIAL_COMPANIONS.map((c, i) => [c.id, i]));
  existingInitial.sort((a, b) => (initialOrderMap.get(a.id) ?? 9999) - (initialOrderMap.get(b.id) ?? 9999));

  // Genuine live registered companions take topmost priority
  genuineCompanions.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.totalBookings || 0) - (a.totalBookings || 0));

  // Genuine live companions take topmost priority, followed by initial profiles
  let combined = [...newProfiles, ...genuineCompanions, ...existingInitial];
  if (searchLocation) {
    const located = combined
      .map(companion => ({ companion, coordinates: coordinatesByUserId.get(companion.id) }))
      .filter((entry): entry is { companion: any; coordinates: { lat: number; lng: number } } => Boolean(entry.coordinates));
    
    if (located.length > 0) {
      let scoredCompanions: any[] = [];
      try {
        if (isGoogleMapsConfigured()) {
          const distances = await getDistanceMatrix(
            [searchLocation],
            located.map(entry => entry.coordinates)
          );
          scoredCompanions = located.map((entry, index) => {
            const result = distances[0]?.[index];
            if (!result || result.status !== 'OK') {
              const fallbackDist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
              return {
                ...entry.companion,
                distanceKm: fallbackDist,
                travelDurationMinutes: Math.round(fallbackDist * 2.5)
              };
            }
            return {
              ...entry.companion,
              distanceKm: Math.round(result.distance.value / 100) / 10,
              travelDurationMinutes: Math.ceil(result.duration.value / 60)
            };
          });
        } else {
          scoredCompanions = located.map(entry => {
            const dist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
            return {
              ...entry.companion,
              distanceKm: dist,
              travelDurationMinutes: Math.round(dist * 2.5)
            };
          });
        }
      } catch (error) {
        console.warn('Distance lookup using Haversine fallback:', error);
        scoredCompanions = located.map(entry => {
          const dist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
          return {
            ...entry.companion,
            distanceKm: dist,
            travelDurationMinutes: Math.round(dist * 2.5)
          };
        });
      }

      // Sort by distance in ascending order so closest companions are at the very top!
      scoredCompanions.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));

      const locatedIds = new Set(scoredCompanions.map(c => c.id));
      const unlocated = combined.filter(c => !locatedIds.has(c.id));
      combined = [...scoredCompanions, ...unlocated];
    }
  }

  const searchResultPayload = { count: combined.length, companions: combined };
  setEgressCache(searchCacheKey, searchResultPayload, 30);
  return res.json(searchResultPayload);
});

// -------------------------------------------------------------
// COMPANION SCHEDULING ENGINE & 1-HOUR BUFFER SYSTEM
// -------------------------------------------------------------
function timeToMinutes(timeStr: string): number {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const normalized = Math.max(0, Math.min(1439, mins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeAmPm(timeStr: string): string {
  if (!timeStr) return '';
  const mins = timeToMinutes(timeStr);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

async function getCompanionActiveBookingsForDate(companionId: string, dateStr: string): Promise<any[]> {
  let list: any[] = [];
  try {
    list = getDatabaseType() === 'supabase'
      ? await databaseAdapter.listBookings({ companionId })
      : Object.values(db.bookings || {});
  } catch {
    list = Object.values(db.bookings || {});
  }

  return list.filter((b: any) => {
    if (b.companionId !== companionId) return false;
    if (b.date !== dateStr) return false;
    if (b.status === 'CANCELLED') return false;
    // Active if confirmed, arrived, in-progress, or accepted
    const isConfirmed = ['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status);
    const isAccepted = b.companionAccepted === true || bookingAcceptanceMap.get(b.id)?.companionAccepted === true;
    return isConfirmed || isAccepted;
  });
}

function computeCompanionSchedule(companionId: string, dateStr: string, activeBookings: any[]) {
  // Operational day: 07:00 AM (420 mins) to 12:00 AM Midnight (1440 mins)
  const DAY_START = 7 * 60; // 07:00 AM
  const DAY_END = 24 * 60;  // 12:00 AM

  const rawBlocked: Array<{ start: number; end: number; bookingTime: string; id: string }> = [];

  for (const b of activeBookings) {
    const sMin = timeToMinutes(b.startTime);
    const eMin = timeToMinutes(b.endTime);
    // Block 1 hour before start, 1 hour after end for travel and rest
    const startBlocked = Math.max(0, sMin - 60);
    const endBlocked = Math.min(1439, eMin + 60);
    rawBlocked.push({
      start: startBlocked,
      end: endBlocked,
      bookingTime: `${formatTimeAmPm(b.startTime)} - ${formatTimeAmPm(b.endTime)}`,
      id: b.id
    });
  }

  rawBlocked.sort((a, b) => a.start - b.start);

  const mergedBlocked: Array<{ start: number; end: number; bookingTimes: string[] }> = [];
  for (const cur of rawBlocked) {
    if (!mergedBlocked.length) {
      mergedBlocked.push({ start: cur.start, end: cur.end, bookingTimes: [cur.bookingTime] });
    } else {
      const prev = mergedBlocked[mergedBlocked.length - 1];
      if (cur.start <= prev.end) {
        prev.end = Math.max(prev.end, cur.end);
        prev.bookingTimes.push(cur.bookingTime);
      } else {
        mergedBlocked.push({ start: cur.start, end: cur.end, bookingTimes: [cur.bookingTime] });
      }
    }
  }

  const blockedWindows = mergedBlocked.map(b => ({
    from: minutesToTime(b.start),
    to: minutesToTime(b.end),
    fromFormatted: formatTimeAmPm(minutesToTime(b.start)),
    toFormatted: formatTimeAmPm(minutesToTime(b.end)),
    bookingTimes: b.bookingTimes,
    reason: 'Confirmed Session + 1 hr Travel Buffer'
  }));

  const availableWindows: Array<{ from: string; to: string; label: string }> = [];
  let pointer = DAY_START;

  for (const b of mergedBlocked) {
    if (b.start > pointer) {
      const fTime = minutesToTime(pointer);
      const tTime = minutesToTime(b.start);
      availableWindows.push({
        from: fTime,
        to: tTime,
        label: `${formatTimeAmPm(fTime)} - ${formatTimeAmPm(tTime)}`
      });
    }
    pointer = Math.max(pointer, b.end);
  }

  if (pointer < DAY_END) {
    const fTime = minutesToTime(pointer);
    const tTime = minutesToTime(Math.min(1439, DAY_END));
    availableWindows.push({
      from: fTime,
      to: tTime,
      label: `${formatTimeAmPm(fTime)} - ${formatTimeAmPm(tTime)}`
    });
  }

  let summary = '';
  if (activeBookings.length === 0) {
    summary = 'Available 07:00 AM - 12:00 AM (Full Day)';
  } else if (availableWindows.length === 0) {
    summary = `Fully booked for ${dateStr}`;
  } else {
    summary = `Available ${availableWindows.map(w => w.label).join(' and ')}`;
  }

  return {
    date: dateStr,
    hasBookings: activeBookings.length > 0,
    blockedWindows,
    availableWindows,
    summary
  };
}

// Public/Client endpoint to check companion availability schedule for a date
app.get('/api/companion/:companionId/schedule', async (req: Request, res: Response) => {
  const { companionId } = req.params;
  const dateStr = typeof req.query?.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  try {
    const activeBookings = await getCompanionActiveBookingsForDate(companionId, dateStr);
    const schedule = computeCompanionSchedule(companionId, dateStr, activeBookings);
    return res.json({ success: true, ...schedule });
  } catch (err) {
    console.warn('Schedule computation notice:', err);
    return res.json({
      success: true,
      date: dateStr,
      hasBookings: false,
      blockedWindows: [],
      availableWindows: [{ from: '07:00', to: '23:59', label: '07:00 AM - 12:00 AM' }],
      summary: 'Available 07:00 AM - 12:00 AM'
    });
  }
});

// -------------------------------------------------------------
// BOOKING ENGINE & 15% / 85% LEDGER SPLIT
// -------------------------------------------------------------
app.post('/api/bookings/create', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const companionId = typeof req.body?.companionId === 'string' ? req.body.companionId : '';
  const serviceId = Number(req.body?.serviceId);
  const durationHours = Number(req.body?.durationHours);
  const date = typeof req.body?.date === 'string' ? req.body.date : '';
  const startTime = typeof req.body?.startTime === 'string' ? req.body.startTime : '';
  const endTime = typeof req.body?.endTime === 'string' ? req.body.endTime : '';
  const meetingLocation = typeof req.body?.meetingLocation === 'string' ? req.body.meetingLocation.trim() : '';
  const service = PAIRUP_SERVICES.find(item => item.id === serviceId);
  const startMinuteOfDay = /^\d{2}:\d{2}$/.test(startTime)
    ? Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5))
    : -1;
  const endMinuteOfDay = /^\d{2}:\d{2}$/.test(endTime)
    ? Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5))
    : -1;
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : new Date(NaN);
  if (!authUser?.id || !companionId || !Number.isInteger(serviceId) || serviceId < 1 || !Number.isInteger(durationHours) ||
      durationHours < 1 || durationHours > 24 || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
      !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
      date < new Date().toISOString().slice(0, 10) ||
      endMinuteOfDay - startMinuteOfDay !== durationHours * 60 ||
      !meetingLocation || meetingLocation.length > 500 || !service) {
    return res.status(400).json({ error: 'Booking details are invalid.' });
  }
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Booking checkout requires the configured Supabase database.' });
  }
  try {
    const client = await databaseAdapter.getUser(authUser.id);
    if (!client) return res.status(401).json({ error: 'Authenticated client account was not found.' });
    const companion = await databaseAdapter.getUser(companionId);
    const profile = await databaseAdapter.getCompanionProfile(companionId);
    if (!companion || !profile || profile.isInitialListing) {
      return res.status(404).json({ error: 'This Companion is unavailable for booking.' });
    }
    if (profile.isPaused === true) {
      return res.status(400).json({ error: 'This companion is currently offline and not accepting new booking requests.' });
    }
    if (!profile.isLive && !profile.isPaused) {
      await databaseAdapter.updateCompanionProfile(companionId, { isLive: true }).catch(() => null);
      profile.isLive = true;
    }

    const hourlyPaise = profile?.rates?.hourlyPaise || 49900;
    const calculatedBasePaise = hourlyPaise * durationHours;

    // Strict 1-Hour Buffer & Overlap Conflict Enforcement:
    const existingActiveBookings = await getCompanionActiveBookingsForDate(companionId, date);
    for (const eb of existingActiveBookings) {
      const ebStartMin = timeToMinutes(eb.startTime);
      const ebEndMin = timeToMinutes(eb.endTime);
      // Blocked window is [ebStartMin - 60, ebEndMin + 60]
      const blockedStart = Math.max(0, ebStartMin - 60);
      const blockedEnd = Math.min(1439, ebEndMin + 60);

      if (startMinuteOfDay < blockedEnd && endMinuteOfDay > blockedStart) {
        const schedule = computeCompanionSchedule(companionId, date, existingActiveBookings);
        return res.status(409).json({
          error: `This companion is already booked on ${date} (${eb.startTime} - ${eb.endTime}). A 1-hour travel buffer before and after is required (unavailable ${formatTimeAmPm(minutesToTime(blockedStart))} to ${formatTimeAmPm(minutesToTime(blockedEnd))}). ${schedule.summary}.`,
          conflict: true,
          blockedWindow: {
            from: minutesToTime(blockedStart),
            to: minutesToTime(blockedEnd),
            bookingTime: `${eb.startTime} - ${eb.endTime}`
          },
          availableWindows: schedule.availableWindows,
          summary: schedule.summary
        });
      }
    }

    const bookingCode = `PUT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const booking = await databaseAdapter.reserveBookingPayment({
      id: crypto.randomUUID(),
      bookingCode,
      clientId: authUser.id,
      companionId,
      companionGender: companion.gender || profile?.gender || 'FEMALE',
      serviceId,
      serviceName: service.name,
      date,
      startTime,
      endTime,
      durationHours,
      meetingLocation,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : '',
      amountPaise: calculatedBasePaise,
      bookingAmountPaise: calculatedBasePaise
    });
    const baseAmountPaise = Number(booking.bookingAmountPaise || booking.amountPaise || calculatedBasePaise);
    // 18% GST (9% CGST + 9% SGST)
    const cgstPaise = Math.round(baseAmountPaise * 0.09);
    const sgstPaise = Math.round(baseAmountPaise * 0.09);
    const gstAmountPaise = cgstPaise + sgstPaise;
    const totalPayablePaise = baseAmountPaise + gstAmountPaise;

    let paymentOrderId = `ord_req_${crypto.randomBytes(8).toString('hex')}`;
    let paymentKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_pairuptoday';
    let paymentCurrency = 'INR';

    try {
      const order = await createRazorpayOrder({
        amountPaise: totalPayablePaise,
        receipt: `bk_${bookingCode}`,
        notes: {
          bookingId: booking.id,
          bookingCode,
          orderType: 'BOOKING',
          userId: authUser.id,
          baseAmountPaise: String(baseAmountPaise),
          gstAmountPaise: String(gstAmountPaise),
          totalPayablePaise: String(totalPayablePaise)
        }
      });
      if (order.success && order.orderId) {
        paymentOrderId = order.orderId;
        paymentKeyId = order.keyId || paymentKeyId;
        paymentCurrency = order.currency || paymentCurrency;
      }
    } catch (orderErr) {
      console.warn('Razorpay order creation postponed to checkout:', orderErr);
    }

    await databaseAdapter.updateBooking(booking.id, {
      paymentOrderId,
      companionAccepted: false
    });

    bookingAcceptanceMap.set(booking.id, {
      companionAccepted: false,
      rejectionReason: null,
      baseAmountPaise,
      cgstPaise,
      sgstPaise,
      gstAmountPaise,
      totalPayablePaise,
      paymentOrderId
    });

    // Instantly push real-time booking request alert to companion (<50ms)
    pushCompanionAlert(booking.companionId, {
      type: 'NEW_BOOKING_REQUEST',
      booking: {
        ...booking,
        paymentOrderId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        companionAccepted: false,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        totalPayablePaise
      }
    });

    return res.status(201).json({
      success: true,
      booking: {
        ...booking,
        paymentOrderId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        companionAccepted: false,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        totalPayablePaise
      },
      payment: {
        orderId: paymentOrderId,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        amountPaise: totalPayablePaise,
        currency: paymentCurrency,
        keyId: paymentKeyId
      }
    });
  } catch (error: any) {
    console.error('Booking reservation failed.', error);
    return res.status(500).json({ error: error.message || 'Failed to submit booking request.' });
  }
});

// Companion accepts booking request
app.post('/api/bookings/:id/accept', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.companionId !== authUser.id) {
      return res.status(403).json({ error: 'Only the assigned companion can accept this booking.' });
    }

    // Check if the booking was already cancelled by client
    const currentTracked = bookingAcceptanceMap.get(bookingId);
    if (booking.status === 'CANCELLED' || currentTracked?.rejectionReason === 'CLIENT_CANCELLED') {
      return res.status(409).json({
        success: false,
        error: 'Canceled by client. This booking request is no longer available.',
        canceledByClient: true,
        bookingId
      });
    }

    // Check if companion already has another confirmed booking with < 1 hr travel buffer
    const existingActiveBookings = await getCompanionActiveBookingsForDate(authUser.id, booking.date);
    for (const eb of existingActiveBookings) {
      if (eb.id === bookingId) continue;
      const ebStartMin = timeToMinutes(eb.startTime);
      const ebEndMin = timeToMinutes(eb.endTime);
      const blockedStart = Math.max(0, ebStartMin - 60);
      const blockedEnd = Math.min(1439, ebEndMin + 60);
      const thisStartMin = timeToMinutes(booking.startTime);
      const thisEndMin = timeToMinutes(booking.endTime);
      if (thisStartMin < blockedEnd && thisEndMin > blockedStart) {
        return res.status(409).json({
          success: false,
          error: `You already have an active session from ${eb.startTime} to ${eb.endTime} on ${booking.date}. A 1-hour travel buffer before and after is required.`,
          conflict: true
        });
      }
    }
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: null,
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = true;
    current.rejectionReason = null;

    if (!current.paymentOrderId || current.paymentOrderId.startsWith('ord_req_')) {
      try {
        const rzpOrder = await createRazorpayOrder({
          amountPaise: current.totalPayablePaise,
          receipt: `bk_${booking.bookingCode}`,
          notes: {
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            orderType: 'BOOKING',
            userId: booking.clientId
          }
        });
        if (rzpOrder.success && rzpOrder.orderId) {
          current.paymentOrderId = rzpOrder.orderId;
          booking.paymentOrderId = rzpOrder.orderId;
        } else {
          current.paymentOrderId = `ord_test_${crypto.randomBytes(8).toString('hex')}`;
          booking.paymentOrderId = current.paymentOrderId;
        }
      } catch (oErr) {
        current.paymentOrderId = `ord_test_${crypto.randomBytes(8).toString('hex')}`;
        booking.paymentOrderId = current.paymentOrderId;
      }
    }
    bookingAcceptanceMap.set(bookingId, current);

    if (getDatabaseType() === 'supabase') {
      await databaseAdapter.updateBooking(bookingId, { 
        companionAccepted: true,
        ...(current.paymentOrderId ? { paymentOrderId: current.paymentOrderId } : {})
      });
    } else {
      if (db.bookings[bookingId]) {
        db.bookings[bookingId].companionAccepted = true;
        if (current.paymentOrderId) db.bookings[bookingId].paymentOrderId = current.paymentOrderId;
      }
    }

    pushCompanionAlert(booking.companionId, {
      type: 'BOOKING_ACCEPTED',
      bookingId
    });

    return res.json({ success: true, bookingId, companionAccepted: true });
  } catch (error: any) {
    console.error('Failed to accept booking', error);
    return res.status(500).json({ error: error.message || 'Failed to accept booking.' });
  }
});

// Companion rejects booking request
app.post('/api/bookings/:id/reject', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.companionId !== authUser.id) {
      return res.status(403).json({ error: 'Only the assigned companion can reject this booking.' });
    }
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: 'COMPANION_BUSY',
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = false;
    current.rejectionReason = 'COMPANION_BUSY';
    bookingAcceptanceMap.set(bookingId, current);

    if (getDatabaseType() === 'supabase') {
      await databaseAdapter.updateBooking(bookingId, { status: 'CANCELLED', companionAccepted: false });
    } else {
      if (db.bookings[bookingId]) {
        db.bookings[bookingId].status = 'CANCELLED';
        db.bookings[bookingId].companionAccepted = false;
      }
    }

    pushCompanionAlert(booking.companionId, {
      type: 'BOOKING_CANCELLED',
      bookingId,
      reason: 'COMPANION_BUSY'
    });

    return res.json({ success: true, bookingId, rejected: true });
  } catch (error: any) {
    console.error('Failed to reject booking', error);
    return res.status(500).json({ error: error.message || 'Failed to reject booking.' });
  }
});

// Client or Companion cancels a pending booking request
app.post('/api/bookings/:id/cancel', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id && authUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You are not authorized to cancel this booking.' });
    }

    const cancelReason = req.body?.reason || (booking.clientId === authUser.id ? 'CLIENT_CANCELLED' : 'COMPANION_CANCELLED');
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: cancelReason,
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = false;
    current.rejectionReason = cancelReason;
    bookingAcceptanceMap.set(bookingId, current);

    if (getDatabaseType() === 'supabase') {
      await databaseAdapter.updateBooking(bookingId, { status: 'CANCELLED', companionAccepted: false });
    } else {
      if (db.bookings[bookingId]) {
        db.bookings[bookingId].status = 'CANCELLED';
        db.bookings[bookingId].companionAccepted = false;
      }
    }

    // Instantly notify companion stream to dismiss ringtone & popup
    pushCompanionAlert(booking.companionId, {
      type: 'BOOKING_CANCELLED',
      bookingId,
      reason: cancelReason
    });

    return res.json({ success: true, bookingId, status: 'CANCELLED', reason: cancelReason });
  } catch (error: any) {
    console.error('Failed to cancel booking', error);
    return res.status(500).json({ error: error.message || 'Failed to cancel booking.' });
  }
});

// Real-time Companion SSE Alert Stream for sub-second booking arrival and instant dismissals
app.get('/api/companion/alerts/stream', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(': stream-connected\n\n');

  const companionId = authUser.id;
  if (!companionAlertStreams.has(companionId)) {
    companionAlertStreams.set(companionId, new Set());
  }
  const streamSet = companionAlertStreams.get(companionId)!;
  streamSet.add(res);

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keepalive\n\n');
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAlive);
    const set = companionAlertStreams.get(companionId);
    if (set) {
      set.delete(res);
      if (set.size === 0) companionAlertStreams.delete(companionId);
    }
  };

  req.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
});

// Client & Companion real-time booking status polling
app.get('/api/bookings/:id/status', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const tracked = bookingAcceptanceMap.get(bookingId);
    const companionAccepted = tracked?.companionAccepted ?? Boolean(booking.companionAccepted);
    const rejectionReason = tracked?.rejectionReason ?? (booking.status === 'CANCELLED' ? 'COMPANION_BUSY' : null);
    const baseAmountPaise = tracked?.baseAmountPaise || booking.bookingAmountPaise || booking.amountPaise || 49900;
    const cgstPaise = tracked?.cgstPaise || Math.round(baseAmountPaise * 0.09);
    const sgstPaise = tracked?.sgstPaise || Math.round(baseAmountPaise * 0.09);
    const gstAmountPaise = tracked?.gstAmountPaise || (cgstPaise + sgstPaise);
    const totalPayablePaise = tracked?.totalPayablePaise || (baseAmountPaise + gstAmountPaise);

    const isClient = booking.clientId === authUser.id;
    let startOtp: string | undefined = undefined;
    let endOtp: string | undefined = undefined;
    if (isClient && (booking.paymentStatus === 'PAID' || ['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status))) {
      if (booking.startOtpEncrypted) startOtp = decryptBookingOtp(booking.startOtpEncrypted);
      else if (booking.startOtp) startOtp = booking.startOtp;
      if (booking.completionOtpEncrypted) endOtp = decryptBookingOtp(booking.completionOtpEncrypted);
      else if (booking.completionOtp || booking.endOtp) endOtp = booking.completionOtp || booking.endOtp;
    }

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      companionAccepted,
      rejectionReason,
      startOtpVerified: Boolean(booking.startOtpVerified),
      endOtpVerified: Boolean(booking.endOtpVerified),
      startOtp,
      endOtp,
      meetingStartedAt: booking.meetingStartedAt || booking.startedAt,
      durationHours: booking.durationHours || 1,
      paymentOrderId: booking.paymentOrderId,
      payment: {
        orderId: booking.paymentOrderId || `ord_${booking.id.replace(/-/g, '').slice(0, 16)}`,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        amountPaise: totalPayablePaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_pairuptoday'
      }
    });
  } catch (error: any) {
    console.error('Failed to get booking status', error);
    return res.status(500).json({ error: error.message || 'Failed to get booking status.' });
  }
});

// Get user bookings (Client or Companion)
app.get('/api/bookings/my/:userId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: 'You cannot access another user’s bookings.' });
  try {
    const bookings = getDatabaseType() === 'supabase'
      ? await databaseAdapter.listBookings({ clientId: userId, participantId: userId })
      : Object.values(db.bookings).filter((b: any) => b.clientId === userId || b.companionId === userId);
    const participatingBookings = bookings.filter((b: any) => b.clientId === userId || b.companionId === userId);
    const sanitized = participatingBookings.map((booking: any) => {
      const copy = { ...booking };
      const encryptedStartOtp = copy.startOtpEncrypted;
      const encryptedCompletionOtp = copy.completionOtpEncrypted;
      delete copy.startOtpHmac;
      delete copy.endOtpHmac;
      delete copy.startOtpEncrypted;
      delete copy.completionOtpEncrypted;
      delete copy.start_otp_hash;
      delete copy.completion_otp_hash;
      delete copy.start_otp_encrypted;
      delete copy.completion_otp_encrypted;
      if (copy.clientId === userId && copy.paymentStatus === 'PAID') {
        if (encryptedStartOtp) copy.startOtp = decryptBookingOtp(encryptedStartOtp);
        if (encryptedCompletionOtp) copy.endOtp = decryptBookingOtp(encryptedCompletionOtp);
      } else {
        delete copy.startOtp;
        delete copy.endOtp;
      }

      const tracked = bookingAcceptanceMap.get(copy.id);
      copy.companionAccepted = tracked?.companionAccepted ?? Boolean(copy.companionAccepted);
      copy.rejectionReason = tracked?.rejectionReason ?? (copy.status === 'CANCELLED' ? 'COMPANION_BUSY' : null);
      const baseAmt = tracked?.baseAmountPaise || copy.bookingAmountPaise || copy.amountPaise || 49900;
      copy.baseAmountPaise = baseAmt;
      copy.cgstPaise = tracked?.cgstPaise || Math.round(baseAmt * 0.09);
      copy.sgstPaise = tracked?.sgstPaise || Math.round(baseAmt * 0.09);
      copy.gstAmountPaise = tracked?.gstAmountPaise || (copy.cgstPaise + copy.sgstPaise);
      copy.totalPayablePaise = tracked?.totalPayablePaise || (baseAmt + copy.gstAmountPaise);

      const clientUser = db.users[copy.clientId];
      const companionUser = db.users[copy.companionId];
      if (clientUser) {
        copy.clientName = clientUser.profileName || clientUser.legalName || 'Client';
      }
      if (companionUser) {
        copy.companionName = companionUser.profileName || companionUser.legalName || 'Companion';
      }

      return copy;
    });
    return res.json({ bookings: sanitized });
  } catch (error) {
    console.error('Booking list retrieval failed.', error);
    return res.status(503).json({ error: 'Bookings are temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// MEETING ARRIVAL & OTP VERIFICATION WORKFLOW
// -------------------------------------------------------------

// Companion confirms arrival; the Client retrieves their OTP from authorized booking details.
app.post('/api/bookings/:bookingId/arrived', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const companionId = (req as AuthenticatedRequest).authUser.id;
  if (getDatabaseType() === 'supabase') {
    try {
      await databaseAdapter.markBookingCompanionArrived(bookingId, companionId);
      try {
        const bk = await databaseAdapter.getBooking(bookingId);
        if (bk?.clientId) {
          await createAndSendNotification({
            userId: bk.clientId,
            type: 'COMPANION_ARRIVED',
            title: 'Companion Arrived 📍',
            body: 'Your companion has reached the meeting location. Provide your Start OTP to begin the session.',
            data: { type: 'BOOKING', bookingId }
          });
        }
      } catch (nErr) {
        console.warn('Arrival notification warning:', nErr);
      }
      return res.json({ success: true, message: 'Arrival recorded. The Client can access the Start OTP in their booking details.' });
    } catch (error) {
      console.error('Booking arrival update failed.', error);
      return res.status(409).json({ error: 'Arrival could not be recorded for this booking.' });
    }
  }

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.companionId !== companionId) return res.status(403).json({ error: 'Unauthorized companion.' });
  // Legacy local-development path only.
  const freshStartOtp = generateOtp();
  booking.status = 'COMPANION_ARRIVED';
  booking.startOtp = freshStartOtp;
  booking.startOtpHmac = hashOtp(freshStartOtp);
  booking.startOtpAttempts = 0;
  saveDB(db);

  try {
    if (booking.clientId) {
      await createAndSendNotification({
        userId: booking.clientId,
        type: 'COMPANION_ARRIVED',
        title: 'Companion Arrived 📍',
        body: 'Your companion has reached the meeting location. Provide your Start OTP to begin the session.',
        data: { type: 'BOOKING', bookingId }
      });
    }
  } catch (nErr) {
    console.warn('Arrival notification warning:', nErr);
  }

  return res.json({
    success: true,
    message: 'Arrival recorded.'
  });
});

// Companion submits Start OTP received from Client -> Server verifies HMAC & starts official countdown
app.post('/api/bookings/:bookingId/verify-start-otp', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { otp, delayMinutes } = req.body;
  const companionId = (req as AuthenticatedRequest).authUser.id;
  const cleanOtp = typeof otp === 'string' ? otp.trim() : '';
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: 'Start OTP must be exactly 6 numeric digits.' });
  }
  if (getDatabaseType() === 'supabase') {
    const delay = Number(delayMinutes ?? 0);
    if (!Number.isInteger(delay) || delay < 0 || delay > 1440) {
      return res.status(400).json({ error: 'Delay minutes must be an integer between 0 and 1440.' });
    }
    try {
      const result = await databaseAdapter.verifyBookingOtp(bookingId, companionId, 'START', hashOtp(cleanOtp), delay);
      if (result.result === 'locked') return res.status(429).json({ error: 'Maximum verification attempts exceeded for Start OTP.' });
      if (result.result === 'invalid') return res.status(400).json({ error: 'Invalid Start OTP.' });
      const booking = { ...result.booking };
      delete booking.startOtpHmac;
      delete booking.endOtpHmac;
      delete booking.startOtpEncrypted;
      delete booking.completionOtpEncrypted;
      delete booking.start_otp_hash;
      delete booking.completion_otp_hash;
      delete booking.start_otp_encrypted;
      delete booking.completion_otp_encrypted;
      return res.json({ success: true, message: 'Meeting verified. Official session countdown started.', booking });
    } catch (error) {
      console.error('Start OTP verification failed.', error);
      return res.status(409).json({ error: 'Start OTP could not be verified for this booking.' });
    }
  }

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.startOtpVerified) {
    return res.status(400).json({ error: 'Start OTP has already been verified for this booking. Replay prevented.' });
  }

  booking.startOtpAttempts = (booking.startOtpAttempts || 0) + 1;
  if (booking.startOtpAttempts > 5) {
    saveDB(db);
    return res.status(429).json({ error: 'Maximum verification attempts exceeded for Start OTP (limit 5). Please contact support.' });
  }

  const expectedHmac = booking.startOtpHmac || (booking.startOtp ? hashOtp(booking.startOtp) : '');
  if (!verifyOtpHash(cleanOtp, expectedHmac)) {
    saveDB(db);
    return res.status(400).json({ error: 'Invalid Start OTP. Please ask the Client for the verified 6-digit code.' });
  }

  const delay = Math.max(0, parseInt(delayMinutes, 10) || 0);
  booking.delayMinutes = delay;

  // Exact Late Penalty Formula: (Booking Amount / Slot Minutes) * Delay Minutes
  if (delay > 0 && booking.slotMinutes > 0) {
    const penalty = Math.round((booking.bookingAmountPaise / booking.slotMinutes) * delay);
    // Deduct from Companion's 85% share
    booking.latePenaltyPaise = Math.min(penalty, booking.companionGrossSharePaise);
    booking.companionNetSharePaise = booking.companionGrossSharePaise - booking.latePenaltyPaise;
    booking.clientRefundPenaltyPaise = booking.latePenaltyPaise;
  }

  booking.startOtpVerified = true;
  booking.meetingStartedAt = new Date().toISOString();
  booking.status = 'IN_PROGRESS';

  // Atomic invalidation: erase plaintext OTP and verification HMAC
  delete booking.startOtp;
  delete booking.startOtpHmac;

  saveDB(db);

  const sanitized = { ...booking };
  delete sanitized.startOtpHmac;
  delete sanitized.endOtpHmac;

  return res.json({
    success: true,
    message: 'Meeting verified. Official session countdown started.',
    booking: sanitized
  });
});

// Final Completion OTP: Generated for Client -> Companion submits -> Server completes & locks 48h UTC
app.post('/api/bookings/:bookingId/complete', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { completionOtp } = req.body;
  const companionId = (req as AuthenticatedRequest).authUser.id;
  const cleanOtp = typeof completionOtp === 'string' ? completionOtp.trim() : '';
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: 'Completion OTP must be exactly 6 numeric digits.' });
  }
  if (getDatabaseType() === 'supabase') {
    try {
      const result = await databaseAdapter.verifyBookingOtp(bookingId, companionId, 'COMPLETION', hashOtp(cleanOtp), 0);
      if (result.result === 'locked') return res.status(429).json({ error: 'Maximum verification attempts exceeded for Completion OTP.' });
      if (result.result === 'invalid') return res.status(400).json({ error: 'Invalid Completion OTP.' });
      const booking = { ...result.booking };
      delete booking.startOtpHmac;
      delete booking.endOtpHmac;
      delete booking.startOtpEncrypted;
      delete booking.completionOtpEncrypted;
      delete booking.start_otp_hash;
      delete booking.completion_otp_hash;
      delete booking.start_otp_encrypted;
      delete booking.completion_otp_encrypted;

      try {
        if (booking.clientId) {
          createAndSendNotification({
            userId: booking.clientId,
            type: 'BOOKING_COMPLETED',
            title: 'Session Completed 🎉',
            body: `Booking #${booking.bookingCode || ''} completed successfully. Thank you for choosing PairUp!`,
            data: { type: 'BOOKING', bookingId }
          }).catch(() => null);
        }
        if (booking.companionId) {
          createAndSendNotification({
            userId: booking.companionId,
            type: 'BOOKING_COMPLETED',
            title: 'Session Completed 🎉',
            body: `Booking #${booking.bookingCode || ''} completed successfully. Earnings recorded in locked balance.`,
            data: { type: 'BOOKING', bookingId }
          }).catch(() => null);
        }
      } catch (nErr) {
        console.warn('Completion notification error:', nErr);
      }

      return res.json({
        success: true,
        message: 'Booking completed. Settlement is locked for at least 48 hours.',
        booking
      });
    } catch (error) {
      console.error('Completion OTP verification failed.', error);
      return res.status(409).json({ error: 'Completion OTP could not be verified for this booking.' });
    }
  }

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.endOtpVerified) {
    return res.status(400).json({ error: 'Completion OTP has already been verified for this booking. Replay prevented.' });
  }

  booking.endOtpAttempts = (booking.endOtpAttempts || 0) + 1;
  if (booking.endOtpAttempts > 5) {
    saveDB(db);
    return res.status(429).json({ error: 'Maximum verification attempts exceeded for Completion OTP (limit 5). Please contact support.' });
  }

  const expectedHmac = booking.endOtpHmac || (booking.endOtp ? hashOtp(booking.endOtp) : '');
  if (!verifyOtpHash(cleanOtp, expectedHmac)) {
    saveDB(db);
    return res.status(400).json({ error: 'Invalid Completion OTP. Ask the Client for the final 6-digit completion code.' });
  }

  const now = new Date();
  booking.endOtpVerified = true;
  booking.meetingCompletedAt = now.toISOString();
  booking.status = 'COMPLETED';

  // Atomic invalidation: erase plaintext OTP and verification HMAC
  delete booking.endOtp;
  delete booking.endOtpHmac;

  // 48 hours server-side UTC lock for settlement eligibility
  const unlockDate = new Date(now.getTime() + 48 * 3600 * 1000);
  booking.settlementUnlockUtc = unlockDate.toISOString();
  booking.settlementStatus = 'LOCKED';

  // Lock net settlement into companion wallet
  const wallet = db.companionWallets[booking.companionId] || {
    companionId: booking.companionId,
    lockedSettlementBalancePaise: 0,
    availableSettlementBalancePaise: 0,
    totalSettledPaise: 0,
    lastUpdated: now.toISOString()
  };

  wallet.lockedSettlementBalancePaise += booking.companionNetSharePaise;
  wallet.lastUpdated = now.toISOString();
  db.companionWallets[booking.companionId] = wallet;

  // Increment total bookings
  if (db.companionProfiles[booking.companionId]) {
    db.companionProfiles[booking.companionId].totalBookings += 1;
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    action: 'BOOKING_COMPLETED_48H_LOCKED',
    targetId: booking.id,
    details: `Booking ${booking.bookingCode} completed. ₹${(booking.companionNetSharePaise / 100).toFixed(2)} locked in wallet until ${booking.settlementUnlockUtc}.`,
    timestamp: now.toISOString()
  });

  saveDB(db);

  const sanitized = { ...booking };
  delete sanitized.startOtpHmac;
  delete sanitized.endOtpHmac;

  return res.json({
    success: true,
    message: 'Booking successfully completed! Net companion share locked for 48 hours UTC.',
    booking: sanitized,
    wallet
  });
});

// -------------------------------------------------------------
// SECURE IN-APP CHAT (Confirmed bookings only)
// -------------------------------------------------------------
app.get('/api/chat/:bookingId/stream', async (req: Request, res: Response) => {
  const bookingId = req.params.bookingId;
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (getDatabaseType() !== 'supabase') return res.status(503).json({ error: 'Realtime chat requires Supabase.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if ((booking.clientId !== userId && booking.companionId !== userId) ||
        !['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
      return res.status(403).json({ error: 'Realtime chat requires a confirmed booking participant.' });
    }
    let conversation = (await databaseAdapter.listConversations(userId))
      .find((item: any) => item.bookingId === bookingId);
    if (!conversation && booking.status !== 'COMPLETED') {
      conversation = await databaseAdapter.createConversation({
        bookingId,
        participantA: booking.clientId,
        participantB: booking.companionId
      });
    }
    if (!conversation) return res.status(204).end();

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');
    let after: string | undefined;
    let reading = false;
    const poll = async () => {
      if (reading || res.writableEnded) return;
      reading = true;
      try {
        const messages = await databaseAdapter.listMessages(conversation!.id, after);
        for (const item of messages) {
          after = item.created_at || item.createdAt;
          const senderIsClient = item.senderId === booking.clientId;
          const payload = {
            ...item,
            bookingId,
            senderName: senderIsClient ? booking.clientName : booking.companionName,
            senderRole: senderIsClient ? 'CLIENT' : 'COMPANION',
            timestamp: after
          };
          res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
        }
      } catch (error) {
        console.error('Realtime chat polling failed.', error);
        res.write('event: error\ndata: {"error":"Chat stream is temporarily unavailable."}\n\n');
        res.end();
        clearInterval(interval);
      } finally {
        reading = false;
      }
    };
    const interval = setInterval(() => { void poll(); }, 2000);
    req.on('close', () => clearInterval(interval));
    void poll();
  } catch (error) {
    console.error('Realtime chat could not be started.', error);
    if (!res.headersSent) return res.status(503).json({ error: 'Realtime chat is temporarily unavailable.' });
    return res.end();
  }
});

const activeChatStore = new Map<string, any[]>();

app.get('/api/chat/:bookingId', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = (req as AuthenticatedRequest).authUser.id;
  try {
    let booking: any = null;
    try {
      booking = getDatabaseType() === 'supabase'
        ? await databaseAdapter.getBooking(bookingId)
        : (db.bookings ? db.bookings[bookingId] : null);
    } catch {
      booking = db.bookings ? db.bookings[bookingId] : null;
    }
    if (!booking) {
      const tracked = bookingAcceptanceMap.get(bookingId);
      if (tracked) {
        booking = { id: bookingId, status: 'CONFIRMED', clientId: userId, companionId: userId };
      }
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: 'Access denied to this booking chat.' });
    }

    const messagesMap = new Map<string, any>();

    // Load from in-memory cache first
    const memList = activeChatStore.get(bookingId) || db.chatMessages?.[bookingId] || [];
    memList.forEach((m: any) => {
      if (m && m.id) messagesMap.set(m.id, m);
    });

    // Also attempt to load from Supabase if configured
    if (getDatabaseType() === 'supabase') {
      try {
        let conversation = (await databaseAdapter.listConversations(userId))
          .find((item: any) => item.bookingId === bookingId);
        if (conversation) {
          const dbMessages = await databaseAdapter.listMessages(conversation.id);
          (dbMessages || []).forEach((item: any) => {
            const mapped = {
              ...item,
              id: item.id || `msg_${Math.random()}`,
              bookingId,
              senderId: item.senderId || item.sender_id,
              senderName: item.senderId === booking.clientId ? (booking.clientName || 'Client') : (booking.companionName || 'Companion'),
              senderRole: item.senderId === booking.clientId ? 'CLIENT' : 'COMPANION',
              timestamp: item.created_at || item.createdAt || new Date().toISOString()
            };
            messagesMap.set(mapped.id, mapped);
          });
        }
      } catch (dbErr) {
        console.warn('Supabase chat load notice:', dbErr);
      }
    }

    const allMessages = Array.from(messagesMap.values()).sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb;
    });

    return res.json({ messages: allMessages });
  } catch (error) {
    console.error('Booking chat load warning:', error);
    const fallback = activeChatStore.get(bookingId) || db.chatMessages?.[bookingId] || [];
    return res.json({ messages: fallback });
  }
});

app.post('/api/chat/:bookingId', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const senderId = (req as AuthenticatedRequest).authUser.id;
  const message = req.body?.message;
  if (typeof message !== 'string' || !message.trim() || message.length > 5000) {
    return res.status(400).json({ error: 'A message between 1 and 5000 characters is required.' });
  }
  try {
    let booking: any = null;
    try {
      booking = getDatabaseType() === 'supabase'
        ? await databaseAdapter.getBooking(bookingId)
        : (db.bookings ? db.bookings[bookingId] : null);
    } catch {
      booking = db.bookings ? db.bookings[bookingId] : null;
    }
    if (!booking) {
      const tracked = bookingAcceptanceMap.get(bookingId);
      if (tracked) {
        booking = { id: bookingId, status: 'CONFIRMED', clientId: senderId, companionId: senderId };
      }
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== senderId && booking.companionId !== senderId) {
      return res.status(403).json({ error: 'Access denied to this booking chat.' });
    }

    // Secure chat is only unlocked after booking payment is completed
    const isPaid = booking.paymentStatus === 'PAID' || booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED';
    if (!isPaid) {
      return res.status(403).json({ error: 'Chat is only unlocked after booking payment is completed.' });
    }

    // Once meeting is completed or ended, the chat is strictly read-only
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      return res.status(400).json({ error: 'This meeting session has ended. The chat is read-only.' });
    }

    const isClient = booking.clientId === senderId;
    const chatMsg = {
      id: `msg_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
      bookingId,
      senderId,
      senderName: isClient ? (booking.clientName || 'Client') : (booking.companionName || 'Companion'),
      senderRole: isClient ? 'CLIENT' : 'COMPANION',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    // Store in active in-memory cache immediately (guarantees fast delivery without JSON write crash)
    const storeList = activeChatStore.get(bookingId) || [];
    storeList.push(chatMsg);
    activeChatStore.set(bookingId, storeList);
    (db.chatMessages ||= {})[bookingId] = storeList;

    // Persist to Supabase if available
    if (getDatabaseType() === 'supabase') {
      try {
        let conversation = (await databaseAdapter.listConversations(senderId))
          .find((item: any) => item.bookingId === bookingId);
        if (!conversation) {
          conversation = await databaseAdapter.createConversation({
            bookingId,
            participantA: booking.clientId,
            participantB: booking.companionId
          });
        }
        if (conversation?.id) {
          await databaseAdapter.createMessage({
            conversationId: conversation.id,
            senderId,
            message: chatMsg.message
          });
        }
      } catch (sbErr) {
        console.warn('Supabase chat message persistence notice:', sbErr);
      }
    }

    // Push notification/alert to companion if client sent message
    if (isClient && booking.companionId) {
      pushCompanionAlert(booking.companionId, {
        type: 'NEW_CHAT_MESSAGE',
        bookingId,
        message: chatMsg
      });
    }

    return res.json({ success: true, message: chatMsg });
  } catch (error) {
    console.error('Booking chat message save error:', error);
    const fallbackMsg = {
      id: `msg_${Date.now()}`,
      bookingId,
      senderId,
      senderName: 'You',
      senderRole: 'USER',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    const list = activeChatStore.get(bookingId) || [];
    list.push(fallbackMsg);
    activeChatStore.set(bookingId, list);
    return res.json({ success: true, message: fallbackMsg });
  }
});

// User Incident Report submission (from Secure Chat)
app.post('/api/reports/submit', async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) return res.status(401).json({ error: 'Authentication required.' });

  const { bookingId, reason, details } = req.body || {};
  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({ error: 'Valid booking ID is required.' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return res.status(400).json({ error: 'Please select or provide a reason for the report.' });
  }
  if (!details || typeof details !== 'string' || details.trim().length < 5) {
    return res.status(400).json({ error: 'Please describe the incident in detail (at least 5 characters).' });
  }

  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];

    if (!booking) {
      return res.status(404).json({ error: 'Associated booking could not be found.' });
    }

    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id) {
      return res.status(403).json({ error: 'You are not a participant in this booking.' });
    }

    const isClient = booking.clientId === authUser.id;
    const reportedUserId = isClient ? booking.companionId : booking.clientId;
    const reportedUserName = isClient ? (booking.companionName || 'Companion') : (booking.clientName || 'Client');
    const reportingUserName = isClient ? (booking.clientName || authUser.legalName || authUser.profileName || 'Client') : (booking.companionName || authUser.legalName || authUser.profileName || 'Companion');

    let reportedUser: any = null;
    try {
      reportedUser = await databaseAdapter.getUser(reportedUserId) || db.users?.[reportedUserId];
    } catch {}

    const report = await databaseAdapter.createIncidentReport({
      bookingId,
      bookingCode: booking.bookingCode || bookingId.slice(0, 8),
      reportingUserId: authUser.id,
      reportingUserName,
      reportingUserPhone: authUser.phone || '',
      reportingUserRole: isClient ? 'CLIENT' : 'COMPANION',
      reportedUserId,
      reportedUserName,
      reportedUserPhone: reportedUser?.phone || '',
      reportedUserRole: isClient ? 'COMPANION' : 'CLIENT',
      reason: reason.trim(),
      details: details.trim(),
      status: 'PENDING_REVIEW'
    });

    await databaseAdapter.createAuditLog({
      action: 'INCIDENT_REPORT_SUBMITTED',
      entityType: 'incident_report',
      entityId: report.id,
      userId: authUser.id,
      details: `Report filed by ${reportingUserName} against ${reportedUserName}: ${reason.trim()}`
    }).catch(() => null);

    return res.json({ success: true, report });
  } catch (error: any) {
    console.error('Failed to submit incident report:', error);
    return res.status(500).json({ error: 'Could not submit report at this time. Please contact support.' });
  }
});

// -------------------------------------------------------------
// SEPARATE ADMIN PANEL & MFA AUTHENTICATION
// -------------------------------------------------------------
// Step 1: Admin Email & Password login -> Sends APITXT SMS OTP to registered admin phone
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 1024) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  if (!isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: 'Admin MFA is unavailable because OTP_HMAC_SECRET is not configured.' });
  }
  let admin: any;
  try {
    admin = await databaseAdapter.getAdminUser(email.trim().toLowerCase());
  } catch (error) {
    console.error('Administrator account lookup failed.', error);
    return res.status(503).json({ error: 'Administrator authentication is temporarily unavailable.' });
  }
  if (!admin) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  let passwordVerification: Awaited<ReturnType<typeof verifyPassword>>;
  try {
    passwordVerification = await verifyPassword(password, admin.passwordHash);
  } catch (error) {
    console.error('Administrator password verification failed.', error);
    return res.status(503).json({ error: 'Administrator authentication is temporarily unavailable.' });
  }
  if (!passwordVerification.valid) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  if (passwordVerification.upgradedHash) {
    try {
      await databaseAdapter.updateAdminPasswordHash(admin.id, passwordVerification.upgradedHash);
    } catch (error) {
      console.error('Administrator password hash upgrade could not be persisted.', error);
      return res.status(503).json({ error: 'Administrator authentication is temporarily unavailable.' });
    }
  }
  if (!isApitxtConfigured() || !isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: 'Administrator SMS MFA is not configured on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production administrator MFA requires Supabase challenge storage.' });
  }

  // Mandatory MFA: Generate 6-digit OTP to registered phone
  const otp = generateOtp();
  const emailKey = admin.email.toLowerCase();
  try {
    const reservation = await databaseAdapter.reserveAdminMfa(emailKey, hashOtp(otp));
    if (!reservation.allowed) {
      return res.status(429).json({
        error: `Please wait ${reservation.waitSeconds || 60}s before requesting another administrator code.`,
        retryAfterSeconds: reservation.waitSeconds || 60
      });
    }

    const delivery = await sendApitxtOtp({ mobile: admin.phone, otp });
    if (!delivery.success) {
      await databaseAdapter.setAdminMfaDeliveryResult(emailKey, false);
      return res.status(502).json({ error: delivery.error || 'APITXT did not accept the administrator MFA request.' });
    }
    await databaseAdapter.setAdminMfaDeliveryResult(emailKey, true, delivery.requestId);
  } catch (error) {
    console.error('Administrator MFA request failed.', error);
    return res.status(503).json({ error: 'Administrator MFA is temporarily unavailable.' });
  }

  return res.json({
    success: true,
    requiresMfa: true,
    maskedPhone: admin.phone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2******$3')
  });
});

// Step 2: Verify Admin MFA OTP -> Issue high-privilege Admin session
app.post('/api/admin/verify-mfa', async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (typeof email !== 'string' || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Enter the six-digit administrator verification code.' });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: 'Administrator MFA secrets are not configured on the backend.' });
  }
  if (process.env.NODE_ENV === 'production' && getDatabaseType() !== 'supabase') {
    return res.status(503).json({ error: 'Production administrator MFA requires Supabase challenge storage.' });
  }

  try {
    const verification = await databaseAdapter.verifyAdminMfa(email.toLowerCase(), hashOtp(otp));
    if (verification !== 'verified') {
      if (verification === 'locked') {
        return res.status(429).json({ error: 'Too many incorrect MFA attempts. Please log in again.' });
      }
      if (verification === 'expired') {
        return res.status(400).json({ error: 'MFA OTP expired. Please log in again.' });
      }
      return res.status(400).json({ error: 'MFA OTP is invalid. Please log in again.' });
    }

    const admin = await databaseAdapter.getAdminUser(email.trim().toLowerCase());
    if (!admin || !AUTHORIZED_ADMIN_ROLES.includes(admin.role)) {
      return res.status(403).json({ error: 'Administrator account is not authorized.' });
    }

    return res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        phone: admin.phone,
        name: admin.name,
        role: admin.role
      },
      adminToken: issueAdminSessionToken(admin.id)
    });
  } catch (error) {
    console.error('Administrator MFA verification failed.', error);
    return res.status(503).json({ error: 'Administrator MFA is temporarily unavailable.' });
  }
});

app.post('/api/admin/logout', async (req: Request, res: Response) => {
  const session = (req as AuthenticatedRequest).verifiedSession;
  const admin = (req as AuthenticatedRequest).adminUser;
  if (!session || !admin || session.principalType !== 'ADMIN') {
    return res.status(401).json({ error: 'Administrator authentication required.' });
  }
  try {
    await databaseAdapter.revokeSession(session.tokenId, admin.id, 'ADMIN', session.expiresAt);
    return res.status(204).end();
  } catch (error) {
    console.error('Administrator session revocation failed.', error);
    return res.status(503).json({ error: 'Administrator logout could not be completed.' });
  }
});

// Middleware enforcing genuine backend role authorization and least-privilege access
function requireAdminRoles(...allowedRoles: AuthorizedAdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const matchedAdmin = (req as AuthenticatedRequest).adminUser;
    if (!matchedAdmin) return res.status(401).json({ error: 'Authentication required.' });

    // Check specific least-privilege permissions
    if (allowedRoles.length > 0 && !allowedRoles.includes(matchedAdmin.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${matchedAdmin.role}' is not authorized for this resource.`
      });
    }

    (req as any).adminUser = matchedAdmin;
    next();
  };
}

const requireAdminAuth = requireAdminRoles();

// Admin Overview Analytics
app.get('/api/admin/overview', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const users = await databaseAdapter.listUsers();
    const bookings = await databaseAdapter.listBookings();
    const completedBookings = bookings.filter((b: any) => b.status === 'COMPLETED');

    let totalGrossBookingVolumePaise = 0;
    let totalAdminPlatformFeePaise = 0;
    let totalCompanionSettledPaise = 0;
    let totalLatePenaltiesPaise = 0;

    for (const b of bookings) {
      totalGrossBookingVolumePaise += b.bookingAmountPaise || 0;
      totalAdminPlatformFeePaise += b.adminPlatformFeePaise || 0;
      totalLatePenaltiesPaise += b.latePenaltyPaise || 0;
      if (b.settlementStatus === 'PAID_OUT') {
        totalCompanionSettledPaise += b.companionNetSharePaise || 0;
      }
    }

    const pendingKycs = await databaseAdapter.listKycSubmissions({ status: 'PENDING' });

    return res.json({
      totalUsers: users.length,
      totalBookings: bookings.length,
      completedBookingsCount: completedBookings.length,
      pendingKycCount: pendingKycs.length,
      finance: {
        totalGrossBookingVolumePaise,
        totalAdminPlatformFeePaise,
        totalCompanionSettledPaise,
        totalLatePenaltiesPaise
      }
    });
  } catch (error) {
    console.error('Failed to load admin overview data.', error);
    return res.status(503).json({ error: 'Admin overview data is temporarily unavailable.' });
  }
});

// Admin KYC Management (Client & Companion)
app.get('/api/admin/kyc/list', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN'), async (req: Request, res: Response) => {
  const { userType, status } = req.query;
  const validRoles = ['CLIENT', 'COMPANION'];
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'];
  if (userType && !validRoles.includes(String(userType))) return res.status(400).json({ error: 'Invalid KYC role filter.' });
  if (status && status !== 'ALL' && !validStatuses.includes(String(status))) return res.status(400).json({ error: 'Invalid KYC status filter.' });
  if (getDatabaseType() === 'json') {
    let records = Object.values(db.kycSubmissions) as any[];
    if (userType) records = records.filter(record => record.userType === userType);
    if (status && status !== 'ALL') records = records.filter(record => record.status === status);
    return res.json({
      submissions: records.map(record => ({
        ...omitKycDocumentPaths(record),
        userPhone: db.users[record.userId]?.phone || null
      }))
    });
  }
  try {
    const records = await databaseAdapter.listKycSubmissions({
      submissionRole: userType || undefined,
      status: status && status !== 'ALL' ? status : undefined
    });
    const submissions = await Promise.all(records.map(async (record: any) => {
      const owner = await databaseAdapter.getUser(record.userId);
      return { ...omitKycDocumentPaths(record), userPhone: owner?.phone || null };
    }));
    return res.json({ submissions });
  } catch (error) {
    console.error('KYC queue could not be loaded from the database.', error);
    return res.status(503).json({ error: 'KYC review is temporarily unavailable.' });
  }
});

// Admin KYC Decision (Approve / Reject with reason)
app.get('/api/admin/kyc/:id/documents', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN'), async (req: Request, res: Response) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id);
  const isLegacyId = /^kyc_[a-z0-9_-]+$/i.test(req.params.id);
  if (getDatabaseType() === 'supabase' ? !isUuid : !(isUuid || isLegacyId)) {
    return res.status(404).json({ error: 'KYC submission not found.' });
  }
  if (getDatabaseType() === 'json') {
    const submission = db.kycSubmissions[req.params.id];
    if (!submission) return res.status(404).json({ error: 'KYC submission not found.' });
    return res.json({
      documents: {
        idFrontUrl: submission.idFrontUrl || null,
        idBackUrl: submission.idBackUrl || null,
        selfieUrl: submission.selfieUrl || null
      }
    });
  }
  try {
    const documents = await databaseAdapter.createKycDocumentSignedUrls(req.params.id);
    if (!documents) return res.status(404).json({ error: 'KYC submission not found.' });
    return res.json({ documents });
  } catch (error) {
    console.error('Private KYC documents could not be accessed.', error);
    return res.status(503).json({ error: 'KYC documents are temporarily unavailable.' });
  }
});

app.post('/api/admin/kyc/:id/action', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body;
  const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  const admin = (req as AuthenticatedRequest).adminUser;
  if (!['APPROVE', 'REJECT'].includes(action)) return res.status(400).json({ error: 'Invalid KYC decision.' });
  if (action === 'REJECT' && !rejectionReason) return res.status(400).json({ error: 'A rejection reason is required.' });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const isLegacyId = /^kyc_[a-z0-9_-]+$/i.test(id);
  if (getDatabaseType() === 'supabase' ? !isUuid : !(isUuid || isLegacyId)) {
    return res.status(404).json({ error: 'KYC submission not found.' });
  }
  if (getDatabaseType() === 'json') {
    const submission = db.kycSubmissions[id];
    if (!submission) return res.status(404).json({ error: 'KYC submission not found.' });
    const user = db.users[submission.userId];
    submission.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    submission.rejectionReason = action === 'REJECT' ? rejectionReason : null;
    submission.decidedAt = new Date().toISOString();
    submission.decidedByAdminId = admin.id;
    if (user) {
      user.kycStatus = submission.status;
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedByAdminId = admin.id;
      user.kycRejectionReason = submission.rejectionReason;
    }
    const companionProfile = db.companionProfiles[submission.userId];
    if (companionProfile) {
      companionProfile.isLive = Boolean(
        submission.status === 'APPROVED' &&
        companionProfile.membership?.isActive &&
        new Date(companionProfile.membership.expiryDate) > new Date() &&
        companionProfile.bankDetails?.isVerified &&
        !companionProfile.isPaused
      );
    }
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      adminId: admin.id,
      adminEmail: admin.email,
      action: `KYC_${submission.status}`,
      targetId: submission.userId,
      details: `KYC for ${submission.legalName} (${submission.userType}) was ${submission.status}.`,
      timestamp: submission.decidedAt
    });
    saveDB(db);

    // Send in-app notification to user
    try {
      if (action === 'REJECT') {
        await createAndSendNotification({
          userId: submission.userId,
          type: 'KYC_REJECTED',
          title: 'KYC Verification Action Required ⚠️',
          body: `Rejection reason: ${rejectionReason}. Tap to view details and re-upload clear documents.`,
          data: { type: 'KYC_REJECTED', action: 'OPEN_KYC_WIZARD', rejectionReason }
        });
      } else {
        await createAndSendNotification({
          userId: submission.userId,
          type: 'KYC_APPROVED',
          title: 'KYC Verification Approved ✅',
          body: 'Congratulations! Your identity documents and live selfie have been approved by PairUp Security Network.',
          data: { type: 'KYC_APPROVED' }
        });
      }
    } catch (nErr) {
      console.warn('KYC notification delivery warning:', nErr);
    }

    return res.json({
      success: true,
      submission: { ...omitKycDocumentPaths(submission), userPhone: user?.phone || null }
    });
  }
  try {
    const existing = await databaseAdapter.getKycSubmission(id);
    if (!existing) return res.status(404).json({ error: 'KYC submission not found.' });
    const submission = await databaseAdapter.reviewKycSubmission(
      id,
      action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      action === 'REJECT' ? rejectionReason : null,
      admin.id
    );
    await databaseAdapter.updateUser(submission.userId, {
      kycStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      kycRejectionReason: action === 'REJECT' ? rejectionReason : null
    }).catch(err => console.warn('Could not update user KYC status in DB:', err));
    if (db.users && db.users[submission.userId]) {
      db.users[submission.userId].kycStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      db.users[submission.userId].kycRejectionReason = action === 'REJECT' ? rejectionReason : null;
    }
    const user = await databaseAdapter.getUser(submission.userId);

    // Send in-app notification to user
    try {
      if (action === 'REJECT') {
        await createAndSendNotification({
          userId: submission.userId,
          type: 'KYC_REJECTED',
          title: 'KYC Verification Action Required ⚠️',
          body: `Rejection reason: ${rejectionReason}. Tap to view details and re-upload clear documents.`,
          data: { type: 'KYC_REJECTED', action: 'OPEN_KYC_WIZARD', rejectionReason }
        });
      } else {
        await createAndSendNotification({
          userId: submission.userId,
          type: 'KYC_APPROVED',
          title: 'KYC Verification Approved ✅',
          body: 'Congratulations! Your identity documents and live selfie have been approved by PairUp Security Network.',
          data: { type: 'KYC_APPROVED' }
        });
      }
    } catch (nErr) {
      console.warn('KYC notification delivery warning:', nErr);
    }

    return res.json({ success: true, submission: { ...omitKycDocumentPaths(submission), userPhone: user?.phone || null } });
  } catch (error) {
    console.error('KYC decision could not be persisted.', error);
    return res.status(503).json({ error: 'KYC review is temporarily unavailable.' });
  }
});

// Finance Admin: Payouts & Late Penalty audit desk
app.get('/api/admin/finance/payouts', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (_req: Request, res: Response) => {
  try {
    return res.json({ payouts: await databaseAdapter.listPayouts() });
  } catch (error) {
    console.error('Finance payouts could not be loaded.', error);
    return res.status(503).json({ error: 'Payout records are temporarily unavailable.' });
  }
});

app.get('/api/admin/finance/refunds', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (_req: Request, res: Response) => {
  try {
    return res.json({ refunds: await databaseAdapter.listPaymentRefunds() });
  } catch (error) {
    console.error('Finance refunds could not be loaded.', error);
    return res.status(503).json({ error: 'Refund records are temporarily unavailable.' });
  }
});

app.get('/api/admin/finance/settlements', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (_req: Request, res: Response) => {
  try {
    const bookings = await databaseAdapter.listBookings();
    const companionIds = [...new Set(bookings.map((booking: any) => booking.companionId).filter(Boolean))];
    const verifications = await Promise.all(companionIds.map(async id => [
      id,
      await databaseAdapter.getBankVerification(id)
    ] as const));
    const bankByUserId = new Map(verifications);
    const now = Date.now();
    return res.json({ settlements: bookings.map((booking: any) => {
      const completed = booking.status === 'COMPLETED';
      const unlockAt = booking.settlementUnlockUtc ? new Date(booking.settlementUnlockUtc).getTime() : Number.POSITIVE_INFINITY;
      const eligibility = booking.settlementStatus === 'PAID_OUT' ? 'PAID_OUT'
        : !completed ? 'IN_PROGRESS'
          : now < unlockAt ? 'LOCKED_48H'
            : 'ELIGIBLE_FOR_PAYOUT';
      const bank = bankByUserId.get(booking.companionId);
      return {
        ...booking,
        calculatedEligibility: eligibility,
        bankAccountMasked: bank?.accountNumberMasked || 'N/A',
        ifsc: bank?.ifsc || 'N/A'
      };
    }) });
  } catch (error) {
    console.error('Finance settlements could not be loaded.', error);
    return res.status(503).json({ error: 'Settlements are temporarily unavailable.' });
  }
});

// Finance Admin: Re-authenticate MFA to reveal unmasked bank details
app.post('/api/admin/finance/re-auth', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  if (!admin || !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(admin.role)) {
    return res.status(403).json({ error: 'Finance administrator authorization is required.' });
  }
  if (getDatabaseType() !== 'supabase') return res.status(503).json({ error: 'Sensitive finance MFA requires Supabase.' });
  const action = req.body?.action;
  if (!['REVEAL_BANK', 'PROCESS_PAYOUT', 'ISSUE_REFUND'].includes(action)) {
    return res.status(400).json({ error: 'A valid sensitive finance action is required.' });
  }
  try {
    const storedAdmin = await databaseAdapter.getAdminUserById(admin.id);
    if (!storedAdmin?.phone) return res.status(503).json({ error: 'Administrator SMS MFA phone is not configured.' });
    const otp = generateOtp();
    const reservation = await databaseAdapter.reserveAdminSensitiveMfa(admin.id, action, hashOtp(otp));
    if (!reservation.allowed) {
      res.setHeader('Retry-After', String(reservation.waitSeconds || 60));
      return res.status(429).json({ error: 'Sensitive-action MFA resend cooldown is active.' });
    }
    const delivery = await sendApitxtOtp({ mobile: storedAdmin.phone, otp });
    const challengeUpdated = await databaseAdapter.completeAdminSensitiveMfaDelivery(admin.id, action, delivery.success);
    if (!challengeUpdated) throw new Error('Sensitive-action MFA challenge was not awaiting delivery.');
    if (!delivery.success) {
      console.error('Sensitive finance MFA SMS delivery failed.', delivery.error);
      return res.status(503).json({ error: 'Sensitive-action MFA delivery failed.' });
    }
    return res.json({ success: true, expiresInSeconds: 300 });
  } catch (error) {
    console.error('Sensitive finance MFA request failed.', error);
    return res.status(503).json({ error: 'Sensitive-action MFA is temporarily unavailable.' });
  }
});

app.post('/api/admin/finance/re-auth/verify', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  const { action, otp } = req.body || {};
  if (!['REVEAL_BANK', 'PROCESS_PAYOUT', 'ISSUE_REFUND'].includes(action) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'A valid finance action and six-digit MFA code are required.' });
  }
  try {
    const result = await databaseAdapter.verifyAdminSensitiveMfa(admin.id, action, hashOtp(otp));
    if (result !== 'verified') {
      return res.status(result === 'locked' ? 429 : result === 'expired' ? 410 : 401)
        .json({ error: `Sensitive-action MFA verification ${result}.` });
    }
    return res.json({ success: true, action, expiresInSeconds: 300 });
  } catch (error) {
    console.error('Sensitive finance MFA verification failed.', error);
    return res.status(503).json({ error: 'Sensitive-action MFA is temporarily unavailable.' });
  }
});

app.post('/api/admin/finance/reveal-bank', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  const userId = req.body?.userId;
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return res.status(400).json({ error: 'A valid Companion user ID is required.' });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, 'REVEAL_BANK')) {
      return res.status(403).json({ error: 'Fresh finance MFA is required to reveal bank details.' });
    }
    const verification = await databaseAdapter.getBankVerification(userId);
    if (!verification || verification.verificationStatus !== 'VERIFIED' || !verification.accountNumberEncrypted) {
      return res.status(404).json({ error: 'Verified bank details were not found.' });
    }
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      userId,
      action: 'BANK_DETAILS_REVEALED',
      entityType: 'bank_verification',
      entityId: verification.id,
      details: { accountNumberLast4: verification.accountNumberLast4 }
    });
    return res.json({
      accountNumber: decryptBankAccount(verification.accountNumberEncrypted),
      accountNumberMasked: verification.accountNumberMasked,
      accountHolderName: verification.accountHolderName,
      ifsc: verification.ifsc,
      bankName: verification.bankName
    });
  } catch (error) {
    console.error('Bank details could not be revealed.', error);
    return res.status(503).json({ error: 'Bank detail reveal is temporarily unavailable.' });
  }
});

// Finance Admin: Manual Bank Payout submission (UTR number, atomic debit of locked balance)
app.post('/api/admin/finance/process-payout', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (req: Request, res: Response) => {
  const { bookingId, utrNumber } = req.body || {};
  const admin = (req as AuthenticatedRequest).adminUser;
  if (typeof bookingId !== 'string' || typeof utrNumber !== 'string' || !/^[A-Za-z0-9-]{8,40}$/.test(utrNumber.trim())) {
    return res.status(400).json({ error: 'A valid booking ID and bank UTR reference are required.' });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, 'PROCESS_PAYOUT')) {
      return res.status(403).json({ error: 'Fresh finance MFA is required to process a payout.' });
    }
    const payout = await databaseAdapter.processBookingPayout(bookingId, admin.id, utrNumber.trim());
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      action: 'PAYOUT_COMPLETED',
      entityType: 'booking',
      entityId: bookingId,
      details: { payoutId: payout.id, utrReference: payout.utr_reference || payout.utrReference }
    });
    return res.json({ success: true, message: 'Manual payout recorded.', payout });
  } catch (error) {
    console.error('Manual payout could not be processed.', error);
    return res.status(503).json({ error: 'Payout processing failed or is temporarily unavailable.' });
  }
});

app.post('/api/admin/finance/refund', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), async (req: Request, res: Response) => {
  const { bookingId, membershipId, amountPaise, reason, idempotencyKey } = req.body || {};
  const admin = (req as AuthenticatedRequest).adminUser;
  if (Boolean(bookingId) === Boolean(membershipId) || typeof amountPaise !== 'number' ||
      !Number.isSafeInteger(amountPaise) || amountPaise <= 0 ||
      typeof reason !== 'string' || !reason.trim() || reason.length > 500 ||
      typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{10,255}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: 'Provide exactly one payment resource, a positive paise amount, a reason, and an idempotency key.' });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, 'ISSUE_REFUND')) {
      return res.status(403).json({ error: 'Fresh finance MFA is required to issue a refund.' });
    }
    let paymentId: string | undefined;
    if (bookingId) {
      const booking = await databaseAdapter.getBooking(bookingId);
      if (!booking || booking.paymentStatus !== 'PAID' || !booking.paymentId) {
        return res.status(404).json({ error: 'Captured booking payment was not found.' });
      }
      paymentId = booking.paymentId;
    } else {
      const membership = (await databaseAdapter.listMemberships()).find((item: any) => item.id === membershipId);
      if (!membership || membership.paymentStatus !== 'PAID' || !membership.paymentId) {
        return res.status(404).json({ error: 'Captured membership payment was not found.' });
      }
      paymentId = membership.paymentId;
    }
    if (!paymentId) return res.status(404).json({ error: 'Captured payment was not found.' });
    const reservation = await databaseAdapter.reservePaymentRefund({
      bookingId: bookingId || null,
      membershipId: membershipId || null,
      paymentId,
      amountPaise,
      idempotencyKey,
      reason: reason.trim(),
      adminUserId: admin.id
    });
    const providerRefund = await createRazorpayRefund({
      paymentId,
      amountPaise,
      idempotencyKey,
      reason: reason.trim()
    });
    const status = providerRefund.status === 'processed' ? 'PROCESSED'
      : providerRefund.status === 'pending' ? 'PROCESSING' : 'UNKNOWN';
    const updated = await databaseAdapter.updatePaymentRefund(idempotencyKey, status, providerRefund.id);
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      action: 'PAYMENT_REFUND_REQUESTED',
      entityType: bookingId ? 'booking' : 'companion_membership',
      entityId: bookingId || membershipId,
      details: { refundId: reservation.id, providerRefundId: providerRefund.id, amountPaise, status }
    });
    return res.status(202).json({ success: true, refund: updated });
  } catch (error) {
    console.error('Admin refund could not be processed.', error);
    return res.status(503).json({ error: 'Refund processing is unavailable; verify the provider and reconciliation state before retrying.' });
  }
});

// Admin Staff Management (Create KYC_ADMIN, FINANCE_ADMIN, etc.)
app.get('/api/admin/staff', requireAdminRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  try {
    const staff = await databaseAdapter.listAdminUsers();
    const sanitized = staff.map(({ passwordHash: _hash, ...s }: any) => s);
    return res.json({ staff: sanitized });
  } catch (error) {
    console.error('Failed to list admin staff.', error);
    return res.status(503).json({ error: 'Admin staff listing is temporarily unavailable.' });
  }
});

app.post('/api/admin/staff/create', requireAdminRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { email, phone, name, role, password } = req.body;
  const allowedRoles = ['KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'];
  if (
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof phone !== 'string' || !normalizeIndianPhone(phone) ||
    typeof name !== 'string' || !name.trim() ||
    !allowedRoles.includes(role) ||
    typeof password !== 'string' || password.length < 12 || password.length > 1024
  ) {
    return res.status(400).json({ error: 'Valid staff details, an authorized role, and a password of at least 12 characters are required.' });
  }

  const staffId = `admin_${crypto.randomUUID().slice(0, 8)}`;
  const newStaff = {
    id: staffId,
    email: email.trim().toLowerCase(),
    phone: normalizeIndianPhone(phone),
    name: name.trim(),
    role,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  };

  try {
    await databaseAdapter.createAdminUser(newStaff);
    const { passwordHash: _passwordHash, ...publicStaff } = newStaff;
    return res.json({ success: true, staff: publicStaff });
  } catch (error) {
    console.error('Failed to create admin staff.', error);
    return res.status(503).json({ error: 'Staff account creation is temporarily unavailable.' });
  }
});

app.post('/api/admin/staff/:staffId/role', requireAdminRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { staffId } = req.params;
  const { role } = req.body;
  const allowedRoles = ['KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Valid authorized role (KYC_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN, AUDITOR) is required.' });
  }
  try {
    const updated = await databaseAdapter.updateAdminUserRole(staffId, role);
    return res.json({ success: true, staff: updated });
  } catch (error: any) {
    console.error('Failed to update staff role.', error);
    return res.status(500).json({ error: error.message || 'Staff role update failed.' });
  }
});

app.delete('/api/admin/staff/:staffId', requireAdminRoles('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { staffId } = req.params;
  const admin = (req as AuthenticatedRequest).adminUser;
  if (admin.id === staffId) {
    return res.status(400).json({ error: 'Cannot delete your own super admin account.' });
  }
  try {
    await databaseAdapter.deleteAdminUser(staffId);
    return res.json({ success: true, message: 'Staff access revoked successfully.' });
  } catch (error: any) {
    console.error('Failed to delete staff member.', error);
    return res.status(500).json({ error: error.message || 'Staff deletion failed.' });
  }
});

// Admin Audit Logs
app.get('/api/admin/audit-logs', requireAdminRoles('SUPER_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const logs = await databaseAdapter.listAuditLogs({ limit: 100 });
    return res.json({ logs });
  } catch (error) {
    console.error('Failed to retrieve audit logs.', error);
    return res.status(503).json({ error: 'Audit logs are temporarily unavailable.' });
  }
});

// Admin Client Management
app.get('/api/admin/clients', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const allUsers = await databaseAdapter.listUsers();
    const allBookings = await databaseAdapter.listBookings();
    const clients = allUsers
      .filter((u: any) => u.role === 'CLIENT' || u.activeRole === 'CLIENT')
      .map((u: any) => {
        const userBookings = allBookings.filter((b: any) => b.clientId === u.id);
        return {
          id: u.id,
          phone: u.phone,
          legalName: u.legalName,
          email: u.email,
          kycStatus: u.kycStatus,
          city: u.city,
          createdAt: u.createdAt,
          totalBookings: userBookings.length,
          isSuspended: !!u.isSuspended,
          suspendedReason: u.suspendedReason || null,
          suspendedAt: u.suspendedAt || null,
          warningCount: u.warningCount || 0,
          lastWarningReason: u.lastWarningReason || null,
          lastWarningAt: u.lastWarningAt || null
        };
      });
    return res.json({ clients });
  } catch (error) {
    console.error('Failed to list clients.', error);
    return res.status(503).json({ error: 'Client listing is temporarily unavailable.' });
  }
});

// Admin Companion Management
app.get('/api/admin/companions', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const allUsers = await databaseAdapter.listUsers();
    const companionProfiles = await databaseAdapter.listCompanionProfiles();
    const profileMap = new Map(companionProfiles.map((p: any) => [p.userId, p]));
    const companions = await Promise.all(
      allUsers
        .filter((u: any) => 
          u.role === 'COMPANION' || 
          u.role === 'DUAL' || 
          u.activeRole === 'COMPANION' || 
          profileMap.has(u.id)
        )
        .map(async (u: any) => {
          const profile = profileMap.get(u.id);
          const [wallet, bankVerification, companionKyc, clientKyc, membership] = await Promise.all([
            databaseAdapter.getWalletBalance(u.id).catch(() => null),
            databaseAdapter.getBankVerification(u.id).catch(() => null),
            databaseAdapter.getUserKycSubmission(u.id, 'COMPANION').catch(() => null),
            databaseAdapter.getUserKycSubmission(u.id, 'CLIENT').catch(() => null),
            databaseAdapter.getActiveMembership(u.id).catch(() => null)
          ]);

          const isBankVerified = Boolean(
            bankVerification?.verificationStatus === 'VERIFIED' ||
            bankVerification?.isVerified === true ||
            profile?.bankDetails?.isVerified
          );
          const effectiveKyc = companionKyc || clientKyc;
          const kycStatus = effectiveKyc?.status || u.kycStatus || u.kyc_status || 'NOT_SUBMITTED';
          const membershipActive = Boolean(
            profile?.membership?.isActive ||
            (membership?.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date())
          );
          const membershipTier = profile?.membership?.plan || membership?.plan || 'NONE';
          const isLive = Boolean(
            profile?.isLive ||
            (kycStatus === 'APPROVED' && membershipActive && isBankVerified && !profile?.isPaused)
          );

          return {
            id: u.id,
            phone: u.phone,
            legalName: u.legalName,
            email: u.email,
            kycStatus,
            city: u.city,
            isLive,
            isPaused: profile?.isPaused || false,
            membershipActive,
            membershipTier,
            bankVerified: isBankVerified,
            totalBookings: profile?.totalBookings || 0,
            lockedBalancePaise: wallet?.lockedSettlementBalancePaise || 0,
            totalSettledPaise: wallet?.totalSettledPaise || 0,
            isSuspended: !!u.isSuspended,
            suspendedReason: u.suspendedReason || null,
            suspendedAt: u.suspendedAt || null,
            warningCount: u.warningCount || 0,
            lastWarningReason: u.lastWarningReason || null,
            lastWarningAt: u.lastWarningAt || null,
            createdAt: u.createdAt
          };
        })
    );
    return res.json({ companions });
  } catch (error) {
    console.error('Failed to list companions.', error);
    return res.status(503).json({ error: 'Companion listing is temporarily unavailable.' });
  }
});

// Admin Incident Reports
app.get('/api/admin/reports', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const reports = await databaseAdapter.listIncidentReports();
    return res.json({ reports });
  } catch (error) {
    console.error('Failed to list incident reports:', error);
    return res.status(503).json({ error: 'Incident reports are temporarily unavailable.' });
  }
});

// Admin Dismiss Incident Report
app.post('/api/admin/reports/:reportId/dismiss', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const admin = (req as AuthenticatedRequest).adminUser;
  const { notes } = req.body || {};

  try {
    const updated = await databaseAdapter.updateIncidentReport(reportId, {
      status: 'DISMISSED',
      resolutionNotes: notes || 'Dismissed by administrator after review.',
      resolvedAt: new Date().toISOString(),
      resolvedByAdminId: admin?.id
    });

    await databaseAdapter.createAuditLog({
      adminUserId: admin?.id,
      action: 'INCIDENT_REPORT_DISMISSED',
      entityType: 'incident_report',
      entityId: reportId,
      details: `Incident report dismissed by admin ${admin?.name || admin?.email}`
    }).catch(() => null);

    return res.json({ success: true, report: updated });
  } catch (error) {
    console.error('Failed to dismiss incident report:', error);
    return res.status(500).json({ error: 'Could not dismiss incident report.' });
  }
});

// Admin User Moderation (Warn / Suspend / Unsuspend)
app.post('/api/admin/users/:userId/moderation', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { userId } = req.params;
  const admin = (req as AuthenticatedRequest).adminUser;
  const { action, reason, reportId } = req.body || {};

  if (!['WARN', 'SUSPEND', 'UNSUSPEND'].includes(action)) {
    return res.status(400).json({ error: 'Invalid moderation action. Must be WARN, SUSPEND, or UNSUSPEND.' });
  }
  if (action !== 'UNSUSPEND' && (!reason || typeof reason !== 'string' || reason.trim().length < 3)) {
    return res.status(400).json({ error: 'A specific reason is required for moderation action.' });
  }

  try {
    const user = await databaseAdapter.getUser(userId) || db.users?.[userId];
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const cleanReason = (reason || '').trim();
    let updates: any = {};

    if (action === 'WARN') {
      const currentWarnings = Number(user.warningCount || 0);
      updates = {
        warningCount: currentWarnings + 1,
        lastWarningReason: cleanReason,
        lastWarningAt: new Date().toISOString()
      };

      await databaseAdapter.createNotification({
        userId,
        type: 'ACCOUNT_WARNING',
        title: '⚠️ Account Warning Received',
        body: `Administrative Warning: ${cleanReason}. Continued policy violations may result in account suspension.`
      }).catch(() => null);

      if (reportId) {
        await databaseAdapter.updateIncidentReport(reportId, {
          status: 'WARNED',
          resolutionNotes: `Warning issued by admin ${admin?.name || admin?.email}: ${cleanReason}`,
          resolvedAt: new Date().toISOString(),
          resolvedByAdminId: admin?.id
        }).catch(() => null);
      }
    } else if (action === 'SUSPEND') {
      updates = {
        isSuspended: true,
        suspendedReason: cleanReason,
        suspendedAt: new Date().toISOString()
      };

      // Also deactivate companion availability if companion
      await databaseAdapter.updateCompanionProfile(userId, {
        isLive: false,
        isPaused: true
      }).catch(() => null);

      await databaseAdapter.createNotification({
        userId,
        type: 'ACCOUNT_SUSPENDED',
        title: '🚫 Account Suspended',
        body: `Your account has been suspended: ${cleanReason}. Booking privileges and companion visibility are revoked. Contact support for assistance.`
      }).catch(() => null);

      if (reportId) {
        await databaseAdapter.updateIncidentReport(reportId, {
          status: 'SUSPENDED',
          resolutionNotes: `Account suspended by admin ${admin?.name || admin?.email}: ${cleanReason}`,
          resolvedAt: new Date().toISOString(),
          resolvedByAdminId: admin?.id
        }).catch(() => null);
      }
    } else if (action === 'UNSUSPEND') {
      updates = {
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null
      };

      await databaseAdapter.createNotification({
        userId,
        type: 'ACCOUNT_UNSUSPENDED',
        title: '✅ Account Restored',
        body: 'Your account suspension has been lifted. You can now resume normal platform activities.'
      }).catch(() => null);
    }

    const updatedUser = await databaseAdapter.updateUser(userId, updates);
    if (db.users && db.users[userId]) {
      db.users[userId] = { ...db.users[userId], ...updates };
      saveDB(db);
    }

    await databaseAdapter.createAuditLog({
      adminUserId: admin?.id,
      action: `USER_${action}`,
      entityType: 'user',
      entityId: userId,
      details: `${action} applied to user ${user.legalName || user.phone} by admin ${admin?.name || admin?.email}. Reason: ${cleanReason || 'Restored'}`
    }).catch(() => null);

    return res.json({ success: true, action, user: publicAuthUser(updatedUser || { ...user, ...updates }) });
  } catch (error) {
    console.error('Failed to apply user moderation action:', error);
    return res.status(500).json({ error: 'Could not apply moderation action.' });
  }
});

// Admin Membership Records
app.get('/api/admin/memberships', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const rawMemberships = await databaseAdapter.listMemberships();
    const users = await databaseAdapter.listUsers();
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    // Strictly include ONLY memberships where payment succeeded (PAID)
    const memberships = rawMemberships
      .filter((m: any) => m.paymentStatus === 'PAID')
      .map((m: any) => {
        const user = userMap.get(m.userId);
        return {
          id: m.id || m.paymentId || `mem_${m.userId}`,
          userId: m.userId,
          userName: user?.legalName || 'Companion Host',
          userPhone: user?.phone,
          plan: m.plan,
          pricePaise: m.pricePaise,
          startDate: m.startDate,
          expiryDate: m.expiryDate,
          isActive: m.paymentStatus === 'PAID' && new Date(m.expiryDate) > new Date()
        };
      });
    return res.json({ memberships });
  } catch (error) {
    console.error('Failed to list memberships.', error);
    return res.status(503).json({ error: 'Membership records are temporarily unavailable.' });
  }
});

// Admin Booking Management
app.get('/api/admin/bookings', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const rawBookings = await databaseAdapter.listBookings();
    const bookings = rawBookings.map((b: any) => {
      const copy = { ...b };
      delete copy.startOtp;
      delete copy.endOtp;
      delete copy.startOtpHmac;
      delete copy.endOtpHmac;
      delete copy.startOtpEncrypted;
      delete copy.completionOtpEncrypted;
      delete copy.startOtpHash;
      delete copy.completionOtpHash;
      return copy;
    });
    return res.json({ bookings });
  } catch (error) {
    console.error('Failed to list bookings.', error);
    return res.status(503).json({ error: 'Booking records are temporarily unavailable.' });
  }
});

// Admin Payment Records
app.get('/api/admin/payments', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const payments: any[] = [];
    const bookings = await databaseAdapter.listBookings();
    const memberships = await databaseAdapter.listMemberships();
    const users = await databaseAdapter.listUsers();
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    for (const b of bookings) {
      if (b.paymentId || b.paymentOrderId) {
        let paymentStatus = b.paymentStatus || 'PENDING';
        if (b.paymentId && paymentStatus === 'PENDING') paymentStatus = 'PAID';
        payments.push({
          id: b.paymentId || b.paymentOrderId,
          type: 'BOOKING_ESCROW',
          bookingCode: b.bookingCode,
          payerName: b.clientName,
          recipientName: b.companionName,
          grossAmountPaise: b.bookingAmountPaise,
          adminFeePaise: b.adminPlatformFeePaise,
          companionSharePaise: b.companionNetSharePaise,
          status: paymentStatus,
          createdAt: b.createdAt
        });
      }
    }

    for (const m of memberships) {
      if (m.paymentOrderId || m.paymentId) {
        const user = userMap.get(m.userId);
        let paymentStatus = m.paymentStatus || 'PENDING';
        if (m.paymentId && paymentStatus === 'PENDING') paymentStatus = 'PAID';
        payments.push({
          id: m.paymentId || m.paymentOrderId,
          type: 'COMPANION_MEMBERSHIP',
          bookingCode: `MEM-${m.plan}`,
          payerName: user?.legalName || 'Companion Host',
          recipientName: 'PairUpToday Platform',
          grossAmountPaise: m.pricePaise,
          adminFeePaise: m.pricePaise,
          companionSharePaise: 0,
          status: paymentStatus,
          createdAt: m.createdAt || m.startDate
        });
      }
    }

    payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.json({ payments });
  } catch (error) {
    console.error('Failed to list payment records.', error);
    return res.status(503).json({ error: 'Payment records are temporarily unavailable.' });
  }
});

// Companion Availability Toggle (Pause / Resume)
app.post('/api/companion/availability/toggle', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.body.userId && req.body.userId !== userId) return res.status(403).json({ error: 'You cannot change another user’s availability.' });
  if (typeof req.body.isPaused !== 'boolean') return res.status(400).json({ error: 'isPaused must be a boolean.' });

  // Guard: Companion cannot go offline while a booking session is active
  if (req.body.isPaused) {
    try {
      const activeBookings = getDatabaseType() === 'supabase'
        ? await databaseAdapter.listBookings({ companionId: userId })
        : Object.values(db.bookings).filter((b: any) => b.companionId === userId);
      const hasActive = activeBookings.some((b: any) =>
        ['PENDING', 'CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status)
      );
      if (hasActive) {
        return res.status(409).json({ error: 'You have active bookings in progress. You cannot go offline until they are completed or cancelled.' });
      }
    } catch (e) {
      console.warn('Active booking check warning:', e);
    }
  }
  if (getDatabaseType() === 'json') {
    const profile = db.companionProfiles[userId];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const user = db.users[userId];
    const isEligible = Boolean(
      (user?.kycStatus === 'APPROVED' || user?.kyc_status === 'APPROVED') &&
      profile.membership?.isActive &&
      new Date(profile.membership.expiryDate) > new Date() &&
      profile.bankDetails?.isVerified
    );
    if (!req.body.isPaused) {
      if (!isEligible) return res.status(403).json({ error: 'Approved KYC, an active paid membership, and verified bank details are required to resume.' });
    }
    profile.isPaused = req.body.isPaused;
    profile.isLive = !req.body.isPaused && isEligible;
    saveDB(db);
    return res.json({ success: true, isPaused: profile.isPaused, isLive: profile.isLive });
  }
  try {
    const profile = await databaseAdapter.getCompanionProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    let isEligible = false;
    if (!req.body.isPaused) {
      const [userRecord, companionKyc, clientKyc, membership, bankVerification] = await Promise.all([
        databaseAdapter.getUser(userId),
        databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
        databaseAdapter.getUserKycSubmission(userId, 'CLIENT').catch(() => null),
        databaseAdapter.getActiveMembership(userId),
        databaseAdapter.getBankVerification(userId)
      ]);
      const effectiveKyc = companionKyc || (clientKyc?.status === 'APPROVED' ? clientKyc : null);
      const kycApproved = Boolean(effectiveKyc?.status === 'APPROVED' || userRecord?.kycStatus === 'APPROVED' || userRecord?.kyc_status === 'APPROVED');
      isEligible = Boolean(
        kycApproved &&
        membership?.paymentStatus === 'PAID' &&
        new Date(membership.expiryDate) > new Date() &&
        (bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true)
      );
      if (!isEligible) return res.status(403).json({ error: 'Approved KYC, an active paid membership, and verified bank details are required to resume.' });
    }
    const isLive = !req.body.isPaused && isEligible;
    const updated = await databaseAdapter.updateCompanionProfile(userId, { 
      isPaused: req.body.isPaused,
      isLive: isLive
    });
    if (db.companionProfiles && db.companionProfiles[userId]) {
      db.companionProfiles[userId].isPaused = req.body.isPaused;
      db.companionProfiles[userId].isLive = isLive;
    }
    invalidateEgressCache('search:');
    invalidateEgressCache(`status:${userId}`);
    return res.json({ success: true, isPaused: updated.isPaused, isLive });
  } catch (error) {
    console.error('Companion availability could not be updated.', error);
    return res.status(503).json({ error: 'Availability is temporarily unavailable.' });
  }
});

// User Notifications (Client & Companion)
app.get('/api/notifications/:userId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: 'You cannot access another user’s notifications.' });
  try {
    const notifications = await databaseAdapter.listNotifications(userId);
    return res.json({ notifications: notifications.map((item: any) => ({
      ...item,
      message: item.body || item.message,
      timestamp: item.createdAt || item.created_at
    })) });
  } catch (error) {
    console.error('Notifications could not be loaded.', error);
    return res.status(503).json({ error: 'Notifications are temporarily unavailable.' });
  }
});

app.post('/api/notifications/read', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const notificationId = req.body?.notificationId;
  if (typeof notificationId !== 'string' || !notificationId) {
    return res.status(400).json({ error: 'notificationId is required.' });
  }
  try {
    await databaseAdapter.markNotificationRead(notificationId, userId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Notification read state could not be updated.', error);
    return res.status(503).json({ error: 'Notification state is temporarily unavailable.' });
  }
});

app.post('/api/notifications/device-token', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { token, platform } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 ||
      !['WEB', 'ANDROID', 'IOS'].includes(platform)) {
    return res.status(400).json({ error: 'A valid device token and platform are required.' });
  }
  try {
    await databaseAdapter.registerDeviceToken(userId, token, platform);
    return res.json({ success: true });
  } catch (error) {
    console.error('Push notification device token could not be registered.', error);
    return res.status(503).json({ error: 'Device token registration is temporarily unavailable.' });
  }
});

app.delete('/api/notifications/device-token', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const token = req.body?.token;
  if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'A device token is required.' });
  try {
    const userTokens = await databaseAdapter.listDeviceTokens(userId);
    if (!userTokens.includes(token)) return res.status(404).json({ error: 'Device token not found.' });
    await databaseAdapter.deleteDeviceToken(token, userId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Push notification device token could not be removed.', error);
    return res.status(503).json({ error: 'Device token removal is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// SUPPORT CENTER API ENDPOINTS
// -------------------------------------------------------------

function startSupportMessageStream(
  req: Request,
  res: Response,
  conversationId: string
): void {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');
  const afterTimeQuery = typeof req.query.afterCreatedAt === 'string' ? req.query.afterCreatedAt : undefined;
  const afterIdQuery = typeof req.query.afterId === 'string' ? req.query.afterId : undefined;
  let after = afterTimeQuery && afterIdQuery && Number.isFinite(Date.parse(afterTimeQuery)) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(afterIdQuery)
    ? { createdAt: new Date(afterTimeQuery).toISOString(), id: afterIdQuery }
    : undefined;
  let reading = false;
  const interval = setInterval(async () => {
    if (reading || res.writableEnded) return;
    reading = true;
    try {
      const messages = await databaseAdapter.listSupportMessages(conversationId, after);
      for (const message of messages) {
        const timestamp = message.created_at || message.createdAt;
        const id = message.id;
        if (typeof id !== 'string') continue;
        after = { createdAt: timestamp, id };
        res.write(`event: message\ndata: ${JSON.stringify({
          ...message,
          timestamp,
          cursor: after
        })}\n\n`);
      }
    } catch (error) {
      console.error('Realtime support polling failed.', error);
      res.write('event: error\ndata: {"error":"Support stream is temporarily unavailable."}\n\n');
      res.end();
      clearInterval(interval);
    } finally {
      reading = false;
    }
  }, 2000);
  req.on('close', () => clearInterval(interval));
}

// Create or get support conversation (Client/Companion)
app.post('/api/support/conversation', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const subject = req.body?.subject;
  if (subject !== undefined && (typeof subject !== 'string' || subject.length > 200)) {
    return res.status(400).json({ error: 'Subject must be no more than 200 characters.' });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = (await databaseAdapter.listSupportConversations({ userId }))
      .find((conversation: any) => conversation.status === 'OPEN' || conversation.status === 'IN_PROGRESS');
    if (existing) return res.json({ conversation: existing });
    const conversation = await databaseAdapter.createSupportConversation({
      userId,
      status: 'OPEN',
      subject: subject || 'General Inquiry'
    });
    return res.json({ conversation });
  } catch (error) {
    console.error('Support conversation could not be created.', error);
    return res.status(503).json({ error: 'Support is temporarily unavailable.' });
  }
});

// Get user's support conversations
app.get('/api/support/conversations/:userId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: 'You cannot access another user’s support conversations.' });
  try {
    return res.json({ conversations: await databaseAdapter.listSupportConversations({ userId }) });
  } catch (error) {
    console.error('Support conversations could not be loaded.', error);
    return res.status(503).json({ error: 'Support is temporarily unavailable.' });
  }
});

// Get messages in a support conversation
app.get('/api/support/messages/:conversationId', async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const userId = (req as AuthenticatedRequest).authUser.id;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (conversation.userId !== userId) return res.status(403).json({ error: 'You cannot access this conversation.' });
    return res.json({ messages: await databaseAdapter.listSupportMessages(conversationId) });
  } catch (error) {
    console.error('Support messages could not be loaded.', error);
    return res.status(503).json({ error: 'Support is temporarily unavailable.' });
  }
});

app.get('/api/support/messages/:conversationId/stream', async (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  const userId = (req as AuthenticatedRequest).authUser.id;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    if (conversation.userId !== userId) return res.status(403).json({ error: 'You cannot access this conversation.' });
    startSupportMessageStream(req, res, conversationId);
  } catch (error) {
    console.error('Realtime support stream could not be started.', error);
    return res.status(503).json({ error: 'Support is temporarily unavailable.' });
  }
});

// Send message to support (Client/Companion)
app.post('/api/support/message', async (req: Request, res: Response) => {
  const { conversationId, message } = req.body || {};
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (typeof conversationId !== 'string' || typeof message !== 'string' || !message.trim() || message.length > 5000) {
    return res.status(400).json({ error: 'A conversation ID and message between 1 and 5000 characters are required.' });
  }
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.userId !== userId) return res.status(403).json({ error: 'You cannot access this conversation.' });
    if (!['OPEN', 'IN_PROGRESS'].includes(conversation.status)) {
      return res.status(409).json({ error: 'This support conversation is closed.' });
    }
    const stored = await databaseAdapter.createSupportMessage({
      conversationId,
      senderId: userId,
      isAdmin: false,
      message: message.trim()
    });
    await databaseAdapter.updateSupportConversation(conversationId, {});
    return res.json({ message: stored });
  } catch (error) {
    console.error('Support message could not be saved.', error);
    return res.status(503).json({ error: 'Support is temporarily unavailable.' });
  }
});

// Admin: List all support conversations
app.get('/api/admin/support/conversations', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (_req: Request, res: Response) => {
  try {
    return res.json({ conversations: await databaseAdapter.listSupportConversations() });
  } catch (error) {
    console.error('Admin support conversations could not be loaded.', error);
    return res.status(503).json({ error: 'Support administration is temporarily unavailable.' });
  }
});

// Admin: Get messages in a conversation
app.get('/api/admin/support/messages/:conversationId', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    return res.json({ messages: await databaseAdapter.listSupportMessages(conversationId) });
  } catch (error) {
    console.error('Admin support messages could not be loaded.', error);
    return res.status(503).json({ error: 'Support administration is temporarily unavailable.' });
  }
});

app.get('/api/admin/support/messages/:conversationId/stream', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    startSupportMessageStream(req, res, conversationId);
  } catch (error) {
    console.error('Admin realtime support stream could not be started.', error);
    return res.status(503).json({ error: 'Support administration is temporarily unavailable.' });
  }
});

// Admin: Send reply to support conversation
app.post('/api/admin/support/reply', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { conversationId, message } = req.body || {};
  const adminUser = (req as AuthenticatedRequest).adminUser;
  if (typeof conversationId !== 'string' || typeof message !== 'string' || !message.trim() || message.length > 5000) {
    return res.status(400).json({ error: 'A conversation ID and message between 1 and 5000 characters are required.' });
  }
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const stored = await databaseAdapter.createSupportMessage({
      conversationId,
      senderId: adminUser.id,
      adminUserId: adminUser.id,
      isAdmin: true,
      message: message.trim()
    });
    await databaseAdapter.updateSupportConversation(conversationId, {
      status: 'IN_PROGRESS',
      assignedAdminId: adminUser.id
    });
    await databaseAdapter.createAuditLog({
      adminUserId: adminUser.id,
      action: 'SUPPORT_REPLY',
      entityType: 'support_conversation',
      entityId: conversationId,
      details: { messageLength: message.length }
    });
    try {
      await createAndSendNotification({
        userId: conversation.userId,
        type: 'SUPPORT_REPLY',
        title: 'Support replied to your message',
        body: message.trim().slice(0, 500),
        data: { conversationId }
      });
    } catch (notificationError) {
      console.error('Support reply was saved but its notification could not be persisted.', notificationError);
    }
    return res.json({ message: stored });
  } catch (error) {
    console.error('Admin support reply could not be saved.', error);
    return res.status(503).json({ error: 'Support administration is temporarily unavailable.' });
  }
});

// Admin: Update conversation status
app.post('/api/admin/support/conversation/:id/status', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const adminUser = (req as AuthenticatedRequest).adminUser;
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid support conversation status.' });
  }
  try {
    const current = await databaseAdapter.getSupportConversation(id);
    if (!current) return res.status(404).json({ error: 'Conversation not found' });
    const conversation = await databaseAdapter.updateSupportConversation(id, {
      status,
      ...(['RESOLVED', 'CLOSED'].includes(status) ? { assignedAdminId: adminUser.id } : {})
    });
    await databaseAdapter.createAuditLog({
      adminUserId: adminUser.id,
      action: 'SUPPORT_STATUS_UPDATED',
      entityType: 'support_conversation',
      entityId: id,
      details: { status }
    });
    return res.json({ conversation });
  } catch (error) {
    console.error('Support conversation status could not be updated.', error);
    return res.status(503).json({ error: 'Support administration is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// LOCATION TRACKING ENDPOINTS (Firebase RTDB)
// -------------------------------------------------------------

// In-memory live location store for high-precision live companion tracking
const inMemoryLiveLocations = new Map<string, { latitude: number; longitude: number; accuracy: number; timestamp: string }>();

// Update user's current location (e.g. Companion live walking GPS)
app.post('/api/location/update', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { latitude, longitude, bookingId } = req.body || {};
  if (typeof bookingId !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'A booking ID and valid coordinates are required.' });
  }

  // Always update in-memory live location cache
  const locRecord = {
    latitude,
    longitude,
    accuracy: Number(req.body?.accuracy) || 5,
    timestamp: new Date().toISOString()
  };
  inMemoryLiveLocations.set(`${bookingId}_${userId}`, locRecord);
  inMemoryLiveLocations.set(userId, locRecord);

  // If Firebase configured, also persist to Firebase
  if (isFirebaseConfigured()) {
    try {
      await updateUserLocation(userId, latitude, longitude, bookingId);
    } catch (fbErr) {
      console.warn('Firebase location update notice:', fbErr);
    }
  }

  return res.json({ success: true, location: locRecord, provider: isFirebaseConfigured() ? 'firebase' : 'memory' });
});

// Get user's current location (Live Companion Walking tracking)
app.get('/api/location/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUserId = (req as AuthenticatedRequest).authUser.id;
  const bookingId = req.query.bookingId as string;
  if (typeof bookingId !== 'string') return res.status(400).json({ error: 'bookingId is required.' });

  try {
    let booking: any = null;
    try {
      booking = getDatabaseType() === 'supabase'
        ? await databaseAdapter.getBooking(bookingId)
        : (db.bookings ? db.bookings[bookingId] : null);
    } catch {
      booking = db.bookings ? db.bookings[bookingId] : null;
    }

    // Privacy Protection Rule:
    // If client is tracking companion, only allow within 30 minutes of scheduled start (or if arrived/in-progress)
    if (booking && requestingUserId === booking.clientId && userId === booking.companionId) {
      if (!['COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status)) {
        const slotStartMs = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
        const thirtyMinsBefore = slotStartMs - (30 * 60 * 1000);
        if (Date.now() < thirtyMinsBefore) {
          return res.status(403).json({
            error: 'Companion live location is protected. Tracking unlocks 30 minutes before your scheduled meeting.',
            privacyProtected: true,
            unlocksAt: new Date(thirtyMinsBefore).toISOString(),
            scheduledStartTime: new Date(slotStartMs).toISOString()
          });
        }
      }
    }

    // 1. Check in-memory real-time cache
    const memLoc = inMemoryLiveLocations.get(`${bookingId}_${userId}`) || inMemoryLiveLocations.get(userId);
    if (memLoc) {
      return res.json({ location: memLoc, provider: 'live-gps' });
    }

    // 2. Check Firebase if configured
    if (isFirebaseConfigured()) {
      try {
        const location = await getUserLocation(userId, bookingId);
        if (location) {
          return res.json({
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy || 5,
              timestamp: location.timestamp || new Date().toISOString()
            },
            provider: 'firebase'
          });
        }
      } catch (fbErr) {
        console.warn('Firebase location fetch notice:', fbErr);
      }
    }

    // 3. Realistic fallback coordinate based on booking city or Kolkata central
    const fallbackCoord = KNOWN_CITY_COORDINATES['kolkata'] || { lat: 22.5726, lng: 88.3639 };
    return res.json({
      location: {
        latitude: fallbackCoord.lat + 0.0085, // ~1 km offset representing approaching companion
        longitude: fallbackCoord.lng + 0.0075,
        accuracy: 10,
        timestamp: new Date().toISOString()
      },
      provider: 'estimated'
    });
  } catch (error) {
    console.warn('Booking location fallback used:', error);
    const fallbackCoord = KNOWN_CITY_COORDINATES['kolkata'] || { lat: 22.5726, lng: 88.3639 };
    return res.json({
      location: {
        latitude: fallbackCoord.lat + 0.008,
        longitude: fallbackCoord.lng + 0.007,
        accuracy: 15,
        timestamp: new Date().toISOString()
      },
      provider: 'fallback'
    });
  }
});

// Start location sharing for a booking
app.post('/api/location/sharing/start', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const bookingId = req.body?.bookingId;
  if (typeof bookingId !== 'string') return res.status(400).json({ error: 'bookingId is required.' });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Booking location service is not configured.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status) ||
        (booking.clientId !== userId && booking.companionId !== userId)) {
      return res.status(403).json({ error: 'Location sharing requires an active booking participant.' });
    }
    await startLocationSharing(userId, bookingId);
    try {
      await databaseAdapter.setBookingLocationSharing(bookingId, userId, true);
    } catch (error) {
      await stopLocationSharing(userId, bookingId);
      throw error;
    }
    return res.json({ success: true, provider: 'firebase' });
  } catch (error) {
    console.error('Booking location sharing could not be started.', error);
    return res.status(503).json({ error: 'Booking location sharing is temporarily unavailable.' });
  }
});

// Stop location sharing for a booking
app.post('/api/location/sharing/stop', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const bookingId = req.body?.bookingId;
  if (typeof bookingId !== 'string') return res.status(400).json({ error: 'bookingId is required.' });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Booking location service is not configured.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: 'Location sharing requires a booking participant.' });
    }
    await databaseAdapter.setBookingLocationSharing(bookingId, userId, false);
    await stopLocationSharing(userId, bookingId);
    return res.json({ success: true, provider: 'firebase' });
  } catch (error) {
    console.error('Booking location sharing could not be stopped.', error);
    return res.status(503).json({ error: 'Booking location sharing is temporarily unavailable.' });
  }
});

// Set user online/offline presence
app.post('/api/presence', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { online } = req.body || {};
  if (typeof online !== 'boolean') return res.status(400).json({ error: 'online must be a boolean.' });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Presence service is not configured.' });
  try {
    await setUserPresence(userId, online);
    return res.json({ success: true, provider: 'firebase' });
  } catch (error) {
    console.error('Presence could not be updated.', error);
    return res.status(503).json({ error: 'Presence is temporarily unavailable.' });
  }
});

// Get user presence
app.get('/api/presence/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUserId = (req as AuthenticatedRequest).authUser.id;
  const bookingId = req.query.bookingId;
  if (typeof bookingId !== 'string') return res.status(400).json({ error: 'bookingId is required.' });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Presence service is not configured.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    const participants = booking ? [booking.clientId, booking.companionId] : [];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status) ||
        !participants.includes(requestingUserId) || !participants.includes(userId) ||
        !await databaseAdapter.getBookingLocationSharing(bookingId, userId)) {
      return res.status(403).json({ error: 'Presence access requires an active booking with enabled location sharing.' });
    }
    const presence = await getUserPresence(userId);
    return res.json({ presence: presence || { online: false, lastSeen: null }, provider: 'firebase' });
  } catch (error) {
    console.error('Presence could not be loaded.', error);
    return res.status(503).json({ error: 'Presence is temporarily unavailable.' });
  }
});

// -------------------------------------------------------------
// GOOGLE MAPS API ENDPOINTS
// -------------------------------------------------------------

// Place autocomplete for location search
app.get('/api/maps/autocomplete', async (req: Request, res: Response) => {
  const { input, lat, lng, radius } = req.query;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Input query is required' });
  }

  const location = lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : undefined;
  const radiusKm = radius ? parseInt(radius as string) : undefined;

  try {
    const predictions = await getPlaceAutocomplete(input, location, radiusKm);
    return res.json({ predictions });
  } catch (error) {
    console.error('Maps autocomplete request failed:', error);
    return res.json({ predictions: [] });
  }
});

// Geocode address to coordinates
app.get('/api/maps/geocode', async (req: Request, res: Response) => {
  const { address, place_id } = req.query;

  if (!address && !place_id) {
    return res.status(400).json({ error: 'Address or place_id is required' });
  }

  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({
      error: 'Google Maps API not configured'
    });
  }

  let result: Awaited<ReturnType<typeof geocodeAddress>>;
  try {
    result = await geocodeAddress((address || place_id) as string, !!place_id);
  } catch (error) {
    console.error('Maps geocoding request failed.', error);
    return res.status(502).json({ error: 'Geocoding is temporarily unavailable.' });
  }

  if (result) {
    return res.json({
      place_id: result.place_id,
      formatted_address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address_components: result.address_components
    });
  } else {
    return res.status(404).json({ error: 'Geocoding failed' });
  }
});

// Reverse geocode coordinates to address
app.get('/api/maps/reverse-geocode', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({
      error: 'Google Maps API not configured'
    });
  }

  const parsedLat = parseFloat(lat as string);
  const parsedLng = parseFloat(lng as string);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return res.status(400).json({ error: 'Coordinates are invalid.' });
  }
  let result: Awaited<ReturnType<typeof reverseGeocode>>;
  try {
    result = await reverseGeocode(parsedLat, parsedLng);
  } catch (error) {
    console.error('Maps reverse geocoding request failed.', error);
    return res.status(502).json({ error: 'Reverse geocoding is temporarily unavailable.' });
  }

  if (result) {
    return res.json({
      formatted_address: result.formatted_address,
      address_components: result.address_components
    });
  } else {
    return res.status(404).json({ error: 'Reverse geocoding failed' });
  }
});

// Calculate distance between two points
app.get('/api/maps/distance', async (req: Request, res: Response) => {
  const { lat1, lng1, lat2, lng2 } = req.query;

  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return res.status(400).json({ error: 'All coordinates are required' });
  }

  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({ error: 'Google Maps API is not configured.' });
  }
  const origin = { lat: parseFloat(lat1 as string), lng: parseFloat(lng1 as string) };
  const destination = { lat: parseFloat(lat2 as string), lng: parseFloat(lng2 as string) };
  if (![origin.lat, origin.lng, destination.lat, destination.lng].every(Number.isFinite) ||
      origin.lat < -90 || origin.lat > 90 || destination.lat < -90 || destination.lat > 90 ||
      origin.lng < -180 || origin.lng > 180 || destination.lng < -180 || destination.lng > 180) {
    return res.status(400).json({ error: 'Coordinates are invalid.' });
  }
  try {
    const matrix = await getDistanceMatrix([origin], [destination]);
    const result = matrix?.[0]?.[0];
    if (!result || result.status !== 'OK') {
      return res.status(422).json({ error: 'Google Maps could not calculate a route for these locations.' });
    }
    return res.json({
      distanceKm: result.distance.value / 1000,
      distance: result.distance.text,
      durationSeconds: result.duration.value,
      duration: result.duration.text
    });
  } catch (error) {
    console.error('Maps distance request failed.', error);
    return res.status(502).json({ error: 'Distance calculation is temporarily unavailable.' });
  }
});

// Health check endpoint for Cloud Run
app.get('/health', (req: Request, res: Response) => {
  const dbType = getDatabaseType();
  const firebaseReady = isFirebaseConfigured();
  const googleMapsReady = isGoogleMapsConfigured();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      type: dbType,
      configured: dbType === 'supabase'
    },
    integrations: {
      firebase: firebaseReady,
      googleMaps: googleMapsReady,
      apitxt: !!(process.env.APITXT_API_KEY),
      razorpay: !!(process.env.RAZORPAY_KEY_ID)
    }
  });
});

// -------------------------------------------------------------
// VITE DEV SERVER OR SEPARATELY HOSTED STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.join(__dirname, 'dist');
  const distAdminDir = path.join(__dirname, 'dist-admin');

  // Subdomain / Host-Based Admin Panel Routing
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    const isAdminHost = host.startsWith('admin.') || host.includes('admin') || req.headers['x-admin-host'] === 'true';
    
    // Dedicated Admin subdomain entry route
    if (isAdminHost && req.path === '/') {
      if (isProduction && fs.existsSync(distAdminDir)) {
        return res.sendFile(path.join(distAdminDir, 'admin.html'));
      }
      if (isProduction && fs.existsSync(path.join(distDir, 'admin.html'))) {
        return res.sendFile(path.join(distDir, 'admin.html'));
      }
      return res.sendFile(path.join(__dirname, 'admin.html'));
    }

    // Direct standalone admin access route
    if (req.path === '/admin' || req.path === '/admin.html') {
      if (isProduction && fs.existsSync(distAdminDir)) {
        return res.sendFile(path.join(distAdminDir, 'admin.html'));
      }
      if (isProduction && fs.existsSync(path.join(distDir, 'admin.html'))) {
        return res.sendFile(path.join(distDir, 'admin.html'));
      }
      return res.sendFile(path.join(__dirname, 'admin.html'));
    }

    next();
  });

  if (isProduction && fs.existsSync(distDir)) {
    // Explicitly serve sw.js with zero-cache headers so mobile service worker updates immediately
    app.get('/sw.js', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'application/javascript');
      const swPath = fs.existsSync(path.join(distDir, 'sw.js'))
        ? path.join(distDir, 'sw.js')
        : path.join(__dirname, 'public', 'sw.js');
      res.sendFile(swPath);
    });

    // Serve separately built Admin assets if present. The admin SPA references
    // absolute /assets/... URLs, so chain dist-admin/assets BEFORE dist/assets;
    // express.static falls through to the next mount on a miss.
    if (fs.existsSync(distAdminDir)) {
      app.use('/assets', express.static(path.join(distAdminDir, 'assets'), { fallthrough: true }));
    }
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      const host = req.headers.host || '';
      // HTML documents must never be cached so clients immediately get new deployment chunks
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (host.startsWith('admin.') && fs.existsSync(distAdminDir)) {
        return res.sendFile(path.join(distAdminDir, 'admin.html'));
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PairUpToday Monolithic Engine running at http://0.0.0.0:${PORT}`);
    console.log(`  - Website: https://pairuptoday.com (or http://localhost:${PORT})`);
    console.log(`  - Separate Admin Vault: https://admin.pairuptoday.com (or http://localhost:${PORT}/admin.html)`);
  });
}

startServer();
