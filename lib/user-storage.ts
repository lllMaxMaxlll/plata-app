"use client"

/**
 * localStorage helpers for data that belongs to one signed-in user.
 *
 * Keys are namespaced with the uid so a second account on the same device never
 * reads the previous one's data, and everything under the PLATA prefix is wiped
 * on logout — el estado del índice de búsqueda revela qué movimientos existen,
 * y no tiene por qué sobrevivir a un cambio de cuenta.
 */

const PREFIX = "plata_"

export function userScopedKey(key: string, uid: string | undefined): string | null {
  if (!uid) return null
  return `${PREFIX}${key}:${uid}`
}

export function readUserScoped(key: string, uid: string | undefined): string | null {
  const scoped = userScopedKey(key, uid)
  if (!scoped || typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(scoped)
  } catch {
    return null
  }
}

export function writeUserScoped(key: string, uid: string | undefined, value: string | null) {
  const scoped = userScopedKey(key, uid)
  if (!scoped || typeof window === "undefined") return
  try {
    if (value === null) {
      window.localStorage.removeItem(scoped)
    } else {
      window.localStorage.setItem(scoped, value)
    }
  } catch {
    // Quota or private mode: persistence is a convenience, never a requirement
  }
}

/** Drops every PLATA-owned key, including the pre-namespacing ones. */
export function clearUserScopedStorage() {
  if (typeof window === "undefined") return
  try {
    const doomed: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PREFIX)) doomed.push(key)
    }
    doomed.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // ignore
  }
}
