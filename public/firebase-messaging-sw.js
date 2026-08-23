// Firebase Cloud Messaging Background Service Worker
//
// The Firebase config is not baked into this file: it is passed as query params
// when the app registers the worker (see lib/firebase-messaging.ts). All of those
// values are the public NEXT_PUBLIC_FIREBASE_* client keys.
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId
);

if (!isConfigured) {
  console.error(
    '[firebase-messaging-sw.js] Missing Firebase config in the registration URL. Background notifications are disabled.'
  );
} else {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'PLATA - Vencimiento Próximo';
    const notificationOptions = {
      body: payload.notification?.body || 'Tienes facturas por vencer pronto.',
      icon: '/icon-512.png',
      badge: '/icon-dark-32x32.png',
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Focus an open tab (or open one) when the user taps a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/vencimientos';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
