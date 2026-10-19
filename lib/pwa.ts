"use client"

import { useSyncExternalStore } from "react"

/**
 * Lo que hace falta del lado de la página para que Lucas sea una PWA: registrar
 * el service worker (public/sw.js), saber si hay red y ofrecer la instalación.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Chrome dispara beforeinstallprompt una sola vez y temprano, mucho antes de que
// alguien abra Yo: se guarda acá para que el botón lo encuentre cuando monte.
let installPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()

function setInstallPrompt(next: BeforeInstallPromptEvent | null) {
  installPrompt = next
  installListeners.forEach((listener) => listener())
}

let started = false

export function startPwa() {
  if (started || typeof window === "undefined") return
  started = true

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    setInstallPrompt(event as BeforeInstallPromptEvent)
  })
  window.addEventListener("appinstalled", () => setInstallPrompt(null))

  // En dev el service worker serviría chunks viejos por encima del HMR
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
    console.warn("No se pudo registrar el service worker:", error)
  })
}

export function useInstallPrompt() {
  const prompt = useSyncExternalStore(
    (listener) => {
      installListeners.add(listener)
      return () => installListeners.delete(listener)
    },
    () => installPrompt,
    () => null
  )

  if (!prompt) return null
  return async () => {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    // El evento no se puede reusar: aceptado o no, hay que esperar otro
    setInstallPrompt(null)
    return outcome
  }
}

export type InstallContext = "installed" | "ios" | "other"

/** Ya instalada, Safari de iOS (que no tiene botón de instalar) o cualquier otro. */
export function getInstallContext(): InstallContext {
  if (typeof window === "undefined") return "other"
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return "installed"
  // iPadOS se presenta como Mac: se lo distingue por la pantalla táctil
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios ? "ios" : "other"
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener)
  window.addEventListener("offline", listener)
  return () => {
    window.removeEventListener("online", listener)
    window.removeEventListener("offline", listener)
  }
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
}
