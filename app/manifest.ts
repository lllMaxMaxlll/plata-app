import type { MetadataRoute } from "next"
import { THEME_COLORS } from "@/lib/theme"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EN MANO — Tu plata, en claro",
    short_name: "EN MANO",
    description: "Finanzas personales en pesos y dólares, en un solo lugar.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    // Android pide 192 y 512 para ofrecer la instalación. El maskable tiene el
    // fondo lleno y la moneda dentro de la zona segura: el launcher lo recorta
    // con su propia forma (círculo, squircle) y el ícono con esquinas
    // transparentes quedaría con un borde blanco alrededor.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  }
}
