// PairUpToday Service Worker for Instant Background Alerts & Heads-Up Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification interaction (Heads-up notification click on Android / Mobile)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  const targetUrl = data.url || '/companion-dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus open companion dashboard window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/companion-dashboard') || client.url.includes('pairuptoday')) {
          if (action && data.bookingId) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action,
              bookingId: data.bookingId
            });
          }
          return client.focus();
        }
      }
      // If no window is open, open one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Web Push listener — Wakes up Service Worker even when browser is minimized, screen is locked, or inside other apps!
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();

    // If client canceled, immediately clear active incoming call notifications
    if (payload.type === 'BOOKING_CANCELLED') {
      event.waitUntil(
        self.registration.getNotifications({ tag: 'incoming-booking-call' }).then((list) => {
          list.forEach((n) => n.close());
        })
      );
      return;
    }

    const title = payload.title || '🚨 INCOMING BOOKING CALL!';
    const options = {
      body: payload.body || 'A new client booking request has arrived. Tap to view and accept.',
      icon: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      badge: '/assets/aistudio/image_AIIEuv.png_bc62f6e1.png',
      tag: payload.tag || 'incoming-booking-call',
      category: 'call',
      priority: 2,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [800, 300, 800, 300, 800, 300, 800],
      data: {
        url: payload.url || '/companion-dashboard',
        bookingId: payload.bookingId,
        booking: payload.booking
      },
      actions: [
        { action: 'open', title: '📞 ANSWER / VIEW' },
        { action: 'decline', title: '❌ DECLINE' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('Push error:', err);
  }
});
