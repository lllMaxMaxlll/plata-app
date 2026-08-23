"use client"

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging"
import { app } from "@/lib/firebase"

/**
 * Builds the service worker URL carrying the public Firebase client config, so the
 * worker can initialize itself without the values being hardcoded into the file.
 */
function buildServiceWorkerUrl(): string | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
    return null
  }

  const params = new URLSearchParams()
  Object.entries(config).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return `/firebase-messaging-sw.js?${params.toString()}`
}

export async function requestNotificationPermission(
  onTokenReceived?: (token: string) => Promise<void>
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return { success: false, error: "Notificaciones no soportadas en este navegador." }
    }

    const supported = await isSupported()
    if (!supported) {
      return { success: false, error: "Firebase Messaging no es soportado en este entorno." }
    }

    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { success: false, error: "Permiso de notificaciones denegado por el usuario." }
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      return {
        success: false,
        error: "Falta configurar NEXT_PUBLIC_FIREBASE_VAPID_KEY. Las notificaciones no pueden activarse.",
      }
    }

    // Register the background Service Worker, handing it the Firebase config
    if (!("serviceWorker" in navigator)) {
      return { success: false, error: "Service Workers no soportados en este navegador." }
    }
    const swUrl = buildServiceWorkerUrl()
    if (!swUrl) {
      return {
        success: false,
        error: "Falta la configuración de Firebase (NEXT_PUBLIC_FIREBASE_*) para registrar las notificaciones.",
      }
    }
    const registration = await navigator.serviceWorker.register(swUrl)
    await navigator.serviceWorker.ready

    const messaging = getMessaging(app)

    let tokenError: unknown = null
    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    }).catch((err) => {
      tokenError = err
      console.error("FCM getToken error:", err)
      return null
    })

    if (currentToken) {
      if (onTokenReceived) {
        await onTokenReceived(currentToken)
      }
      return { success: true, token: currentToken }
    }

    return {
      success: false,
      error:
        (tokenError as any)?.message ||
        "Permiso concedido, pero no se pudo generar el token de notificaciones.",
    }
  } catch (err: any) {
    console.error("Error requesting notification permission:", err)
    return { success: false, error: err?.message || "Error al solicitar notificaciones." }
  }
}

export async function initForegroundNotificationListener(
  onNotification: (payload: any) => void
) {
  if (typeof window === "undefined") return () => {}
  const supported = await isSupported()
  if (!supported) return () => {}

  const messaging = getMessaging(app)
  return onMessage(messaging, (payload) => {
    onNotification(payload)
  })
}
