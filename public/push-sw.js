// Avisos al móvil: lo importa el service worker que genera vite-plugin-pwa (workbox.importScripts en
// vite.config.ts). El aviso llega de la Edge Function send-push como JSON {title, body, tag, url}.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lista de la compra', {
      body: data.body,
      tag: data.tag, // mismo tag = sustituye al aviso anterior de esa lista
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: data.url },
    }),
  );
});

// Tocar el aviso abre la lista (reutiliza la ventana de la app si ya está abierta)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) return open.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
