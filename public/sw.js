self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Malformed push payload — fall back to defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Hot Truck Map', {
      body: data.body ?? 'A truck you follow is now live!',
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Restrict to same-origin relative paths to prevent open-redirect via push payload
  const raw = event.notification.data?.url ?? '/';
  const safe = (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//'))
    ? raw
    : '/';
  event.waitUntil(clients.openWindow(self.location.origin + safe));
});
