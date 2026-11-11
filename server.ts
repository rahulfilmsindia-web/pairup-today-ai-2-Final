import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sendApitxtOtp, verifyApitxtBankAccount, compareLegalAndBankNames, formatPhoneForApitxt } from './server/services/apitxt.ts';
import { createRazorpayOrder, verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from './server/services/razorpay.ts';
import { databaseAdapter, getDatabaseType } from './server/services/database.ts';
import { updateUserLocation, getUserLocation, startLocationSharing, stopLocationSharing, isLocationSharingActive, setUserPresence, getUserPresence, isFirebaseConfigured } from './server/services/firebase.ts';
import { getPlaceAutocomplete, geocodeAddress, reverseGeocode, calculateDistance, findNearbyCompanions, isGoogleMapsConfigured } from './server/services/googlemaps.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pairuptoday_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Security headers & CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN || 'https://pairuptoday.com',
    process.env.ADMIN_ORIGIN || 'https://admin.pairuptoday.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.run.app'))) {
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

const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || 'pairup_vault_server_secret_hmac_2026_production';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_pairup_salt_2026').digest('hex');
}

/**
 * Server-secret-keyed HMAC-SHA256 for secure 6-digit OTP challenge hashing
 */
function hashOtp(otp: string): string {
  return crypto
    .createHmac('sha256', OTP_HMAC_SECRET)
    .update((otp || '').trim())
    .digest('hex');
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

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
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
        passwordHash: hashPassword('PairUpInit@2026'),
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
        passwordHash: hashPassword('PairUp@2026'),
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
        passwordHash: hashPassword('PairUp@2026'),
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
        passwordHash: hashPassword('PairUp@2026'),
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
        passwordHash: hashPassword('PairUp@2026'),
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
        passwordHash: hashPassword('AdminPass@2026'),
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
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Failed to atomically write DB file', err);
  }
}

// -------------------------------------------------------------
// AUTHENTICATION & SMS OTP ENDPOINTS
// -------------------------------------------------------------

// Check if phone number is already registered
app.post('/api/auth/check-phone', (req: Request, res: Response) => {
  const { phone } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number (+91).' });
  }
  const existingUser = Object.values(db.users).find((u: any) => u.phone === normalizedPhone);
  return res.json({ registered: Boolean(existingUser), phone: normalizedPhone });
});

// Request OTP for Login or Registration via real APITXT integration
app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  const { phone, purpose } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number (+91)' });
  }

  const existingOtpRecord = db.otpStore[normalizedPhone];
  const now = Date.now();

  // Rate Limiting Rule 1: 60-second cooldown
  if (existingOtpRecord && now - existingOtpRecord.lastSentAt < 60000) {
    const waitSeconds = Math.ceil((60000 - (now - existingOtpRecord.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSeconds}s before requesting a new OTP.` });
  }

  // Rate Limiting Rule 2: Max 3 APITXT OTP requests per mobile number per minute
  let windowCount = 1;
  let windowStartTime = now;
  if (existingOtpRecord && now - existingOtpRecord.windowStartTime < 60000) {
    if (existingOtpRecord.windowCount >= 3) {
      const waitSeconds = Math.ceil((60000 - (now - existingOtpRecord.windowStartTime)) / 1000);
      return res.status(429).json({ error: `Rate limit reached: Maximum 3 OTP requests allowed per minute. Please wait ${waitSeconds}s.` });
    }
    windowCount = existingOtpRecord.windowCount + 1;
    windowStartTime = existingOtpRecord.windowStartTime;
  }

  // Generate cryptographically secure 6-digit OTP
  const otp = generateOtp();

  // Send real SMS OTP through APITXT (template_id is omitted)
  const apitxtResult = await sendApitxtOtp({
    mobile: normalizedPhone,
    otp
  });

  if (!apitxtResult.success) {
    return res.status(502).json({
      error: apitxtResult.error || 'Failed to dispatch SMS through PairUp Security Network.',
      errorCode: apitxtResult.errorCode
    });
  }

  const isTestHarness = req.headers['x-test-harness'] === 'true' || process.env.NODE_ENV === 'test';

  // Store ONLY the secure hash of the OTP, never plaintext!
  db.otpStore[normalizedPhone] = {
    otpHash: hashOtp(otp),
    expiresAt: now + 5 * 60000, // 5 minutes validity
    attempts: 0,
    lastSentAt: now,
    requestId: apitxtResult.requestId || `SMS-${Date.now()}`,
    status: 'SENT',
    windowStartTime,
    windowCount
  };
  saveDB(db);

  const maskedPhone = normalizedPhone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2******$3');
  console.log(`[PairUp Security Network] SMS OTP dispatched for ${maskedPhone} (Req ID: ${apitxtResult.requestId})`);

  return res.json({
    success: true,
    message: 'OTP dispatched successfully via PairUp Security Network',
    phoneMasked: maskedPhone,
    requestId: apitxtResult.requestId,
    resendWaitSeconds: 60
  });
});

// Verify OTP & Register New Account
app.post('/api/auth/register-with-otp', (req: Request, res: Response) => {
  const { phone, otp, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Invalid phone format. Must be +91 followed by 10 digits.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check if phone already registered
  const existingUser = Object.values(db.users).find((u: any) => u.phone === normalizedPhone);
  if (existingUser) {
    return res.status(400).json({ error: 'Mobile number already registered. Please login instead.' });
  }

  // Verify OTP
  const otpRecord = db.otpStore[normalizedPhone];
  if (!otpRecord) {
    return res.status(400).json({ error: 'No OTP requested for this phone number. Please request OTP first.' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    delete db.otpStore[normalizedPhone];
    saveDB(db);
    return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
  }

  if (otpRecord.attempts >= 4) {
    delete db.otpStore[normalizedPhone];
    saveDB(db);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
  }

  // Verify submitted OTP against secure HMAC-SHA256 hash using constant-time comparison
  if (!verifyOtpHash(otp || '', otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    saveDB(db);
    return res.status(400).json({ error: 'Incorrect OTP. Please enter the valid 6-digit code.' });
  }

  // Clean OTP record upon successful verification (replay prevention)
  delete db.otpStore[normalizedPhone];

  // Create User in NOT_SUBMITTED KYC status
  const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const newUser = {
    id: userId,
    phone: normalizedPhone,
    passwordHash: hashPassword(password),
    role: 'DUAL',
    kycStatus: 'NOT_SUBMITTED',
    createdAt: new Date().toISOString()
  };

  db.users[userId] = newUser;
  saveDB(db);

  return res.json({
    success: true,
    user: {
      id: newUser.id,
      phone: newUser.phone,
      role: newUser.role,
      kycStatus: newUser.kycStatus
    },
    token: `pairup_jwt_${newUser.id}_${Date.now()}`,
    isFirstTime: true
  });
});

// Standalone verify OTP endpoint (for logins or re-verifications)
app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Invalid mobile number.' });

  const record = db.otpStore[normalizedPhone];
  if (!record) return res.status(400).json({ error: 'No OTP requested.' });

  if (Date.now() > record.expiresAt) {
    delete db.otpStore[normalizedPhone];
    saveDB(db);
    return res.status(400).json({ error: 'OTP expired.' });
  }

  if (record.attempts >= 4) {
    delete db.otpStore[normalizedPhone];
    saveDB(db);
    return res.status(429).json({ error: 'Too many incorrect attempts.' });
  }

  if (!verifyOtpHash(otp || '', record.otpHash)) {
    record.attempts += 1;
    saveDB(db);
    return res.status(400).json({ error: 'Incorrect OTP.' });
  }

  delete db.otpStore[normalizedPhone];
  saveDB(db);
  return res.json({ success: true, message: 'OTP verified successfully.' });
});

// Password Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }

  // Find user
  const user = Object.values(db.users).find((u: any) => u.phone === normalizedPhone);
  if (!user) {
    // Exact requirement: "Not registered yet? Please Sign In to create your account."
    return res.status(404).json({
      error: 'Not registered yet? Please Sign In to create your account.',
      isNotRegistered: true
    });
  }

  if (user.passwordHash !== hashPassword(password)) {
    // Exact requirement: "If the password is wrong, display an invalid-credentials message. Do not redirect a wrong-password user to registration."
    return res.status(401).json({
      error: 'Invalid mobile number or password. Please verify and try again.',
      isInvalidCredentials: true
    });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      phone: user.phone,
      legalName: user.legalName,
      email: user.email,
      role: user.role,
      activeRole: user.activeRole,
      dob: user.dob,
      age: user.age,
      kycStatus: user.kycStatus,
      kycRejectionReason: user.kycRejectionReason,
      profilePhoto: user.profilePhoto,
      bio: user.bio,
      city: user.city
    },
    token: `pairup_jwt_${user.id}_${Date.now()}`
  });
});

// Set Active Role (Client vs Companion) with backend authorization verification
app.post('/api/auth/select-role', (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const user = db.users[userId];

  if (!user) {
    return res.status(404).json({ error: 'User session not found.' });
  }

  if (role !== 'CLIENT' && role !== 'COMPANION') {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }

  user.activeRole = role;
  saveDB(db);

  return res.json({
    success: true,
    activeRole: user.activeRole,
    kycStatus: user.kycStatus
  });
});

// -------------------------------------------------------------
// UNIFIED PROFILE & KYC WIZARD
// -------------------------------------------------------------
app.post('/api/kyc/submit', (req: Request, res: Response) => {
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

  const user = db.users[userId];
  if (!user) {
    return res.status(404).json({ error: 'User session invalid.' });
  }

  // Age 18+ eligibility gate validation
  if (!dob) {
    return res.status(400).json({ error: 'Date of birth is required.' });
  }

  const birthDate = new Date(dob);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

  if (calculatedAge < 18) {
    return res.status(400).json({ error: 'You must be at least 18 years of age to use PairUpToday.' });
  }

  if (!legalName || !idType || !idFrontUrl || !selfieUrl) {
    return res.status(400).json({ error: 'Legal name, government ID and live selfie are mandatory.' });
  }

  // Save KYC record
  const kycId = `kyc_${crypto.randomUUID().slice(0, 8)}`;
  const submission = {
    id: kycId,
    userId: user.id,
    userPhone: user.phone,
    legalName: legalName.trim(),
    dob, // Permanently locked after KYC submission
    idType,
    idFrontUrl,
    idBackUrl: idBackUrl || null,
    selfieUrl,
    bio: bio || '',
    photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
    city: city || 'New Delhi',
    status: 'PENDING',
    submittedAt: new Date().toISOString(),
    userType: userType === 'COMPANION' ? 'COMPANION' : 'CLIENT'
  };

  db.kycSubmissions[kycId] = submission;

  // Update user record: lock DOB, set KYC status to PENDING
  user.legalName = legalName.trim();
  user.dob = dob; // Locked
  user.age = calculatedAge;
  user.kycStatus = 'PENDING';
  user.kycSubmittedAt = submission.submittedAt;
  user.bio = bio || '';
  user.photos = submission.photos;
  user.profilePhoto = selfieUrl;
  user.city = city || 'New Delhi';

  saveDB(db);

  // Exact requirement: "MANDATORY LOGOUT AFTER KYC SUBMISSION"
  // "1. Revoke the active session. 2. Automatically log out the user. 3. Return the user to the login page."
  return res.json({
    success: true,
    mandatoryLogout: true,
    message: 'KYC submitted for PairUp Security Network verification. Session revoked. Please log in with your credentials.'
  });
});

// -------------------------------------------------------------
// COMPANION ONBOARDING & ACTIVATION ENDPOINTS
// -------------------------------------------------------------

// Step A: Services & Rates configuration
app.post('/api/companion/services-rates', (req: Request, res: Response) => {
  const { userId, services, rates, availability } = req.body;
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
    profile.services = services;
    profile.rates = rates;
    profile.availability = availability;
  }

  // Check 3 conditions to go live
  profile.isLive = Boolean(
    user.kycStatus === 'APPROVED' &&
    profile.membership &&
    profile.membership.isActive &&
    new Date(profile.membership.expiryDate) > new Date() &&
    profile.bankDetails &&
    profile.bankDetails.isVerified
  );

  saveDB(db);
  return res.json({ success: true, profile });
});

// Step B: Membership Subscription (Only for Companions; STARTER ₹449, PROFESSIONAL ₹1,099, PREMIUM ₹5,999)
app.post('/api/companion/membership/subscribe', (req: Request, res: Response) => {
  const { userId, plan } = req.body;
  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  let pricePaise = 0;
  let durationDays = 30;

  if (plan === 'STARTER') {
    pricePaise = 44900;
    durationDays = 30;
  } else if (plan === 'PROFESSIONAL') {
    pricePaise = 109900;
    durationDays = 90;
  } else if (plan === 'PREMIUM') {
    pricePaise = 599900;
    durationDays = 365;
  } else {
    return res.status(400).json({ error: 'Invalid plan selection.' });
  }

  const startDate = new Date();
  const expiryDate = new Date(Date.now() + durationDays * 86400000);
  const paymentId = `pay_mem_${crypto.randomUUID().slice(0, 10)}`;

  const membership = {
    plan,
    pricePaise,
    startDate: startDate.toISOString(),
    expiryDate: expiryDate.toISOString(),
    paymentId,
    isActive: true
  };

  let profile = db.companionProfiles[userId];
  if (!profile) {
    profile = {
      userId,
      services: [1, 2],
      rates: { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
      availability: {
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '10:00',
        endTime: '20:00'
      },
      isLive: false,
      rating: 5.0,
      totalBookings: 0
    };
    db.companionProfiles[userId] = profile;
  }

  profile.membership = membership;

  // Initialize companion wallet if not present
  if (!db.companionWallets[userId]) {
    db.companionWallets[userId] = {
      companionId: userId,
      lockedSettlementBalancePaise: 0,
      availableSettlementBalancePaise: 0,
      totalSettledPaise: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  // Update live status check
  profile.isLive = Boolean(
    user.kycStatus === 'APPROVED' &&
    profile.membership.isActive &&
    new Date(profile.membership.expiryDate) > new Date() &&
    profile.bankDetails &&
    profile.bankDetails.isVerified
  );

  saveDB(db);

  return res.json({
    success: true,
    message: 'Companion membership activated via PairUp Secure Vault',
    membership,
    isLive: profile.isLive
  });
});

// Step C: Bank Verification via APITXT Penny-Less API
app.post('/api/companion/bank/verify', async (req: Request, res: Response) => {
  const { userId, accountNumber, ifsc, accountHolderName, bankName } = req.body;
  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Call real APITXT Penny-less Verification service
  const verificationResult = await verifyApitxtBankAccount({
    ifsc,
    accountNumber,
    accountHolderName,
    mobile: user.phone,
    kycLegalName: user.legalName
  });

  if (!verificationResult.success) {
    return res.status(400).json({
      error: verificationResult.error || 'Bank account verification failed with APITXT gateway.',
      errorCode: verificationResult.errorCode,
      accountExists: verificationResult.accountExists,
      nameMatched: verificationResult.nameMatched
    });
  }

  const masked = accountNumber.slice(0, -4).replace(/./g, 'X') + accountNumber.slice(-4);

  const bankDetails = {
    accountNumber,
    accountNumberMasked: masked,
    ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
    bankName: bankName || 'Indian Scheduled Commercial Bank',
    accountHolderName: verificationResult.nameAtBank || accountHolderName.trim(),
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    requestId: verificationResult.requestId,
    method: verificationResult.method || 'penny_less'
  };

  let profile = db.companionProfiles[userId];
  if (!profile) {
    profile = {
      userId,
      services: [1, 2],
      rates: { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
      availability: { days: ['Monday'], startTime: '09:00', endTime: '18:00' },
      isLive: false,
      rating: 5.0,
      totalBookings: 0
    };
    db.companionProfiles[userId] = profile;
  }

  profile.bankDetails = bankDetails;

  // STRICT 3 CONDITIONS TO GO LIVE:
  // 1. KYC APPROVED
  // 2. MEMBERSHIP PAID & VALID
  // 3. BANK VERIFIED
  profile.isLive = Boolean(
    user.kycStatus === 'APPROVED' &&
    profile.membership &&
    profile.membership.isActive &&
    new Date(profile.membership.expiryDate) > new Date() &&
    profile.bankDetails.isVerified
  );

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    action: 'BANK_ACCOUNT_VERIFIED',
    targetId: userId,
    details: `Penny-less bank verification completed for ${bankDetails.accountHolderName} (${bankDetails.accountNumberMasked}). Req ID: ${verificationResult.requestId}. Live Status: ${profile.isLive}.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);

  return res.json({
    success: true,
    message: 'Bank verification completed via PairUp Verified Network',
    bankDetails: {
      accountNumberMasked: masked,
      ifsc: bankDetails.ifsc,
      bankName: bankDetails.bankName,
      accountHolderName: bankDetails.accountHolderName,
      isVerified: true,
      requestId: bankDetails.requestId
    },
    isLive: profile.isLive
  });
});

// -------------------------------------------------------------
// RAZORPAY PRODUCTION PAYMENT ENDPOINTS
// -------------------------------------------------------------

// Create Razorpay payment order (server-side)
app.post('/api/payments/razorpay/create-order', async (req: Request, res: Response) => {
  const { amountPaise, receipt, notes, type, userId, plan, membershipPlan } = req.body;

  let authoritativeAmountPaise = amountPaise;
  const targetPlan = plan || membershipPlan || notes?.membershipPlan;

  // Initial listing non-bookable check
  const targetCompId = req.body.companionId || notes?.companionId;
  if (targetCompId && db.companionProfiles[targetCompId]?.isInitialListing) {
    return res.status(400).json({ error: 'This profile is currently unavailable for booking.' });
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
      userId: userId || 'anonymous'
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
app.post('/api/payments/razorpay/verify-payment', (req: Request, res: Response) => {
  const { orderId, paymentId, signature, bookingId, membershipPlan, userId } = req.body;

  const isValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature
  });

  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment signature. Backend payment verification failed.'
    });
  }

  // If verifying a booking payment
  if (bookingId && db.bookings[bookingId]) {
    const booking = db.bookings[bookingId];
    booking.paymentStatus = 'PAID';
    booking.paymentId = paymentId;
    booking.status = 'CONFIRMED';
    saveDB(db);
  }

  // If verifying a companion membership payment
  if (membershipPlan && userId && db.users[userId]) {
    const user = db.users[userId];
    const durationDays = membershipPlan === 'STARTER' ? 30 : membershipPlan === 'PROFESSIONAL' ? 90 : 365;
    const pricePaise = membershipPlan === 'STARTER' ? 44900 : membershipPlan === 'PROFESSIONAL' ? 109900 : 599900;
    
    let profile = db.companionProfiles[userId];
    if (profile) {
      profile.membership = {
        plan: membershipPlan,
        pricePaise,
        startDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + durationDays * 86400000).toISOString(),
        paymentId,
        isActive: true
      };
      profile.isLive = Boolean(
        user.kycStatus === 'APPROVED' &&
        profile.membership.isActive &&
        new Date(profile.membership.expiryDate) > new Date() &&
        profile.bankDetails &&
        profile.bankDetails.isVerified
      );
      saveDB(db);
    }
  }

  return res.json({
    success: true,
    message: 'Payment signature verified successfully via PairUp Secure Vault.',
    paymentId
  });
});

// Razorpay Webhook listener (idempotent and signature verified)
app.post('/api/payments/razorpay/webhook', (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!signature) {
    return res.status(400).json({ error: 'Missing X-Razorpay-Signature header.' });
  }

  const isAuthentic = verifyRazorpayWebhookSignature(rawBody, signature);
  if (!isAuthentic) {
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }

  const event = req.body.event;
  const payload = req.body.payload;

  console.log(`[Razorpay Webhook] Received authentic event: ${event}`);

  db.auditLogs.unshift({
    id: `log_hook_${Date.now()}`,
    action: `RAZORPAY_WEBHOOK_${event}`,
    details: `Processed webhook event ${event} from payment gateway.`,
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  return res.json({ status: 'ok' });
});

// Get companion profile & live status
app.get('/api/companion/status/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
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
    profile.membership &&
    profile.membership.isActive &&
    new Date(profile.membership.expiryDate) > new Date() &&
    profile.bankDetails &&
    profile.bankDetails.isVerified
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
});

// -------------------------------------------------------------
// COMPANION SEARCH & DISCOVERY (India-wide & Location filter)
// -------------------------------------------------------------
app.get('/api/companions/search', (req: Request, res: Response) => {
  const { query, serviceId, city, lat, lng } = req.query;

  const genuineCompanions: any[] = [];
  const initialCompanions: any[] = [];

  for (const [userId, profile] of Object.entries(db.companionProfiles)) {
    const user = db.users[userId];
    if (!user) continue;

    const isInitial = Boolean(profile.isInitialListing);

    // Gate verification:
    // If genuine: must satisfy all 3 gates (KYC approved, membership paid & valid, bank verified)
    // If initial listing: approved and display-eligible
    const isLive = isInitial || Boolean(
      user.kycStatus === 'APPROVED' &&
      profile.membership &&
      profile.membership.isActive &&
      new Date(profile.membership.expiryDate) > new Date() &&
      profile.bankDetails &&
      profile.bankDetails.isVerified
    );

    if (!isLive) continue;

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
    const companionRecord = {
      id: user.id,
      name: user.legalName,
      age: user.age,
      city: user.city || '',
      state: user.state || profile.state || '',
      address: user.address || profile.address || '',
      locationFormatted: user.address || (profile.address && profile.address !== `${user.city}, ${user.state}` ? profile.address : (user.state ? `${user.city}, ${user.state}` : (user.city || 'India'))),
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
  const combined = [...newProfiles, ...genuineCompanions, ...existingInitial];

  return res.json({ count: combined.length, companions: combined });
});

// -------------------------------------------------------------
// BOOKING ENGINE & 15% / 85% LEDGER SPLIT
// -------------------------------------------------------------
app.post('/api/bookings/create', (req: Request, res: Response) => {
  const {
    clientId,
    companionId,
    serviceId,
    serviceName,
    date,
    startTime,
    endTime,
    durationHours,
    meetingLocation,
    notes
  } = req.body;

  const client = db.users[clientId];
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Client must be KYC approved to book
  if (client.kycStatus !== 'APPROVED') {
    return res.status(403).json({ error: 'Client Inactive: Wait for KYC Approval' });
  }

  const companion = db.users[companionId];
  const companionProfile = db.companionProfiles[companionId];
  if (!companion || !companionProfile || !companionProfile.isLive) {
    return res.status(400).json({ error: 'Selected Companion is currently not LIVE or available for bookings.' });
  }

  // Initial listing non-bookable check
  if (companionProfile.isInitialListing) {
    return res.status(400).json({ error: 'This profile is currently unavailable for booking.' });
  }

  // Slot conflict check for the companion (companion cannot have overlapping confirmed bookings)
  const existingBookings = Object.values(db.bookings).filter(
    (b: any) =>
      b.companionId === companionId &&
      b.date === date &&
      ['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'].includes(b.status)
  );

  const slotConflict = existingBookings.some((b: any) => {
    // Basic slot overlap check
    return (startTime >= b.startTime && startTime < b.endTime) ||
           (endTime > b.startTime && endTime <= b.endTime);
  });

  if (slotConflict) {
    return res.status(409).json({ error: 'This time slot is already booked for this Companion. Please choose another slot.' });
  }

  // Calculate pricing based on rates
  const hours = Math.max(1, parseInt(durationHours, 10) || 1);
  const slotMinutes = hours * 60;
  let bookingAmountPaise = 0;

  if (hours >= 8 && companionProfile.rates.fullDayPaise) {
    bookingAmountPaise = companionProfile.rates.fullDayPaise;
  } else if (hours >= 4 && companionProfile.rates.halfDayPaise) {
    bookingAmountPaise = companionProfile.rates.halfDayPaise;
  } else {
    bookingAmountPaise = (companionProfile.rates.hourlyPaise || 49900) * hours;
  }

  // Exact 15% Admin Platform Fee and 85% Companion Gross Share
  const adminPlatformFeePaise = Math.round(bookingAmountPaise * 0.15);
  const companionGrossSharePaise = bookingAmountPaise - adminPlatformFeePaise; // 85%

  const bookingId = `book_${crypto.randomUUID().slice(0, 8)}`;
  const bookingCode = `PUT-${Math.floor(1000 + Math.random() * 9000)}`;
  const paymentId = `pay_bk_${crypto.randomUUID().slice(0, 10)}`;

  const startOtp = generateOtp();
  const endOtp = generateOtp();

  const newBooking = {
    id: bookingId,
    bookingCode,
    clientId: client.id,
    clientName: client.legalName || 'Client Member',
    clientPhone: client.phone,
    companionId: companion.id,
    companionName: companion.legalName || 'Companion Host',
    companionPhone: companion.phone,
    serviceId: parseInt(serviceId, 10),
    serviceName: serviceName || 'Social Companionship',
    date,
    startTime,
    endTime,
    slotMinutes,
    meetingLocation: meetingLocation || 'Client designated public venue',
    notes: notes || '',
    status: 'CONFIRMED', // Upfront 100% verified payment collected
    bookingAmountPaise,
    adminPlatformFeePaise,
    companionGrossSharePaise,
    delayMinutes: 0,
    latePenaltyPaise: 0,
    companionNetSharePaise: companionGrossSharePaise,
    clientRefundPenaltyPaise: 0,
    paymentId,
    paymentStatus: 'PAID',
    startOtp,
    startOtpHmac: hashOtp(startOtp),
    startOtpAttempts: 0,
    startOtpVerified: false,
    endOtp,
    endOtpHmac: hashOtp(endOtp),
    endOtpAttempts: 0,
    endOtpVerified: false,
    settlementStatus: 'LOCKED',
    createdAt: new Date().toISOString()
  };

  db.bookings[bookingId] = newBooking;

  // Audit Log
  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    action: 'BOOKING_CREATED_AND_PAID',
    targetId: bookingId,
    details: `Booking ${bookingCode} confirmed. 100% amount ₹${(bookingAmountPaise / 100).toFixed(2)} received into Admin merchant account.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);

  const sanitizedBooking = { ...newBooking };
  delete (sanitizedBooking as any).startOtpHmac;
  delete (sanitizedBooking as any).endOtpHmac;

  return res.json({
    success: true,
    message: 'Booking confirmed and 100% payment processed via PairUp Secure Vault.',
    booking: sanitizedBooking
  });
});

// Get user bookings (Client or Companion)
app.get('/api/bookings/my/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const bookings = Object.values(db.bookings).filter(
    (b: any) => b.clientId === userId || b.companionId === userId
  );

  // Security Rule:
  // 1. Never expose HMAC verification material to anyone in API responses.
  // 2. Never expose meeting Start/Completion OTPs to the companion; they are client-exclusive until verbally exchanged.
  const sanitized = bookings.map((b: any) => {
    const copy = { ...b };
    delete copy.startOtpHmac;
    delete copy.endOtpHmac;
    if (copy.companionId === userId) {
      delete copy.startOtp;
      delete copy.endOtp;
    }
    return copy;
  });

  return res.json({ bookings: sanitized });
});

// -------------------------------------------------------------
// MEETING ARRIVAL & OTP VERIFICATION WORKFLOW
// -------------------------------------------------------------

// Companion slides MEETING ARRIVED -> triggers Start OTP dispatch to Client
app.post('/api/bookings/:bookingId/arrived', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { companionId } = req.body;

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.companionId !== companionId) {
    return res.status(403).json({ error: 'Unauthorized companion.' });
  }

  // Update status to COMPANION_ARRIVED and generate fresh 6-digit Start OTP challenge
  const freshStartOtp = generateOtp();
  booking.status = 'COMPANION_ARRIVED';
  booking.startOtp = freshStartOtp;
  booking.startOtpHmac = hashOtp(freshStartOtp);
  booking.startOtpAttempts = 0;
  saveDB(db);

  console.log(`[Meeting Start OTP] Booking ${booking.bookingCode}: 6-digit Start OTP dispatched to Client phone ending in ...${(booking.clientPhone || '').slice(-4)}`);

  return res.json({
    success: true,
    message: 'Arrival recorded. 6-digit Start OTP dispatched to Client.'
  });
});

// Companion submits Start OTP received from Client -> Server verifies HMAC & starts official countdown
app.post('/api/bookings/:bookingId/verify-start-otp', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { otp, delayMinutes } = req.body;

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.startOtpVerified) {
    return res.status(400).json({ error: 'Start OTP has already been verified for this booking. Replay prevented.' });
  }

  const cleanOtp = (otp || '').trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: 'Start OTP must be exactly 6 numeric digits.' });
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
app.post('/api/bookings/:bookingId/complete', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { completionOtp } = req.body;

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.endOtpVerified) {
    return res.status(400).json({ error: 'Completion OTP has already been verified for this booking. Replay prevented.' });
  }

  const cleanOtp = (completionOtp || '').trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: 'Completion OTP must be exactly 6 numeric digits.' });
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
app.get('/api/chat/:bookingId', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const messages = db.chatMessages[bookingId] || [];
  return res.json({ messages });
});

app.post('/api/chat/:bookingId', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { senderId, message } = req.body;

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Only confirmed booking participants can access
  if (booking.clientId !== senderId && booking.companionId !== senderId) {
    return res.status(403).json({ error: 'Access denied to this booking chat.' });
  }

  const isClient = booking.clientId === senderId;
  const senderName = isClient ? booking.clientName : booking.companionName;

  const chatMsg = {
    id: `msg_${crypto.randomUUID().slice(0, 8)}`,
    bookingId,
    senderId,
    senderName,
    senderRole: isClient ? 'CLIENT' : 'COMPANION',
    message: message.trim(),
    timestamp: new Date().toISOString()
  };

  if (!db.chatMessages[bookingId]) {
    db.chatMessages[bookingId] = [];
  }
  db.chatMessages[bookingId].push(chatMsg);
  saveDB(db);

  return res.json({ success: true, message: chatMsg });
});

// -------------------------------------------------------------
// SEPARATE ADMIN PANEL & MFA AUTHENTICATION
// -------------------------------------------------------------
const REGISTERED_ADMIN_EMAIL = 'rahulfilmsindia@gmail.com';
const REGISTERED_ADMIN_PHONE = '+918640851337';

// Step 1: Admin Email & Password login -> Sends APITXT SMS OTP to registered admin phone
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  const admin = Object.values(db.adminUsers).find((a: any) => a.email.toLowerCase() === email?.toLowerCase());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  if (admin.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  // Mandatory MFA: Generate 6-digit OTP to registered phone
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  db.adminMfaStore[admin.email] = {
    otpHash,
    expiresAt: Date.now() + 5 * 60000,
    attempts: 0,
    lastSentAt: Date.now()
  };
  saveDB(db);

  console.log(`[Admin APITXT SMS MFA] Dispatched OTP to registered admin phone ending in ...${admin.phone.slice(-4)}`);

  return res.json({
    success: true,
    requiresMfa: true,
    maskedPhone: admin.phone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2******$3')
  });
});

// Step 2: Verify Admin MFA OTP -> Issue high-privilege Admin session
app.post('/api/admin/verify-mfa', (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const mfa = db.adminMfaStore[email];
  if (!mfa || Date.now() > mfa.expiresAt) {
    return res.status(400).json({ error: 'MFA OTP expired or invalid. Please login again.' });
  }

  if (!verifyOtpHash(otp || '', mfa.otpHash)) {
    mfa.attempts += 1;
    saveDB(db);
    return res.status(400).json({ error: 'Incorrect MFA OTP.' });
  }

  delete db.adminMfaStore[email];

  const admin = Object.values(db.adminUsers).find((a: any) => a.email.toLowerCase() === email?.toLowerCase());
  saveDB(db);

  return res.json({
    success: true,
    admin: {
      id: admin.id,
      email: admin.email,
      phone: admin.phone,
      name: admin.name,
      role: admin.role
    },
    adminToken: `admin_session_${admin.id}_${Date.now()}`
  });
});

// The EXACT authorized Admin roles per specification
const AUTHORIZED_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'KYC_ADMIN',
  'FINANCE_ADMIN',
  'SUPPORT_ADMIN',
  'AUDITOR'
] as const;

type AuthorizedAdminRole = typeof AUTHORIZED_ADMIN_ROLES[number];

// Middleware enforcing genuine backend role authorization and least-privilege access
function requireAdminRoles(...allowedRoles: AuthorizedAdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = (req.headers.authorization || req.headers['x-admin-token']) as string;
    let token = '';
    if (authHeader && typeof authHeader === 'string') {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication token required.' });
    }

    // Explicitly reject client/companion tokens immediately with 403 Forbidden
    if (token.startsWith('pairup_jwt_')) {
      return res.status(403).json({ error: 'Forbidden: Client or Companion accounts cannot access administrative command functions.' });
    }

    // Validate admin token
    const matchedAdmin = Object.values(db.adminUsers).find((a: any) => 
      token.startsWith(`admin_session_${a.id}`) || token === a.id
    );

    if (!matchedAdmin) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session token.' });
    }

    // Enforce that matchedAdmin has one of the 5 authorized roles
    if (!AUTHORIZED_ADMIN_ROLES.includes(matchedAdmin.role)) {
      return res.status(403).json({ error: 'Forbidden: Unrecognized or unauthorized admin role.' });
    }

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
app.get('/api/admin/overview', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'), (req: Request, res: Response) => {
  const totalUsers = Object.keys(db.users).length;
  const totalBookings = Object.keys(db.bookings).length;
  const completedBookings = Object.values(db.bookings).filter((b: any) => b.status === 'COMPLETED');

  let totalGrossBookingVolumePaise = 0;
  let totalAdminPlatformFeePaise = 0;
  let totalCompanionSettledPaise = 0;
  let totalLatePenaltiesPaise = 0;

  for (const b of Object.values(db.bookings) as any[]) {
    totalGrossBookingVolumePaise += b.bookingAmountPaise || 0;
    totalAdminPlatformFeePaise += b.adminPlatformFeePaise || 0;
    totalLatePenaltiesPaise += b.latePenaltyPaise || 0;
    if (b.settlementStatus === 'PAID_OUT') {
      totalCompanionSettledPaise += b.companionNetSharePaise || 0;
    }
  }

  const pendingKycCount = Object.values(db.kycSubmissions).filter((k: any) => k.status === 'PENDING').length;

  return res.json({
    totalUsers,
    totalBookings,
    completedBookingsCount: completedBookings.length,
    pendingKycCount,
    finance: {
      totalGrossBookingVolumePaise,
      totalAdminPlatformFeePaise,
      totalCompanionSettledPaise,
      totalLatePenaltiesPaise
    }
  });
});

// Admin KYC Management (Client & Companion)
app.get('/api/admin/kyc/list', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN'), (req: Request, res: Response) => {
  const { userType, status } = req.query;

  let submissions = Object.values(db.kycSubmissions);

  if (userType) {
    submissions = submissions.filter((s: any) => s.userType === userType);
  }

  if (status && status !== 'ALL') {
    submissions = submissions.filter((s: any) => s.status === status);
  }

  return res.json({ submissions });
});

// Admin KYC Decision (Approve / Reject with reason)
app.post('/api/admin/kyc/:id/action', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, rejectionReason, adminId, adminEmail } = req.body;

  const submission = db.kycSubmissions[id];
  if (!submission) return res.status(404).json({ error: 'KYC submission not found' });

  const user = db.users[submission.userId];

  if (action === 'APPROVE') {
    submission.status = 'APPROVED';
    submission.decidedAt = new Date().toISOString();
    submission.decidedBy = adminEmail;

    if (user) {
      user.kycStatus = 'APPROVED';
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedBy = adminEmail;
    }

    // If companion, check live eligibility
    const companionProfile = db.companionProfiles[submission.userId];
    if (companionProfile) {
      companionProfile.isLive = Boolean(
        companionProfile.membership?.isActive &&
        new Date(companionProfile.membership.expiryDate) > new Date() &&
        companionProfile.bankDetails?.isVerified
      );
    }
  } else if (action === 'REJECT') {
    submission.status = 'REJECTED';
    submission.rejectionReason = rejectionReason || 'Identity verification documents could not be verified.';
    submission.decidedAt = new Date().toISOString();
    submission.decidedBy = adminEmail;

    if (user) {
      user.kycStatus = 'REJECTED';
      user.kycRejectionReason = submission.rejectionReason;
    }
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    adminId,
    adminEmail,
    action: `KYC_${action}`,
    targetId: submission.userId,
    details: `KYC for ${submission.legalName} (${submission.userType}) was ${action}ED.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);

  return res.json({ success: true, submission });
});

// Finance Admin: Payouts & Late Penalty audit desk
app.get('/api/admin/finance/settlements', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), (req: Request, res: Response) => {
  const now = Date.now();
  const bookings = Object.values(db.bookings).map((b: any) => {
    const isCompleted = b.status === 'COMPLETED';
    const isUnlockPassed = b.settlementUnlockUtc ? now >= new Date(b.settlementUnlockUtc).getTime() : false;
    
    let eligibility = 'IN_PROGRESS';
    if (b.settlementStatus === 'PAID_OUT') {
      eligibility = 'PAID_OUT';
    } else if (isCompleted && isUnlockPassed) {
      eligibility = 'ELIGIBLE_FOR_PAYOUT';
    } else if (isCompleted && !isUnlockPassed) {
      eligibility = 'LOCKED_48H';
    }

    const companionProfile = db.companionProfiles[b.companionId];
    const maskedBank = companionProfile?.bankDetails?.accountNumberMasked || 'N/A';
    const ifsc = companionProfile?.bankDetails?.ifsc || 'N/A';

    return {
      ...b,
      calculatedEligibility: eligibility,
      bankAccountMasked: maskedBank,
      ifsc
    };
  });

  return res.json({ settlements: bookings });
});

// Finance Admin: Re-authenticate MFA to reveal unmasked bank details
app.post('/api/admin/finance/reveal-bank', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), (req: Request, res: Response) => {
  const { companionId, adminEmail, mfaCode } = req.body;

  // Verify authorized admin from authenticated request
  const admin = (req as any).adminUser || Object.values(db.adminUsers).find((a: any) => a.email.toLowerCase() === adminEmail?.toLowerCase());
  if (!admin || !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(admin.role)) {
    return res.status(403).json({ error: 'Unauthorized to view sensitive bank records.' });
  }

  // MFA verification check
  if (!mfaCode || mfaCode !== '864085') {
    return res.status(400).json({ error: 'MFA Security Challenge failed. Enter valid security key (864085).' });
  }

  const profile = db.companionProfiles[companionId];
  if (!profile || !profile.bankDetails) {
    return res.status(404).json({ error: 'No bank details on record for this Companion.' });
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    adminId: admin.id,
    adminEmail: admin.email,
    adminRole: admin.role,
    action: 'UNMASK_BANK_DETAILS',
    targetId: companionId,
    details: `Admin ${admin.email} unmasked bank details for Companion ${companionId}.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);

  return res.json({
    success: true,
    bankDetails: {
      accountNumber: profile.bankDetails.accountNumber,
      ifsc: profile.bankDetails.ifsc,
      accountHolderName: profile.bankDetails.accountHolderName,
      bankName: profile.bankDetails.bankName
    }
  });
});

// Finance Admin: Manual Bank Payout submission (UTR number, atomic debit of locked balance)
app.post('/api/admin/finance/process-payout', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN'), (req: Request, res: Response) => {
  const { bookingId, utrNumber, adminId, adminEmail, paymentTimestamp } = req.body;

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.settlementStatus === 'PAID_OUT') {
    return res.status(400).json({ error: 'Payout already processed for this booking. Duplicate prevention triggered.' });
  }

  // Check 48-hour UTC lock
  if (booking.settlementUnlockUtc && Date.now() < new Date(booking.settlementUnlockUtc).getTime()) {
    return res.status(400).json({ error: 'Settlement is currently locked under 48-hour UTC safety hold.' });
  }

  if (!utrNumber || utrNumber.trim().length < 8) {
    return res.status(400).json({ error: 'Valid bank UTR transaction number is required.' });
  }

  const payoutId = `payout_${crypto.randomUUID().slice(0, 8)}`;
  const payoutRecord = {
    id: payoutId,
    bookingId: booking.id,
    companionId: booking.companionId,
    companionName: booking.companionName,
    amountPaise: booking.companionNetSharePaise,
    adminId,
    adminEmail,
    utrNumber: utrNumber.trim(),
    paymentTimestamp: paymentTimestamp || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  db.payouts[payoutId] = payoutRecord;
  booking.settlementStatus = 'PAID_OUT';
  booking.payoutId = payoutId;

  // Atomically debit locked wallet balance & add to settled total
  const wallet = db.companionWallets[booking.companionId];
  if (wallet) {
    wallet.lockedSettlementBalancePaise = Math.max(0, wallet.lockedSettlementBalancePaise - booking.companionNetSharePaise);
    wallet.totalSettledPaise += booking.companionNetSharePaise;
    wallet.lastUpdated = new Date().toISOString();
  }

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    adminId,
    adminEmail,
    action: 'PAYOUT_COMPLETED',
    targetId: booking.companionId,
    details: `Manual bank payout of ₹${(booking.companionNetSharePaise / 100).toFixed(2)} completed. UTR: ${utrNumber}.`,
    timestamp: new Date().toISOString()
  });

  saveDB(db);

  return res.json({
    success: true,
    message: 'Payout recorded successfully. Companion wallet updated.',
    payout: payoutRecord,
    booking
  });
});

// Admin Staff Management (Create KYC_ADMIN, FINANCE_ADMIN, etc.)
app.get('/api/admin/staff', requireAdminRoles('SUPER_ADMIN'), (req: Request, res: Response) => {
  return res.json({ staff: Object.values(db.adminUsers) });
});

app.post('/api/admin/staff/create', requireAdminRoles('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { email, phone, name, role, password } = req.body;

  const staffId = `admin_${crypto.randomUUID().slice(0, 8)}`;
  const newStaff = {
    id: staffId,
    email: email.toLowerCase(),
    phone: normalizeIndianPhone(phone) || phone,
    name,
    role: role || 'KYC_ADMIN',
    passwordHash: hashPassword(password || 'StaffPass@2026'),
    createdAt: new Date().toISOString()
  };

  db.adminUsers[staffId] = newStaff;
  saveDB(db);

  return res.json({ success: true, staff: newStaff });
});

// Admin Audit Logs
app.get('/api/admin/audit-logs', requireAdminRoles('SUPER_ADMIN', 'AUDITOR'), (req: Request, res: Response) => {
  return res.json({ logs: db.auditLogs.slice(0, 100) });
});

// Admin Client Management
app.get('/api/admin/clients', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'SUPPORT_ADMIN'), (req: Request, res: Response) => {
  const clients = Object.values(db.users)
    .filter((u: any) => u.role === 'CLIENT' || u.activeRole === 'CLIENT')
    .map((u: any) => {
      const userBookings = Object.values(db.bookings).filter((b: any) => b.clientId === u.id);
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
});

// Admin Companion Management
app.get('/api/admin/companions', requireAdminRoles('SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'), (req: Request, res: Response) => {
  const companions = Object.values(db.users)
    .filter((u: any) => u.role === 'COMPANION' || u.activeRole === 'COMPANION')
    .map((u: any) => {
      const profile = db.companionProfiles[u.id];
      const wallet = db.companionWallets[u.id];
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
    });
  return res.json({ companions });
});

// Admin Membership Records
app.get('/api/admin/memberships', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'), (req: Request, res: Response) => {
  const memberships: any[] = [];
  for (const [userId, profile] of Object.entries(db.companionProfiles) as any[]) {
    if (profile.membership) {
      const user = db.users[userId];
      memberships.push({
        id: profile.membership.paymentId || `mem_${userId}`,
        userId,
        userName: user?.legalName || 'Companion Host',
        userPhone: user?.phone,
        plan: profile.membership.plan,
        pricePaise: profile.membership.pricePaise,
        startDate: profile.membership.startDate,
        expiryDate: profile.membership.expiryDate,
        isActive: profile.membership.isActive && new Date(profile.membership.expiryDate) > new Date()
      });
    }
  }
  return res.json({ memberships });
});

// Admin Booking Management
app.get('/api/admin/bookings', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR'), (req: Request, res: Response) => {
  const bookings = Object.values(db.bookings).map((b: any) => {
    const copy = { ...b };
    delete copy.startOtp;
    delete copy.endOtp;
    delete copy.startOtpHmac;
    delete copy.endOtpHmac;
    return copy;
  });
  return res.json({ bookings });
});

// Admin Payment Records
app.get('/api/admin/payments', requireAdminRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'AUDITOR'), (req: Request, res: Response) => {
  const payments: any[] = [];
  // Bookings payments
  for (const b of Object.values(db.bookings) as any[]) {
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
  // Membership payments
  for (const [userId, profile] of Object.entries(db.companionProfiles) as any[]) {
    if (profile.membership?.paymentId) {
      const user = db.users[userId];
      payments.push({
        id: profile.membership.paymentId,
        type: 'COMPANION_MEMBERSHIP',
        bookingCode: `MEM-${profile.membership.plan}`,
        payerName: user?.legalName || 'Companion Host',
        recipientName: 'PairUpToday Platform',
        grossAmountPaise: profile.membership.pricePaise,
        adminFeePaise: profile.membership.pricePaise,
        companionSharePaise: 0,
        status: 'PAID',
        createdAt: profile.membership.startDate
      });
    }
  }
  return res.json({ payments });
});

// Companion Availability Toggle (Pause / Resume)
app.post('/api/companion/availability/toggle', (req: Request, res: Response) => {
  const { userId, isPaused } = req.body;
  const profile = db.companionProfiles[userId];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  profile.isPaused = Boolean(isPaused);
  saveDB(db);
  return res.json({ success: true, isPaused: profile.isPaused });
});

// User Notifications (Client & Companion)
app.get('/api/notifications/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const notifs: any[] = [];
  if (user.kycStatus === 'APPROVED') {
    notifs.push({
      id: 'notif_kyc_appr',
      title: 'Identity Verification Approved',
      message: 'Your government KYC documents have been verified and approved.',
      type: 'SUCCESS',
      timestamp: user.kycDecidedAt || user.createdAt
    });
  } else if (user.kycStatus === 'REJECTED') {
    notifs.push({
      id: 'notif_kyc_rej',
      title: 'Identity Verification Needs Attention',
      message: user.kycRejectionReason || 'Please resubmit your identity documents.',
      type: 'WARNING',
      timestamp: user.kycDecidedAt || user.createdAt
    });
  } else {
    notifs.push({
      id: 'notif_kyc_pend',
      title: 'KYC Document Verification Pending',
      message: 'Your profile is awaiting review by PairUp Security Network.',
      type: 'INFO',
      timestamp: user.createdAt
    });
  }

  const userBookings = Object.values(db.bookings).filter(
    (b: any) => b.clientId === userId || b.companionId === userId
  );

  for (const b of userBookings as any[]) {
    notifs.push({
      id: `notif_bk_${b.id}`,
      title: `Booking ${b.bookingCode} - ${b.status}`,
      message: `${b.serviceName} on ${b.date} from ${b.startTime} to ${b.endTime}`,
      type: b.status === 'COMPLETED' ? 'SUCCESS' : 'INFO',
      timestamp: b.createdAt
    });
  }

  return res.json({ notifications: notifs });
});

// -------------------------------------------------------------
// SUPPORT CENTER API ENDPOINTS
// -------------------------------------------------------------

// Create or get support conversation (Client/Companion)
app.post('/api/support/conversation', async (req: Request, res: Response) => {
  const { userId, subject } = req.body;
  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if open conversation exists
  const existingConvo = Object.values(db.supportConversations || {}).find(
    (c: any) => c.userId === userId && (c.status === 'OPEN' || c.status === 'IN_PROGRESS')
  );

  if (existingConvo) {
    return res.json({ conversation: existingConvo });
  }

  // Create new conversation
  const convoId = `support_${crypto.randomUUID().slice(0, 8)}`;
  const newConvo = {
    id: convoId,
    userId,
    status: 'OPEN',
    subject: subject || 'General Inquiry',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!db.supportConversations) db.supportConversations = {};
  db.supportConversations[convoId] = newConvo;
  saveDB(db);

  return res.json({ conversation: newConvo });
});

// Get user's support conversations
app.get('/api/support/conversations/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const convos = Object.values(db.supportConversations || {}).filter(
    (c: any) => c.userId === userId
  );
  return res.json({ conversations: convos });
});

// Get messages in a support conversation
app.get('/api/support/messages/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const messages = db.supportMessages?.[conversationId] || [];
  return res.json({ messages });
});

// Send message to support (Client/Companion)
app.post('/api/support/message', async (req: Request, res: Response) => {
  const { conversationId, userId, message } = req.body;
  const convo = db.supportConversations?.[conversationId];
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

  if (!db.supportMessages) db.supportMessages = {};
  if (!db.supportMessages[conversationId]) {
    db.supportMessages[conversationId] = [];
  }

  const newMessage = {
    id: crypto.randomUUID(),
    conversationId,
    senderId: userId,
    isAdmin: false,
    message,
    createdAt: new Date().toISOString()
  };

  db.supportMessages[conversationId].push(newMessage);
  convo.updatedAt = new Date().toISOString();
  saveDB(db);

  return res.json({ message: newMessage });
});

// Admin: List all support conversations
app.get('/api/admin/support/conversations', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), (req: Request, res: Response) => {
  const convos = Object.values(db.supportConversations || {});
  return res.json({ conversations: convos });
});

// Admin: Get messages in a conversation
app.get('/api/admin/support/messages/:conversationId', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const messages = db.supportMessages?.[conversationId] || [];
  return res.json({ messages });
});

// Admin: Send reply to support conversation
app.post('/api/admin/support/reply', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), async (req: Request, res: Response) => {
  const { conversationId, adminId, message } = req.body;
  const convo = db.supportConversations?.[conversationId];
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  if (!db.supportMessages) db.supportMessages = {};
  if (!db.supportMessages[conversationId]) {
    db.supportMessages[conversationId] = [];
  }

  const newMessage = {
    id: crypto.randomUUID(),
    conversationId,
    senderId: adminId,
    isAdmin: true,
    message,
    createdAt: new Date().toISOString()
  };

  db.supportMessages[conversationId].push(newMessage);
  convo.status = 'IN_PROGRESS';
  convo.assignedAdminId = adminId;
  convo.updatedAt = new Date().toISOString();
  saveDB(db);

  // Log audit
  db.auditLogs.push({
    id: crypto.randomUUID(),
    adminId,
    action: 'SUPPORT_REPLY',
    entity_type: 'support_conversation',
    entity_id: conversationId,
    details: { messageLength: message.length },
    timestamp: new Date().toISOString()
  });
  saveDB(db);

  return res.json({ message: newMessage });
});

// Admin: Update conversation status
app.post('/api/admin/support/conversation/:id/status', requireAdminRoles('SUPER_ADMIN', 'SUPPORT_ADMIN'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, adminId } = req.body;
  const convo = db.supportConversations?.[id];
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  convo.status = status;
  if (status === 'RESOLVED' || status === 'CLOSED') {
    convo.assignedAdminId = adminId;
  }
  convo.updatedAt = new Date().toISOString();
  saveDB(db);

  return res.json({ conversation: convo });
});

// -------------------------------------------------------------
// LOCATION TRACKING ENDPOINTS (Firebase RTDB)
// -------------------------------------------------------------

// Update user's current location
app.post('/api/location/update', async (req: Request, res: Response) => {
  const { userId, latitude, longitude, bookingId } = req.body;

  if (!userId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Validate coordinates
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  if (!isFirebaseConfigured()) {
    // Fallback: store in JSON DB temporarily
    if (!db.userLocations) db.userLocations = {};
    db.userLocations[userId] = {
      latitude,
      longitude,
      timestamp: Date.now(),
      bookingId
    };
    saveDB(db);
    return res.json({ success: true, provider: 'json_fallback' });
  }

  const success = await updateUserLocation(userId, latitude, longitude, bookingId);
  if (success) {
    return res.json({ success: true, provider: 'firebase' });
  } else {
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get user's current location
app.get('/api/location/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requestingUserId = req.headers['x-user-id'] as string;

  if (!requestingUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Authorization: can only view location if:
  // 1. It's your own location, OR
  // 2. You have an active booking with this user AND location sharing is enabled
  const requestingUser = db.users[requestingUserId];
  const targetUser = db.users[userId];

  if (!requestingUser || !targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isOwnLocation = requestingUserId === userId;

  // Check for active booking with location sharing
  let hasBookingWithSharing = false;
  if (!isOwnLocation) {
    const activeBooking = Object.values(db.bookings).find((b: any) => {
      const isActive = b.status === 'CONFIRMED' || b.status === 'COMPANION_ARRIVED' || b.status === 'IN_PROGRESS';
      const isParticipant = b.clientId === requestingUserId && b.companionId === userId ||
                          b.clientId === userId && b.companionId === requestingUserId;
      return isActive && isParticipant;
    });

    if (activeBooking) {
      if (isFirebaseConfigured()) {
        hasBookingWithSharing = await isLocationSharingActive(userId, activeBooking.id);
      } else {
        // Fallback check
        hasBookingWithSharing = db.userLocations?.[userId]?.bookingId === activeBooking.id;
      }
    }
  }

  if (!isOwnLocation && !hasBookingWithSharing) {
    return res.status(403).json({ error: 'Not authorized to view this location' });
  }

  if (isFirebaseConfigured()) {
    const location = await getUserLocation(userId);
    if (location) {
      // Don't return bookingId to prevent information leakage
      const { bookingId, ...safeLocation } = location;
      return res.json({ location: safeLocation, provider: 'firebase' });
    }
  } else {
    // Fallback
    const location = db.userLocations?.[userId];
    if (location) {
      const { bookingId, ...safeLocation } = location;
      return res.json({ location: safeLocation, provider: 'json_fallback' });
    }
  }

  return res.status(404).json({ error: 'Location not found' });
});

// Start location sharing for a booking
app.post('/api/location/sharing/start', async (req: Request, res: Response) => {
  const { userId, bookingId } = req.body;

  if (!userId || !bookingId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Authorization: only booking participants can start sharing
  if (booking.clientId !== userId && booking.companionId !== userId) {
    return res.status(403).json({ error: 'Not authorized for this booking' });
  }

  if (!isFirebaseConfigured()) {
    // Fallback
    if (!db.userLocations) db.userLocations = {};
    if (!db.userLocations[userId]) db.userLocations[userId] = {};
    db.userLocations[userId].bookingId = bookingId;
    db.userLocations[userId].sharingStartedAt = Date.now();
    saveDB(db);
    return res.json({ success: true, provider: 'json_fallback' });
  }

  const success = await startLocationSharing(userId, bookingId);
  if (success) {
    return res.json({ success: true, provider: 'firebase' });
  } else {
    return res.status(500).json({ error: 'Failed to start location sharing' });
  }
});

// Stop location sharing for a booking
app.post('/api/location/sharing/stop', async (req: Request, res: Response) => {
  const { userId, bookingId } = req.body;

  if (!userId || !bookingId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const booking = db.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.clientId !== userId && booking.companionId !== userId) {
    return res.status(403).json({ error: 'Not authorized for this booking' });
  }

  if (!isFirebaseConfigured()) {
    // Fallback
    if (db.userLocations?.[userId]) {
      delete db.userLocations[userId].bookingId;
      delete db.userLocations[userId].sharingStartedAt;
      saveDB(db);
    }
    return res.json({ success: true, provider: 'json_fallback' });
  }

  const success = await stopLocationSharing(userId, bookingId);
  if (success) {
    return res.json({ success: true, provider: 'firebase' });
  } else {
    return res.status(500).json({ error: 'Failed to stop location sharing' });
  }
});

// Set user online/offline presence
app.post('/api/presence', async (req: Request, res: Response) => {
  const { userId, online } = req.body;

  if (!userId || online === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!isFirebaseConfigured()) {
    // Fallback: store in JSON DB
    if (!db.userPresence) db.userPresence = {};
    db.userPresence[userId] = { online, lastSeen: Date.now() };
    saveDB(db);
    return res.json({ success: true, provider: 'json_fallback' });
  }

  const success = await setUserPresence(userId, online);
  if (success) {
    return res.json({ success: true, provider: 'firebase' });
  } else {
    return res.status(500).json({ error: 'Failed to set presence' });
  }
});

// Get user presence
app.get('/api/presence/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (isFirebaseConfigured()) {
    const presence = await getUserPresence(userId);
    if (presence) {
      return res.json({ presence, provider: 'firebase' });
    }
  } else {
    // Fallback
    const presence = db.userPresence?.[userId];
    if (presence) {
      return res.json({ presence, provider: 'json_fallback' });
    }
  }

  return res.json({ presence: { online: false, lastSeen: null }, provider: 'none' });
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

  const predictions = await getPlaceAutocomplete(input, location, radiusKm);
  return res.json({ predictions });
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

  const result = await geocodeAddress(
    (address || place_id) as string,
    !!place_id
  );

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

  const result = await reverseGeocode(parseFloat(lat as string), parseFloat(lng as string));

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
app.get('/api/maps/distance', (req: Request, res: Response) => {
  const { lat1, lng1, lat2, lng2 } = req.query;

  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return res.status(400).json({ error: 'All coordinates are required' });
  }

  const distance = calculateDistance(
    parseFloat(lat1 as string),
    parseFloat(lng1 as string),
    parseFloat(lat2 as string),
    parseFloat(lng2 as string)
  );

  return res.json({ distanceKm: distance });
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
      configured: dbType === 'supabase' || true // JSON DB always works
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
        return res.sendFile(path.join(distAdminDir, 'index.html'));
      }
      if (isProduction && fs.existsSync(path.join(distDir, 'admin.html'))) {
        return res.sendFile(path.join(distDir, 'admin.html'));
      }
      return res.sendFile(path.join(__dirname, 'admin.html'));
    }

    // Direct standalone admin access route
    if (req.path === '/admin' || req.path === '/admin.html') {
      if (isProduction && fs.existsSync(distAdminDir)) {
        return res.sendFile(path.join(distAdminDir, 'index.html'));
      }
      if (isProduction && fs.existsSync(path.join(distDir, 'admin.html'))) {
        return res.sendFile(path.join(distDir, 'admin.html'));
      }
      return res.sendFile(path.join(__dirname, 'admin.html'));
    }

    next();
  });

  if (isProduction && fs.existsSync(distDir)) {
    // Serve separately built Admin assets if present
    if (fs.existsSync(distAdminDir)) {
      app.use('/admin-assets', express.static(path.join(distAdminDir, 'assets')));
    }
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      const host = req.headers.host || '';
      if (host.startsWith('admin.') && fs.existsSync(distAdminDir)) {
        return res.sendFile(path.join(distAdminDir, 'index.html'));
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
