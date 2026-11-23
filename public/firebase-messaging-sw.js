// ==============================================================================
// PairUpToday: Firebase Cloud Messaging & Rapido-Style Incoming Alert Service Worker
// Handles Background Wakeup & Full-Screen Intent / System Alert Window Simulation
// ==============================================================================

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
const firebaseConfig = {
  apiKey: "AIzaSyPairUpTodayMockKey2026",
  projectId: "project-f4b5d045-f344-4919-8e8",
  messagingSenderId: "618104708054",
  appId: "1:618104708054:web:pairuptoday"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Background Data-Only Message Handler (Rapido Captain Style)
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background data payload:', payload);

    const data = payload.data || {};
    const bookingId = data.booking_id || '';
    const amountRupees = data.amount_rupees || '0';
    const clientName = data.client_name || 'Client';
    const clientLocation = data.client_location || 'Meeting Point';
    const distanceKm = data.distance_km || '1.5';
    const scheduledTime = data.scheduled_time || 'Today';

    const notificationTitle = `🚨 NEW BOOKING REQUEST: ₹${amountRupees}`;
    const notificationOptions = {
      body: `Client: ${clientName} (${distanceKm} km away)\nLocation: ${clientLocation}\nTime: ${scheduledTime}`,
      icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      badge: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      tag: `booking-alert-${bookingId}`,
      renotify: true,
      requireInteraction: true, // Remains on screen like an incoming call
      silent: false,
      vibrate: [600, 200, 600, 200, 600, 200, 800],
      data: {
        bookingId,
        url: `/companion?booking_alert=${bookingId}&amount=${amountRupees}&client=${encodeURIComponent(clientName)}`
      },
      actions: [
        { action: 'accept', title: '✅ ACCEPT (30s)' },
        { action: 'decline', title: '❌ DECLINE' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Fallback to native push listener', e);
}

// Native Push Event Fallback
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const raw = event.data.json();
    const data = raw.data || raw;
    if (data.type === 'INCOMING_BOOKING') {
      const title = `🚨 NEW BOOKING REQUEST: ₹${data.amount_rupees || '0'}`;
      const options = {
        body: `Client: ${data.client_name || 'Client'} (${data.distance_km || '1.5'} km away)\nLocation: ${data.client_location || 'Nearby'}`,
        icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
        badge: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
        tag: `booking-alert-${data.booking_id || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [600, 200, 600, 200, 600, 200, 800],
        data: {
          bookingId: data.booking_id,
          url: `/companion?booking_alert=${data.booking_id}`
        },
        actions: [
          { action: 'accept', title: '✅ ACCEPT' },
          { action: 'decline', title: '❌ DECLINE' }
        ]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (err) {
    console.error('Push parse error in SW:', err);
  }
});

// Notification Click Handler: Opens/focuses the Companion window immediately
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/companion';
  const isAccept = event.action === 'accept';
  const isDecline = event.action === 'decline';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/companion') && 'focus' in client) {
          if (isAccept) {
            client.postMessage({ type: 'QUICK_ACCEPT_BOOKING', bookingId: event.notification.data?.bookingId });
          } else if (isDecline) {
            client.postMessage({ type: 'QUICK_DECLINE_BOOKING', bookingId: event.notification.data?.bookingId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
