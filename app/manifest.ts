import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lucas — Tu plata, anotada en criollo",
    short_name: "Lucas",
    description: "Finanzas personales en pesos y dólares, en un solo lugar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3eee3",
    theme_color: "#f3eee3",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
