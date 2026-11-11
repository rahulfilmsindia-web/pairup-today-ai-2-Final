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

  if (!serviceAccountKey || !projectId || !clientEmail) {
    console.warn('Firebase credentials not configured. Firebase features will be disabled.');
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
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
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
export function getRTDB(): Database | null {
  if (!rtdb) {
    initializeFirebase();
  }
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
  bookingId?: string
): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    const locationRef = db.ref(`locations/${userId}`);
    const update: LocationUpdate = {
      userId,
      latitude,
      longitude,
      timestamp: Date.now()
    };

    if (bookingId) {
      update.bookingId = bookingId;
    }

    await locationRef.set(update);
    return true;
  } catch (error) {
    console.error('Failed to update user location:', error);
    return false;
  }
}

// Get user's current location
export async function getUserLocation(userId: string): Promise<LocationUpdate | null> {
  const db = getRTDB();
  if (!db) return null;

  try {
    const snapshot = await db.ref(`locations/${userId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('Failed to get user location:', error);
    return null;
  }
}

// Remove user's location (e.g., after booking completion)
export async function removeUserLocation(userId: string): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    await db.ref(`locations/${userId}`).remove();
    return true;
  } catch (error) {
    console.error('Failed to remove user location:', error);
    return false;
  }
}

// Start location sharing for a booking
export async function startLocationSharing(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(true);
    await db.ref(`bookings/${bookingId}/participants/${userId}/startedAt`).set(Date.now());
    return true;
  } catch (error) {
    console.error('Failed to start location sharing:', error);
    return false;
  }
}

// Stop location sharing for a booking
export async function stopLocationSharing(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(false);
    await db.ref(`bookings/${bookingId}/participants/${userId}/stoppedAt`).set(Date.now());
    return true;
  } catch (error) {
    console.error('Failed to stop location sharing:', error);
    return false;
  }
}

// Check if location sharing is active for a booking
export async function isLocationSharingActive(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    const snapshot = await db.ref(`bookings/${bookingId}/participants/${userId}/sharing`).once('value');
    return snapshot.val() === true;
  } catch (error) {
    console.error('Failed to check location sharing status:', error);
    return false;
  }
}

// Set user online/offline presence
export async function setUserPresence(userId: string, online: boolean): Promise<boolean> {
  const db = getRTDB();
  if (!db) return false;

  try {
    const presenceRef = db.ref(`presence/${userId}`);
    await presenceRef.set({
      online,
      lastSeen: Date.now()
    });

    // Set up disconnect handler
    if (online) {
      presenceRef.onDisconnect().set({
        online: false,
        lastSeen: Date.now()
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to set user presence:', error);
    return false;
  }
}

// Get user presence
export async function getUserPresence(userId: string): Promise<{ online: boolean; lastSeen: number } | null> {
  const db = getRTDB();
  if (!db) return null;

  try {
    const snapshot = await db.ref(`presence/${userId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('Failed to get user presence:', error);
    return null;
  }
}

// Clean up expired location data (called by scheduled job)
export async function cleanupExpiredLocations(): Promise<number> {
  const db = getRTDB();
  if (!db) return 0;

  try {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const locationsRef = db.ref('locations');
    const snapshot = await locationsRef.once('value');
    const locations = snapshot.val();

    if (!locations) return 0;

    let cleanedCount = 0;
    for (const [userId, location] of Object.entries(locations)) {
      const loc = location as LocationUpdate;
      if (loc.timestamp < cutoffTime) {
        await locationsRef.child(userId).remove();
        cleanedCount++;
      }
    }

    return cleanedCount;
  } catch (error) {
    console.error('Failed to cleanup expired locations:', error);
    return 0;
  }
}

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
}
