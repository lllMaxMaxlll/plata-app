"use client"

import { readUserScoped, writeUserScoped } from "@/lib/user-storage"

/**
 * Última copia de cada tabla, para abrir la app sin conexión.
 *
 * Al arrancar se muestra lo guardado y enseguida se relee Supabase; sin red, lo
 * guardado es todo lo que hay. Va en las claves por usuario de user-storage, así
 * que el logout lo borra junto con lo demás.
 */

const SNAPSHOT_PREFIX = "snapshot:"

export function readSnapshot<T>(key: string, uid: string | undefined): T | undefined {
  const raw = readUserScoped(SNAPSHOT_PREFIX + key, uid)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function writeSnapshot(key: string, uid: string | undefined, value: unknown) {
  writeUserScoped(SNAPSHOT_PREFIX + key, uid, JSON.stringify(value))
}

// El usuario de la última sesión, sin uid en la clave: hace falta justamente
// para saber quién es cuando Supabase no contesta. Lleva el prefijo de la app,
// así que también se va con el logout.
const LAST_USER_KEY = "plata_last_user"

export function readLastUser<T>(): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeLastUser(user: unknown) {
  if (typeof window === "undefined") return
  try {
    if (user) window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // cuota o modo privado: sin esto sólo se pierde el arranque offline
  }
}
