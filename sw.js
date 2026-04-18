/* ============================================
   AEGIS — Service Worker
   Push Notifications & Offline Cache
   ============================================ */

const CACHE_NAME = 'aegis-guest-v1';
const ASSETS_TO_CACHE = [
  '/guest',
  '/css/guest.css',
  '/js/guest.js',
];

// Install — Cache guest page assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate — Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Push — Receive push notification from server
self.addEventListener('push', (event) => {
  let data = { title: 'AEGIS Alert', body: 'Emergency alert from hotel.', type: 'alert' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const severity = data.severity || 'high';
  const iconEmoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : 'ℹ️';

  const options = {
    body: data.body || 'Please check the AEGIS app for details.',
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: data.tag || 'aegis-crisis-alert',
    renotify: true,
    requireInteraction: true, // Don't auto-dismiss — critical for emergencies
    vibrate: [300, 100, 300, 100, 300], // SOS pattern
    data: {
      url: data.url || '/guest',
      type: data.type || 'alert',
      severity: severity,
      crisisId: data.crisisId || null,
      evacRoute: data.evacRoute || null,
    },
    actions: [
      { action: 'view', title: `${iconEmoji} View Details` },
      { action: 'acknowledge', title: '✓ Acknowledge' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AEGIS Emergency Alert', options)
  );
});

// Notification Click — Handle action buttons and body click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action; // 'view', 'acknowledge', or '' (body click)
  const notifData = event.notification.data || {};
  const urlToOpen = notifData.url || '/guest';

  // "Acknowledge" — just dismiss the notification, no navigation
  if (action === 'acknowledge') {
    event.waitUntil(
      // Notify any open guest page that user acknowledged
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/guest')) {
            client.postMessage({ type: 'ALERT_ACKNOWLEDGED', data: notifData });
          }
        }
      })
    );
    return;
  }

  // "View Details" or body click — open/focus the guest page in crisis mode
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If guest page is already open, focus it and push crisis data
      for (const client of clientList) {
        if (client.url.includes('/guest') && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            focusedClient.postMessage({
              type: 'CRISIS_ALERT',
              data: notifData,
            });
          });
        }
      }
      // Otherwise open a new window to the guest page
      return self.clients.openWindow(urlToOpen);
    })
  );
});
