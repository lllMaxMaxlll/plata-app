"use client"

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging"
import { app } from "@/lib/firebase"

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

    // Register Service Worker if needed
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    }

    const messaging = getMessaging(app)
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
    }).catch((err) => {
      console.warn("FCM getToken error (VAPID key might be missing in dev):", err)
      return null
    })

    if (currentToken) {
      if (onTokenReceived) {
        await onTokenReceived(currentToken)
      }
      return { success: true, token: currentToken }
    } else {
      return {
        success: true,
        error: "Permiso concedido, pero token FCM no generado (configure NEXT_PUBLIC_FIREBASE_VAPID_KEY).",
      }
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
