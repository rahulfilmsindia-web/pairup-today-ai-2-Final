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
import { getPlaceAutocomplete, geocodeAddress, reverseGeocode, getDistanceMatrix, isGoogleMapsConfigured } from './server/services/googlemaps.ts';
import { hashPassword, verifyPassword } from './server/services/passwords.ts';
import { PAIRUP_SERVICES } from './src/constants/services.ts';

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
  return {
    id: user.id,
    phone: user.phone,
    legalName: user.legalName,
    email: user.email,
    role: user.role,
    activeRole: user.activeRole,
    dob: user.dob,
    age: user.age,
    kycStatus: user.kycStatus || 'NOT_SUBMITTED',
    kycRejectionReason: user.kycRejectionReason,
    profilePhoto: user.profilePhoto,
    bio: user.bio,
    city: user.city
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
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : '';
}

function hasApplicationRole(user: any, role: 'CLIENT' | 'COMPANION'): boolean {
  return user?.role === role || (user?.role === 'DUAL' && user?.activeRole === role);
}

function apiRequiresRole(req: Request): 'CLIENT' | 'COMPANION' | null {
  const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
  if (route === 'POST /api/bookings/create') return 'CLIENT';
  if (route === 'POST /api/companion/membership/subscribe') return 'COMPANION';
  if (/^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete)$/.test(route)) return 'COMPANION';
  if (
    route.startsWith('POST /api/companion/') ||
    route.startsWith('POST /api/companion/availability/') ||
    route.startsWith('GET /api/companion/status/')
  ) return 'COMPANION';
  if (route === 'POST /api/payments/razorpay/create-order') {
    return req.body?.type === 'MEMBERSHIP' || req.body?.plan || req.body?.membershipPlan || req.body?.notes?.membershipPlan
      ? 'COMPANION'
      : 'CLIENT';
  }
  if (route === 'POST /api/payments/razorpay/verify-payment') {
    return req.body?.membershipPlan ? 'COMPANION' : 'CLIENT';
  }
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
    'POST /api/auth/check-phone',
    'POST /api/auth/request-otp',
    'POST /api/auth/register-with-otp',
    'POST /api/auth/verify-otp',
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
    'POST /api/auth/check-phone',
    'POST /api/auth/request-otp',
    'POST /api/auth/register-with-otp',
    'POST /api/auth/verify-otp',
    'GET /api/auth/session',
    'POST /api/auth/login',
    'POST /api/auth/select-role',
    'POST /api/auth/logout',
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
    route === 'POST /api/kyc/submit' ||
    route === 'POST /api/companion/services-rates' ||
    route === 'POST /api/companion/membership/subscribe' ||
    route === 'POST /api/companion/bank/verify' ||
    route === 'POST /api/companion/availability/toggle' ||
    route === 'GET /api/companion/wallet' ||
    route === 'POST /api/bookings/create' ||
    route === 'POST /api/payments/razorpay/verify-payment' ||
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
    /^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete)$/.test(route) ||
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
    console.error('Distributed API rate limit could not be enforced.', error);
    return res.status(503).json({ error: 'Request protection is temporarily unavailable.' });
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
  if (user.role !== 'DUAL' && user.role !== role) {
    return res.status(403).json({ error: 'Your account is not permitted to use this role.' });
  }
  try {
    const updated = await databaseAdapter.updateUser(userId, { activeRole: role });
    return res.json({
      success: true,
      activeRole: updated.activeRole || role,
      kycStatus: updated.kycStatus || user.kycStatus
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
    dob,
    idType,
    idFrontUrl,
    idBackUrl,
    selfieUrl,
    bio,
    photos,
    city,
    userType
  } = req.body;

  const authenticatedUser = (req as AuthenticatedRequest).authUser;
  const authenticatedUserId = authenticatedUser.id;
  const requestedKycRole = authenticatedUser.role === 'DUAL'
    ? authenticatedUser.activeRole
    : authenticatedUser.role;
  if ((userId && userId !== authenticatedUserId) ||
      !['CLIENT', 'COMPANION'].includes(requestedKycRole) ||
      (userType && userType !== requestedKycRole)) {
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
    } else {
      const localSubmission = {
        ...submission,
        idFrontUrl,
        idBackUrl: idBackUrl || null,
        selfieUrl
      };
      db.kycSubmissions[kycId] = localSubmission;
      user.legalName = submission.legalName;
      user.dob = dob;
      user.age = calculatedAge;
      user.kycStatus = 'PENDING';
      user.kycSubmittedAt = submittedAt;
      user.bio = submission.bio;
      user.photos = submission.photos;
      user.profilePhoto = selfieUrl;
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

    const [companionKyc, membership, bankVerification] = await Promise.all([
      databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date());
    const bankVerified = bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true;
    const isLive = Boolean(
      companionKyc?.status === 'APPROVED' &&
      profile &&
      membershipValid &&
      bankVerified &&
      !profile.isPaused
    );
    if (profile.isLive !== isLive) {
      profile = await databaseAdapter.updateCompanionProfile(userId, { isLive });
    }
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
    const startedAt = new Date();
    const membershipId = crypto.randomUUID();
    const order = await createRazorpayOrder({
      amountPaise: planDetails.amountPaise,
      receipt: `mem_${membershipId.replace(/-/g, '').slice(0, 28)}`,
      notes: { membershipId, orderType: 'MEMBERSHIP', membershipPlan: plan, userId }
    });
    if (!order.success || !order.orderId) {
      return res.status(503).json({ error: order.error || 'Razorpay could not create the membership payment order.' });
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
    if (profile) await databaseAdapter.updateCompanionProfile(userId, { isLive });
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

  const orderResult = await createRazorpayOrder({
    amountPaise: authoritativeAmountPaise,
    receipt: receipt || `rec_${Date.now()}`,
    notes: {
      ...(notes || {}),
      orderType: type || (targetPlan ? 'MEMBERSHIP' : 'BOOKING'),
      membershipPlan: targetPlan || '',
      userId: (req as AuthenticatedRequest).authUser.id
    }
  });

  if (!orderResult.success) {
    return res.status(500).json({ error: orderResult.error || 'Failed to create payment order.' });
  }

  return res.json({
    success: true,
    orderId: orderResult.orderId,
    amountPaise: orderResult.amountPaise,
    currency: orderResult.currency,
    keyId: orderResult.keyId
  });
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
  if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
  }
  if (getDatabaseType() !== 'supabase') {
    return res.status(503).json({ success: false, error: 'Payment verification requires the configured Supabase database.' });
  }

  try {
    let expectedAmountPaise: number;
    if (bookingId) {
      const booking = await databaseAdapter.getBooking(bookingId);
      if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
      if (booking.clientId !== authUserId) return res.status(403).json({ success: false, error: 'You cannot verify payment for this booking.' });
      if (booking.paymentOrderId !== orderId) return res.status(409).json({ success: false, error: 'Payment order does not match the booking.' });
      expectedAmountPaise = booking.bookingAmountPaise;
    } else {
      const memberships = await databaseAdapter.listMemberships({ userId: authUserId });
      const membership = memberships.find((entry: any) => entry.paymentOrderId === orderId && entry.plan === membershipPlan);
      if (!membership) return res.status(404).json({ success: false, error: 'Pending membership order was not found for this account.' });
      expectedAmountPaise = membership.pricePaise;
    }

    const providerPayment = await fetchRazorpayPayment(paymentId);
    if (providerPayment.order_id !== orderId || providerPayment.amount !== expectedAmountPaise ||
        providerPayment.currency !== 'INR' || providerPayment.status !== 'captured') {
      return res.status(409).json({ success: false, error: 'Razorpay does not report a captured payment matching this order and amount.' });
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

// Get companion profile & live status
app.get('/api/companion/status/:userId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: 'You cannot access another user’s companion profile.' });
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

    const [profile, companionKyc, membership, bankVerification, balance, ledgerEntries] = await Promise.all([
      databaseAdapter.getCompanionProfile(userId),
      databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId),
      databaseAdapter.getWalletBalance(userId),
      databaseAdapter.listWalletEntries(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === 'PAID' && new Date(membership.expiryDate) > new Date());
    const bankVerified = bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true;
    const kycApproved = companionKyc?.status === 'APPROVED' || user.kycStatus === 'APPROVED' || user.kyc_status === 'APPROVED';
    const isLive = Boolean(companionKyc?.status === 'APPROVED' && profile?.isLive && membershipValid && bankVerified && !profile.isPaused);
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

    return res.json({
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
    });
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
  const hasLatitude = lat !== undefined;
  const hasLongitude = lng !== undefined;
  if (hasLatitude !== hasLongitude) return res.status(400).json({ error: 'Both lat and lng are required for nearby discovery.' });
  let searchLocation: { lat: number; lng: number } | null = null;
  if (hasLatitude && hasLongitude) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Nearby discovery coordinates are invalid.' });
    }
    if (!isGoogleMapsConfigured()) return res.status(503).json({ error: 'Nearby discovery requires configured Google Maps credentials.' });
    searchLocation = { lat: latitude, lng: longitude };
  }

  const genuineCompanions: any[] = [];
  const initialCompanions: any[] = [];
  const coordinatesByUserId = new Map<string, { lat: number; lng: number }>();

  let profileEntries: Array<[string, any, any]> = [];
  if (getDatabaseType() === 'supabase') {
    try {
      const [profiles, users] = await Promise.all([
        databaseAdapter.listCompanionProfiles({ isLive: true, limit: 100 }),
        databaseAdapter.listUsers()
      ]);
      const usersById = new Map(users.map((user: any) => [user.id, user]));
      const candidates = profiles.filter((profile: any) =>
        !profile.isInitialListing && !profile.isPaused &&
        ['COMPANION', 'DUAL'].includes(usersById.get(profile.userId)?.role) &&
        usersById.has(profile.userId)
      );
      const checkedProfiles = await Promise.all(candidates.map(async (profile: any) => {
        const [companionKyc, membership, bankVerification] = await Promise.all([
          databaseAdapter.getUserKycSubmission(profile.userId, 'COMPANION'),
          databaseAdapter.getActiveMembership(profile.userId),
          databaseAdapter.getBankVerification(profile.userId)
        ]);
        if (companionKyc?.status !== 'APPROVED' || !membership || bankVerification?.verificationStatus !== 'VERIFIED') return null;
        return [
          profile.userId,
          { ...profile, companionKyc, membership, bankDetails: { isVerified: true } },
          usersById.get(profile.userId)
        ] as [string, any, any];
      }));
      profileEntries = checkedProfiles.filter((entry): entry is [string, any, any] => entry !== null);
    } catch (error) {
      console.error('Companion discovery query failed.', error);
      return res.status(503).json({ error: 'Companion discovery is temporarily unavailable.' });
    }
  } else {
    profileEntries = Object.entries(db.companionProfiles).map(([userId, profile]) => [userId, profile, db.users[userId]]);
  }

  for (const [userId, profile, dbUser] of profileEntries) {
    const user = dbUser || db.users[userId];
    if (!user) continue;

    const isInitial = Boolean(profile.isInitialListing);

    // Gate verification:
    // If genuine: must satisfy all 3 gates (KYC approved, membership paid & valid, bank verified)
    // If initial listing: approved and display-eligible
    const isLive = isInitial || Boolean(
      profile.companionKyc?.status === 'APPROVED' &&
      profile.membership &&
      profile.membership.isActive &&
      new Date(profile.membership.expiryDate) > new Date() &&
      profile.bankDetails &&
      profile.bankDetails.isVerified
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
      const matchName = user.legalName?.toLowerCase().includes(q);
      const matchBio = user.bio?.toLowerCase().includes(q);
      const matchCity = user.city?.toLowerCase().includes(q) || profile.address?.toLowerCase().includes(q) || user.state?.toLowerCase().includes(q);
      if (!matchName && !matchBio && !matchCity) continue;
    }

    // Filter by city
    if (city && city !== 'all') {
      const c = (city as string).toLowerCase();
      const userCity = (user.city || '').toLowerCase();
      const userAddr = (profile.address || '').toLowerCase();
      const userState = (user.state || profile.state || '').toLowerCase();
      if (!userCity.includes(c) && !userAddr.includes(c) && !userState.includes(c)) {
        continue;
      }
    }

    const hourlyRate = Math.round((profile.rates?.hourlyPaise || 49900) / 100);
    const profileLatitude = profile.latitude === null || profile.latitude === undefined ? Number.NaN : Number(profile.latitude);
    const profileLongitude = profile.longitude === null || profile.longitude === undefined ? Number.NaN : Number(profile.longitude);
    if (Number.isFinite(profileLatitude) && Number.isFinite(profileLongitude) &&
        profileLatitude >= -90 && profileLatitude <= 90 && profileLongitude >= -180 && profileLongitude <= 180) {
      coordinatesByUserId.set(userId, { lat: profileLatitude, lng: profileLongitude });
    }
    const companionRecord = {
      id: user.id,
      name: user.legalName,
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

  // Prioritize genuine companions first; dynamic replacement for matching cities/services
  // Genuine live registered companions take topmost priority
  genuineCompanions.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.totalBookings || 0) - (a.totalBookings || 0));

  // Newly created profiles appear BEFORE existing profiles, preserving relative order of existing profiles
  let combined = [...newProfiles, ...genuineCompanions, ...existingInitial];
  if (searchLocation) {
    const located = combined
      .map(companion => ({ companion, coordinates: coordinatesByUserId.get(companion.id) }))
      .filter((entry): entry is { companion: any; coordinates: { lat: number; lng: number } } => Boolean(entry.coordinates));
    if (located.length === 0) return res.json({ count: 0, companions: [] });
    try {
      const distances = await getDistanceMatrix(
        [searchLocation],
        located.map(entry => entry.coordinates)
      );
      combined = located.map((entry, index) => {
        const result = distances[0]?.[index];
        if (!result || result.status !== 'OK') return null;
        return {
          ...entry.companion,
          distanceKm: Math.round(result.distance.value / 100) / 10,
          travelDurationMinutes: Math.ceil(result.duration.value / 60)
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => a.travelDurationMinutes - b.travelDurationMinutes);
    } catch (error) {
      console.error('Nearby Companion distance lookup failed.', error);
      return res.status(503).json({ error: 'Nearby discovery is temporarily unavailable.' });
    }
  }

  return res.json({ count: combined.length, companions: combined });
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

    const bookingCode = `PUT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const booking = await databaseAdapter.reserveBookingPayment({
      id: crypto.randomUUID(),
      bookingCode,
      clientId: authUser.id,
      companionId,
      serviceId,
      serviceName: service.name,
      date,
      startTime,
      endTime,
      durationHours,
      meetingLocation,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : ''
    });
    const order = await createRazorpayOrder({
      amountPaise: booking.bookingAmountPaise,
      receipt: `bk_${bookingCode}`,
      notes: { bookingId: booking.id, bookingCode, orderType: 'BOOKING', userId: authUser.id }
    });
    if (!order.success || !order.orderId) {
      await databaseAdapter.updateBooking(booking.id, { status: 'CANCELLED', paymentStatus: 'FAILED' });
      return res.status(503).json({ error: order.error || 'Razorpay could not create the booking payment order.' });
    }
    await databaseAdapter.updateBooking(booking.id, { paymentOrderId: order.orderId });
    return res.status(201).json({
      success: true,
      booking: { ...booking, paymentOrderId: order.orderId, status: 'PENDING', paymentStatus: 'PENDING' },
      payment: { orderId: order.orderId, amountPaise: order.amountPaise, currency: order.currency, keyId: order.keyId }
    });
  } catch (error) {
    console.error('Booking reservation or order creation failed.', error);
    return res.status(503).json({ error: 'Booking checkout is temporarily unavailable.' });
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

app.get('/api/chat/:bookingId', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const userId = (req as AuthenticatedRequest).authUser.id;
  try {
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: 'Access denied to this booking chat.' });
    }
    if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)) {
      return res.status(403).json({ error: 'Chat is available only for confirmed bookings.' });
    }
    if (getDatabaseType() === 'supabase') {
      let conversation = (await databaseAdapter.listConversations(userId))
        .find((item: any) => item.bookingId === bookingId);
      if (!conversation && booking.status !== 'COMPLETED') {
        conversation = await databaseAdapter.createConversation({
          bookingId,
          participantA: booking.clientId,
          participantB: booking.companionId
        });
      }
      const messages = conversation
        ? await databaseAdapter.listMessages(conversation.id)
        : [];
      return res.json({ messages: messages.map((item: any) => ({
        ...item,
        bookingId,
        senderName: item.senderId === booking.clientId ? booking.clientName : booking.companionName,
        senderRole: item.senderId === booking.clientId ? 'CLIENT' : 'COMPANION',
        timestamp: item.created_at || item.createdAt
      })) });
    }
    return res.json({ messages: db.chatMessages[bookingId] || [] });
  } catch (error) {
    console.error('Booking chat could not be loaded.', error);
    return res.status(503).json({ error: 'Chat is temporarily unavailable.' });
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
    const booking = getDatabaseType() === 'supabase'
      ? await databaseAdapter.getBooking(bookingId)
      : db.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== senderId && booking.companionId !== senderId) {
      return res.status(403).json({ error: 'Access denied to this booking chat.' });
    }
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
      return res.status(403).json({ error: 'Chat is available only while a booking is active.' });
    }
    const isClient = booking.clientId === senderId;
    const chatMsg = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      bookingId,
      senderId,
      senderName: isClient ? booking.clientName : booking.companionName,
      senderRole: isClient ? 'CLIENT' : 'COMPANION',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    if (getDatabaseType() === 'supabase') {
      let conversation = (await databaseAdapter.listConversations(senderId))
        .find((item: any) => item.bookingId === bookingId);
      if (!conversation) {
        conversation = await databaseAdapter.createConversation({
          bookingId,
          participantA: booking.clientId,
          participantB: booking.companionId
        });
      }
      const stored = await databaseAdapter.createMessage({
        conversationId: conversation.id,
        senderId,
        message: chatMsg.message
      });
      return res.json({ success: true, message: { ...chatMsg, id: stored.id, timestamp: stored.created_at || stored.createdAt } });
    }
    (db.chatMessages[bookingId] ||= []).push(chatMsg);
    saveDB(db);
    return res.json({ success: true, message: chatMsg });
  } catch (error) {
    console.error('Booking chat message could not be saved.', error);
    return res.status(503).json({ error: 'Chat is temporarily unavailable.' });
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
    const user = await databaseAdapter.getUser(submission.userId);
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
          totalBookings: userBookings.length
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
        .filter((u: any) => u.role === 'COMPANION' || u.activeRole === 'COMPANION')
        .map(async (u: any) => {
          const profile = profileMap.get(u.id);
          let wallet: any = null;
          try {
            wallet = await databaseAdapter.getWalletBalance(u.id);
          } catch {
            wallet = null;
          }
          return {
            id: u.id,
            phone: u.phone,
            legalName: u.legalName,
            email: u.email,
            kycStatus: u.kycStatus,
            city: u.city,
            isLive: profile?.isLive || false,
            isPaused: profile?.isPaused || false,
            membershipActive: Boolean(profile?.membership?.isActive),
            membershipTier: profile?.membership?.plan || 'NONE',
            bankVerified: Boolean(profile?.bankDetails?.isVerified),
            totalBookings: profile?.totalBookings || 0,
            lockedBalancePaise: wallet?.lockedSettlementBalancePaise || 0,
            totalSettledPaise: wallet?.totalSettledPaise || 0,
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

// Admin Membership Records
app.get('/api/admin/memberships', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'), async (req: Request, res: Response) => {
  try {
    const rawMemberships = await databaseAdapter.listMemberships();
    const users = await databaseAdapter.listUsers();
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const memberships = rawMemberships.map((m: any) => {
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
      if (b.paymentId) {
        payments.push({
          id: b.paymentId,
          type: 'BOOKING_ESCROW',
          bookingCode: b.bookingCode,
          payerName: b.clientName,
          recipientName: b.companionName,
          grossAmountPaise: b.bookingAmountPaise,
          adminFeePaise: b.adminPlatformFeePaise,
          companionSharePaise: b.companionNetSharePaise,
          status: b.paymentStatus || 'PAID',
          createdAt: b.createdAt
        });
      }
    }

    for (const m of memberships) {
      if (m.paymentOrderId || m.paymentId) {
        const user = userMap.get(m.userId);
        payments.push({
          id: m.paymentId || m.paymentOrderId,
          type: 'COMPANION_MEMBERSHIP',
          bookingCode: `MEM-${m.plan}`,
          payerName: user?.legalName || 'Companion Host',
          recipientName: 'PairUpToday Platform',
          grossAmountPaise: m.pricePaise,
          adminFeePaise: m.pricePaise,
          companionSharePaise: 0,
          status: 'PAID',
          createdAt: m.createdAt || m.startDate
        });
      }
    }

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
  if (getDatabaseType() === 'json') {
    const profile = db.companionProfiles[userId];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!req.body.isPaused) {
      const user = db.users[userId];
      const isEligible = user?.kycStatus === 'APPROVED' &&
        profile.membership?.isActive &&
        new Date(profile.membership.expiryDate) > new Date() &&
        profile.bankDetails?.isVerified;
      if (!isEligible) return res.status(403).json({ error: 'Approved KYC, an active paid membership, and verified bank details are required to resume.' });
    }
    profile.isPaused = req.body.isPaused;
    saveDB(db);
    return res.json({ success: true, isPaused: profile.isPaused });
  }
  try {
    const profile = await databaseAdapter.getCompanionProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!req.body.isPaused) {
      const [companionKyc, membership, bankVerification] = await Promise.all([
        databaseAdapter.getUserKycSubmission(userId, 'COMPANION'),
        databaseAdapter.getActiveMembership(userId),
        databaseAdapter.getBankVerification(userId)
      ]);
      const isEligible = companionKyc?.status === 'APPROVED' &&
        membership?.paymentStatus === 'PAID' &&
        new Date(membership.expiryDate) > new Date() &&
        (bankVerification?.verificationStatus === 'VERIFIED' || bankVerification?.isVerified === true);
      if (!isEligible) return res.status(403).json({ error: 'Approved KYC, an active paid membership, and verified bank details are required to resume.' });
    }
    const updated = await databaseAdapter.updateCompanionProfile(userId, { isPaused: req.body.isPaused });
    return res.json({ success: true, isPaused: updated.isPaused });
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

// Update user's current location
app.post('/api/location/update', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { latitude, longitude, bookingId } = req.body || {};
  if (typeof bookingId !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'A booking ID and valid coordinates are required.' });
  }
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Booking location service is not configured.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status) ||
        (booking.clientId !== userId && booking.companionId !== userId)) {
      return res.status(403).json({ error: 'Location updates require an active booking participant.' });
    }
    if (!await databaseAdapter.getBookingLocationSharing(bookingId, userId)) {
      return res.status(403).json({ error: 'Enable booking-specific location sharing before sending location updates.' });
    }
    await updateUserLocation(userId, latitude, longitude, bookingId);
    return res.json({ success: true, provider: 'firebase' });
  } catch (error) {
    console.error('Booking location update failed.', error);
    return res.status(503).json({ error: 'Booking location is temporarily unavailable.' });
  }
});

// Get user's current location
app.get('/api/location/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUserId = (req as AuthenticatedRequest).authUser.id;
  const bookingId = req.query.bookingId;
  if (typeof bookingId !== 'string') return res.status(400).json({ error: 'bookingId is required.' });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: 'Booking location service is not configured.' });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    const participants = [booking.clientId, booking.companionId];
    if (!['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(booking.status) ||
        !participants.includes(requestingUserId) || !participants.includes(userId)) {
      return res.status(403).json({ error: 'Location access requires an active booking participant.' });
    }
    if (!await databaseAdapter.getBookingLocationSharing(bookingId, userId)) {
      return res.status(403).json({ error: 'This participant has not enabled location sharing for the booking.' });
    }
    const location = await getUserLocation(userId, bookingId);
    if (!location) return res.status(404).json({ error: 'Location not found.' });
    return res.json({
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp
      },
      provider: 'firebase'
    });
  } catch (error) {
    console.error('Booking location could not be loaded.', error);
    return res.status(503).json({ error: 'Booking location is temporarily unavailable.' });
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

  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({
      error: 'Google Maps API not configured',
      message: 'GOOGLE_MAPS_API_KEY environment variable is required'
    });
  }

  const location = lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : undefined;
  const radiusKm = radius ? parseInt(radius as string) : undefined;

  try {
    const predictions = await getPlaceAutocomplete(input, location, radiusKm);
    return res.json({ predictions });
  } catch (error) {
    console.error('Maps autocomplete request failed.', error);
    return res.status(502).json({ error: 'Place autocomplete is temporarily unavailable.' });
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
    // Serve separately built Admin assets if present. The admin SPA references
    // absolute /assets/... URLs, so chain dist-admin/assets BEFORE dist/assets;
    // express.static falls through to the next mount on a miss.
    if (fs.existsSync(distAdminDir)) {
      app.use('/assets', express.static(path.join(distAdminDir, 'assets'), { fallthrough: true }));
    }
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      const host = req.headers.host || '';
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
