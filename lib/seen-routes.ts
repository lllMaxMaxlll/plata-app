"use client"

import { useEffect, useState } from "react"

// Pantallas que el usuario ya abrió, para apagar los badges "Nuevo". Es una
// comodidad por dispositivo: si el storage no está disponible, el badge queda.
const key = (href: string) => `plata:seen:${href}`

export function markRouteSeen(href: string) {
  try {
    localStorage.setItem(key(href), "1")
  } catch {}
}

/** true si la pantalla ya se abrió en este dispositivo. Arranca en true para no parpadear el badge. */
export function useRouteSeen(href: string): boolean {
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(key(href)) === "1")
    } catch {}
  }, [href])

  return seen
}
