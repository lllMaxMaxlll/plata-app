import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

// Sólo en `next dev`: sin esto getCloudflareContext() no ve los bindings de
// wrangler.jsonc y el binding AI existiría únicamente en el build de Workers.
// En `next build` no va — abre un proxy remoto contra Cloudflare (Workers AI no
// tiene emulación local) y hace fallar el build si no hay credenciales.
//
// Que falle acá tampoco es fatal: sin binding, /api/categorize se queda con las
// reglas locales. Para probar el modelo en local hace falta `wrangler login` o
// un CLOUDFLARE_API_TOKEN en el entorno.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev().catch((error) => {
    console.warn("[opennext] bindings de Cloudflare no disponibles en dev:", error?.message ?? error)
  })
}
