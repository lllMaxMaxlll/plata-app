// Firebase se sacó del proyecto, pero los navegadores donde la PWA ya estaba
// instalada siguen teniendo registrado su service worker de notificaciones y
// lo piden en cada carga. Este archivo lo reemplaza: al activarse se
// desregistra y recarga las pestañas abiertas, y después nadie vuelve a
// pedirlo. Se puede borrar cuando ya no aparezcan pedidos en los logs.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: "window" })
      for (const client of clients) client.navigate(client.url)
    })()
  )
})
