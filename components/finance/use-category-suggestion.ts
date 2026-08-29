"use client"

import { useEffect, useRef, useState } from "react"
import { getApiAuthHeaders } from "@/lib/supabase/client"
import {
  matchByRules,
  normalizeText,
  MIN_NOTE_LENGTH,
  type CategorySuggestion,
} from "@/lib/categorize"

/** Lo que tarda en aquietarse el tipeo antes de salir a preguntar. */
const DEBOUNCE_MS = 500

/**
 * Sobrevive al cierre del formulario: cargar tres gastos seguidos del mismo
 * comercio tiene que costar una sola llamada. Es memoria del tab, nada más.
 */
const clientCache = new Map<string, string | null>()

/**
 * Sugiere una categoría a partir de la nota del movimiento.
 *
 * Primero prueba las reglas locales, que son sincrónicas y andan sin conexión;
 * sólo si no reconocen nada consulta a Workers AI. Devuelve `null` mientras no
 * haya nada que sugerir — el formulario no depende de esto para funcionar.
 */
export function useCategorySuggestion({
  note,
  type,
  categories,
  enabled,
}: {
  note: string
  type: "income" | "expense" | "transfer"
  categories: string[]
  enabled: boolean
}) {
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null)
  const [loading, setLoading] = useState(false)

  // Las categorías llegan como array nuevo en cada render del provider; sin
  // esto el efecto se re-dispararía en loop.
  const categoriesKey = categories.join(",")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = note.trim()
    const active = enabled && type !== "transfer" && trimmed.length >= MIN_NOTE_LENGTH

    if (!active || categories.length === 0) {
      setSuggestion(null)
      setLoading(false)
      return
    }

    // 1. Reglas locales: sin red, sin espera, sin costo.
    const byRules = matchByRules(trimmed, categories)
    if (byRules) {
      setSuggestion({ category: byRules, source: "rules" })
      setLoading(false)
      return
    }

    const key = `${type}|${categoriesKey}|${normalizeText(trimmed)}`
    if (clientCache.has(key)) {
      const cached = clientCache.get(key) ?? null
      setSuggestion(cached ? { category: cached, source: "model" } : null)
      setLoading(false)
      return
    }

    setSuggestion(null)
    setLoading(true)

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch("/api/categorize", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(await getApiAuthHeaders()) },
          body: JSON.stringify({ note: trimmed, type, categories }),
        })
        if (!response.ok) throw new Error(`categorize: HTTP ${response.status}`)

        const data = (await response.json()) as { category?: string | null }
        const category = typeof data.category === "string" ? data.category : null

        clientCache.set(key, category)
        setSuggestion(category ? { category, source: "model" } : null)
      } catch (error) {
        // Una sugerencia que no llega no es un problema que el usuario tenga
        // que ver: el selector de categorías sigue estando ahí.
        if ((error as Error)?.name !== "AbortError") {
          console.warn("[categorize] no se pudo sugerir categoría:", error)
        }
        setSuggestion(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
    // `categories` se compara por `categoriesKey`, no por identidad de array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, type, categoriesKey, enabled])

  return { suggestion, loading }
}
