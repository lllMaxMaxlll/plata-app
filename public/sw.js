// Service worker de EN MANO: la app abre y se navega sin conexión.
//
// - Páginas: primero la red, y si no hay (o tarda demasiado) la última copia
//   guardada. El HTML no tiene nada del usuario —los datos los trae el cliente
//   desde Supabase—, así que guardarlo es seguro.
// - /_next/static: los nombres llevan hash, así que un archivo guardado nunca
//   queda viejo y se sirve directo del cache.
// - Supabase, /api y todo lo que no sea GET pasan derecho: los datos offline los
//   guarda el FinanceProvider en localStorage, no este archivo.
//
// Subir VERSION descarta los caches anteriores en la próxima activación.

const VERSION = "v2"
const PAGES_CACHE = `lucas-pages-${VERSION}`
const STATIC_CACHE = `lucas-static-${VERSION}`

// Mismas pantallas que lib/routes.ts: se bajan al instalar para que todas abran
// offline aunque nunca se hayan visitado.
const ROUTES = [
  "/",
  "/plata",
  "/agenda",
  "/profile",
  "/activity",
  "/search",
  "/accounts",
  "/analytics",
  "/stocks",
  "/dashboard/proyecciones",
  "/vehicles",
  "/dashboard/vencimientos",
]

const PUBLIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-icon.png",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
]

// Cada deploy deja chunks nuevos y los viejos no se borran solos.
const STATIC_LIMIT = 400

// Con una red que "anda pero no anda" esperar al fetch deja la pantalla en
// blanco: pasado este tiempo, si hay copia guardada, se muestra esa.
const NAVIGATION_TIMEOUT_MS = 3500

const STATIC_URL = /\/_next\/static\/[^"'\s)\\]+/g

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES_CACHE, STATIC_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith("lucas-") && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(navigation(event, url))
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Los payloads RSC de la navegación del cliente no se guardan: si fallan, el
  // router de Next hace una navegación completa y la atiende `navigation`.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return

  if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})

async function precache() {
  const pages = await caches.open(PAGES_CACHE)
  const assets = new Set(PUBLIC_ASSETS)

  // Uno por uno y sin cortar ante un error: una pantalla que falla no tiene
  // por qué dejar a las demás sin instalar.
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { cache: "reload" })
        if (!isCacheable(response)) return
        await pages.put(route, response.clone())
        const html = await response.text()
        for (const match of html.match(STATIC_URL) ?? []) assets.add(match)
      } catch {
        // sin red durante la instalación: se completa con el uso
      }
    })
  )

  const statics = await caches.open(STATIC_CACHE)
  await Promise.all(
    [...assets].map(async (asset) => {
      if (await statics.match(asset)) return
      try {
        const response = await fetch(asset)
        if (isCacheable(response)) await statics.put(asset, response)
      } catch {
        // idem
      }
    })
  )
}

async function navigation(event, url) {
  const cache = await caches.open(PAGES_CACHE)
  // La query no cambia el HTML (todo se arma en el cliente): una sola copia por ruta
  const key = url.pathname
  const cached = await cache.match(key)

  const network = fetch(event.request).then(async (response) => {
    if (isCacheable(response)) {
      const copy = response.clone()
      await cache.put(key, copy)
    }
    return response
  })
  // Si ganó el timeout, el fallo posterior de la red no le importa a nadie
  network.catch(() => {})
  event.waitUntil(network.catch(() => {}))

  try {
    if (!cached) return await network
    return await Promise.race([network, timeout(NAVIGATION_TIMEOUT_MS).then(() => cached)])
  } catch {
    // Una ruta que nunca se guardó (un link viejo, por ejemplo) cae en el inicio
    // antes que en la pantalla de error del navegador.
    return cached ?? (await cache.match("/")) ?? offlineResponse()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (isCacheable(response)) {
    await cache.put(request, response.clone())
    void trim(cache)
  }
  return response
}

async function staleWhileRevalidate(event) {
  const { request } = event
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) await cache.put(request, response.clone())
      return response
    })
    .catch(() => cached ?? Response.error())
  event.waitUntil(network.then(() => {}))
  return cached ?? network
}

async function trim(cache) {
  const keys = await cache.keys()
  // Cache Storage devuelve las claves en orden de inserción
  for (const key of keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT))) {
    await cache.delete(key)
  }
}

function isCacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>EN MANO</title><body style="font-family:system-ui;background:#f1f3ef;color:#20271e;' +
      'display:grid;place-items:center;min-height:100dvh;margin:0;text-align:center;padding:16px">' +
      "<div><p style=\"font-size:20px;font-weight:700\">Sin conexión</p>" +
      "<p>Abrí EN MANO una vez con internet para poder usarlo offline.</p></div>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}
