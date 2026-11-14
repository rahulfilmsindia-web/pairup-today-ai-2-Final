import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, type Messaging, type Message, type MulticastMessage, type SendResponse } from 'firebase-admin/messaging';

// FCM instance
let messaging: Messaging | null = null;

/**
 * Initialize Firebase Cloud Messaging
 */
export function initializeFCM() {
  try {
    const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!serviceAccountKey || !projectId || !clientEmail) {
      console.warn('Firebase credentials not configured. FCM will be disabled.');
      return null;
    }

    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, '\n')
    };

    const app = getApps().find(candidate => candidate.name === 'fcm-app') || initializeApp({
      credential: cert(serviceAccount),
      ...(process.env.FIREBASE_DATABASE_URL ? { databaseURL: process.env.FIREBASE_DATABASE_URL } : {})
    }, 'fcm-app');

    messaging = getMessaging(app);
    console.log('Firebase Cloud Messaging initialized successfully');
    return messaging;
  } catch (error) {
    console.error('Failed to initialize FCM:', error);
    return null;
  }
}

/**
 * Get FCM instance
 */
export function getFCM(): Messaging | null {
  if (!messaging) {
    messaging = initializeFCM();
  }
  return messaging;
}

/**
 * Send notification to a specific device
 */
export async function sendToDevice(
  token: string,
  notification: {
    title: string;
    body: string;
  },
  data?: Record<string, string>
): Promise<boolean> {
  const fcm = getFCM();
  if (!fcm) {
    throw new Error('Firebase Cloud Messaging is not configured.');
  }

  try {
    const message: Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data
    };

    await fcm.send(message);
    return true;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Send notification to multiple devices
 */
export async function sendToMultipleDevices(
  tokens: string[],
  notification: {
    title: string;
    body: string;
  },
  data?: Record<string, string>
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const fcm = getFCM();
  if (!fcm) {
    throw new Error('Firebase Cloud Messaging is not configured.');
  }
  if (tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };

  try {
    const invalidTokens: string[] = [];
    let success = 0;
    let failure = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const message: MulticastMessage = {
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
      response.responses.forEach((resp: SendResponse, index: number) => {
        if (!resp.success && (
          resp.error?.code === 'messaging/registration-token-not-registered' ||
          resp.error?.code === 'messaging/invalid-registration-token'
        )) {
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

/**
 * Send notification to a topic
 */
export async function sendToTopic(
  topic: string,
  notification: {
    title: string;
    body: string;
  },
  data?: Record<string, string>
): Promise<boolean> {
  const fcm = getFCM();
  if (!fcm) {
    console.warn('FCM not configured, topic notification not sent');
    return false;
  }

  try {
    const message: Message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data
    };

    await fcm.send(message);
    console.log(`Notification sent to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Failed to send notification to topic:', error);
    return false;
  }
}

/**
 * Subscribe a device to a topic
 */
export async function subscribeToTopic(
  token: string,
  topic: string
): Promise<boolean> {
  const fcm = getFCM();
  if (!fcm) return false;

  try {
    await fcm.subscribeToTopic([token], topic);
    console.log(`Device subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Failed to subscribe to topic:', error);
    return false;
  }
}

/**
 * Unsubscribe a device from a topic
 */
export async function unsubscribeFromTopic(
  token: string,
  topic: string
): Promise<boolean> {
  const fcm = getFCM();
  if (!fcm) return false;

  try {
    await fcm.unsubscribeFromTopic([token], topic);
    console.log(`Device unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from topic:', error);
    return false;
  }
}

/**
 * Notification type helpers
 */
export const NotificationTypes = {
  KYC_SUBMITTED: 'kyc_submitted',
  KYC_APPROVED: 'kyc_approved',
  KYC_REJECTED: 'kyc_rejected',
  MEMBERSHIP_PURCHASED: 'membership_purchased',
  MEMBERSHIP_EXPIRING: 'membership_expiring',
  BANK_VERIFIED: 'bank_verified',
  BOOKING_REQUEST: 'booking_request',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  COMPANION_ARRIVED: 'companion_arrived',
  BOOKING_STARTED: 'booking_started',
  BOOKING_COMPLETED: 'booking_completed',
  CHAT_MESSAGE: 'chat_message',
  SUPPORT_REPLY: 'support_reply',
  PAYMENT_RECEIVED: 'payment_received',
  PAYOUT_PROCESSED: 'payout_processed'
} as const;

/**
 * Send KYC status notification
 */
export async function sendKycStatusNotification(
  userId: string,
  deviceToken: string,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string
): Promise<boolean> {
  const title = status === 'APPROVED' ? 'KYC Approved' : 'KYC Needs Attention';
  const body = status === 'APPROVED'
    ? 'Your identity verification has been approved. You can now access all features.'
    : `Your KYC requires attention. ${rejectionReason || 'Please resubmit your documents.'}`;

  return sendToDevice(deviceToken, { title, body }, {
    type: status === 'APPROVED' ? NotificationTypes.KYC_APPROVED : NotificationTypes.KYC_REJECTED,
    userId,
    status
  });
}

/**
 * Send booking notification
 */
export async function sendBookingNotification(
  deviceToken: string,
  type: 'CONFIRMED' | 'CANCELLED' | 'ARRIVED' | 'STARTED' | 'COMPLETED',
  bookingCode: string,
  serviceName: string
): Promise<boolean> {
  const titles = {
    CONFIRMED: 'Booking Confirmed',
    CANCELLED: 'Booking Cancelled',
    ARRIVED: 'Companion Arrived',
    STARTED: 'Session Started',
    COMPLETED: 'Booking Completed'
  };

  const bodies = {
    CONFIRMED: `Your booking ${bookingCode} for ${serviceName} has been confirmed.`,
    CANCELLED: `Booking ${bookingCode} has been cancelled.`,
    ARRIVED: `Your companion has arrived for booking ${bookingCode}.`,
    STARTED: `Your session for booking ${bookingCode} has started.`,
    COMPLETED: `Booking ${bookingCode} has been completed.`
  };

  return sendToDevice(deviceToken, {
    title: titles[type],
    body: bodies[type]
  }, {
    type: `booking_${type.toLowerCase()}`,
    bookingCode,
    serviceName
  });
}

/**
 * Send chat message notification
 */
export async function sendChatNotification(
  recipientToken: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<boolean> {
  return sendToDevice(recipientToken, {
    title: `New message from ${senderName}`,
    body: messagePreview
  }, {
    type: NotificationTypes.CHAT_MESSAGE,
    conversationId
  });
}

/**
 * Send support reply notification
 */
export async function sendSupportReplyNotification(
  userToken: string,
  messagePreview: string
): Promise<boolean> {
  return sendToDevice(userToken, {
    title: 'Support Team Reply',
    body: messagePreview
  }, {
    type: NotificationTypes.SUPPORT_REPLY
  });
}

/**
 * Check if FCM is configured
 */
export function isFCMConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
}
