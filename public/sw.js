/* Doreham service worker: shows push notifications and opens the right page on tap. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function safePath(u) {
  return typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : '/matches';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Doreham 도레함';
  const url = safePath(data.url);
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      // Chat messages only: if that chat is open on screen, don't ring. Browsers still require a
      // notification for every push, so show a silent one and close it right away.
      // Every other notification is always shown.
      const isChat = !!tag && tag.startsWith('chat-');
      const watching = isChat && list.some((c) => c.visibilityState === 'visible' && c.focused && new URL(c.url).pathname === url);
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        data: { url },
        tag,
        renotify: !!tag && !watching,
        silent: watching,
      });
      if (watching) {
        const shown = await self.registration.getNotifications(tag ? { tag } : undefined);
        shown.filter((n) => n.title === title && (n.data || {}).url === url).forEach((n) => n.close());
      }
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : w));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
