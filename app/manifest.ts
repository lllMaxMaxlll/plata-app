import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PLATA — Finanzas Personales",
    short_name: "PLATA",
    description: "Finanzas personales en pesos y dólares, en un solo lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#17191f",
    theme_color: "#e87524",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
