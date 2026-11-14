import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';

// Firebase Admin SDK initialization
let firebaseApp: App | null = null;
let rtdb: Database | null = null;

// Initialize Firebase Admin SDK
export function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const databaseURL = process.env.FIREBASE_DATABASE_URL?.trim();

  if (!serviceAccountKey || !projectId || !clientEmail || !databaseURL) {
    console.warn('Firebase Admin credentials or FIREBASE_DATABASE_URL are not configured. Firebase features will be disabled.');
    return null;
  }

  try {
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, '\n')
    };

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL
    });

    rtdb = getDatabase(firebaseApp);
    console.log('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

// Get Firebase Realtime Database instance
export function getRTDB(): Database {
  if (!rtdb) {
    initializeFirebase();
  }
  if (!rtdb) throw new Error('Firebase Realtime Database is not configured.');
  return rtdb;
}

// Firebase Realtime Database operations for location tracking
export interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  bookingId?: string;
}

// Update user's location in Firebase RTDB
export async function updateUserLocation(
  userId: string,
  latitude: number,
  longitude: number,
  bookingId: string
): Promise<void> {
  const db = getRTDB();
  const update: LocationUpdate = { userId, latitude, longitude, timestamp: Date.now(), bookingId };
  await db.ref(`bookings/${bookingId}/locations/${userId}`).set(update);
}

// Get user's current location
export async function getUserLocation(userId: string, bookingId: string): Promise<LocationUpdate | null> {
  const db = getRTDB();
  const snapshot = await db.ref(`bookings/${bookingId}/locations/${userId}`).once('value');
  return snapshot.val();
}

// Remove user's location (e.g., after booking completion)
export async function removeUserLocation(userId: string, bookingId: string): Promise<void> {
  const db = getRTDB();
  await db.ref(`bookings/${bookingId}/locations/${userId}`).remove();
}

// Start location sharing for a booking
export async function startLocationSharing(
  userId: string,
  bookingId: string
): Promise<void> {
  const db = getRTDB();
  await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(true);
  await db.ref(`bookings/${bookingId}/participants/${userId}/startedAt`).set(Date.now());
}

// Stop location sharing for a booking
export async function stopLocationSharing(
  userId: string,
  bookingId: string
): Promise<void> {
  const db = getRTDB();
  await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(false);
  await db.ref(`bookings/${bookingId}/participants/${userId}/stoppedAt`).set(Date.now());
  await removeUserLocation(userId, bookingId);
}

// Check if location sharing is active for a booking
export async function isLocationSharingActive(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const db = getRTDB();
  const snapshot = await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).once('value');
  return snapshot.val() === true;
}

// Set user online/offline presence
export async function setUserPresence(userId: string, online: boolean): Promise<boolean> {
  const db = getRTDB();
  const presenceRef = db.ref(`presence/${userId}`);
  await presenceRef.set({ online, lastSeen: Date.now() });
  if (online) {
    await presenceRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
  }
  return true;
}

// Get user presence
export async function getUserPresence(userId: string): Promise<{ online: boolean; lastSeen: number } | null> {
  const db = getRTDB();
  const snapshot = await db.ref(`presence/${userId}`).once('value');
  return snapshot.val();
}

// Clean up expired location data (called by scheduled job)
export async function cleanupExpiredLocations(): Promise<number> {
  const db = getRTDB();
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
  const bookingsSnapshot = await db.ref('bookings').once('value');
  const bookings = bookingsSnapshot.val() as Record<string, any> | null;
  let cleanedCount = 0;
  for (const [bookingId, booking] of Object.entries(bookings || {})) {
    const locations = booking?.locations as Record<string, LocationUpdate> | undefined;
    for (const [userId, location] of Object.entries(locations || {})) {
      if (typeof location.timestamp === 'number' && location.timestamp < cutoffTime) {
        await db.ref(`bookings/${bookingId}/locations/${userId}`).remove();
        cleanedCount++;
      }
    }
  }
  return cleanedCount;
}

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_DATABASE_URL
  );
}
