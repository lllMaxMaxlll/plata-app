import { NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { authorizeApiRequest } from "@/lib/server-api"
import {
  buildPrompt,
  matchByRules,
  normalizeText,
  resolveToAllowed,
  MAX_NOTE_LENGTH,
  MIN_NOTE_LENGTH,
  type SuggestionSource,
} from "@/lib/categorize"

/**
 * Sugiere una categoría para un movimiento a partir de su descripción.
 *
 * Nunca falla hacia el cliente: si el modelo no responde, no está el binding o
 * devuelve algo fuera de la lista, contestamos 200 con `category: null` y el
 * formulario sigue como siempre. Es una ayuda, no un paso obligatorio.
 */

/** Modelo chico y barato: la tarea es clasificar una línea de texto. */
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"

/** El formulario espera esta respuesta mientras el usuario tipea. */
const MODEL_TIMEOUT_MS = 4_000

const MAX_CATEGORIES = 40

/**
 * Caché por isolate, con la misma lógica que el rate limiter de `server-api`:
 * no es una caché compartida, es un amortiguador. Un usuario cargando varios
 * gastos del mismo comercio no paga neurons de más, y un cold start sólo
 * significa volver a preguntar.
 */
const suggestionCache = new Map<string, string | null>()
const MAX_CACHE_ENTRIES = 500

function cacheKey(note: string, type: string, allowed: string[]) {
  return `${type}|${allowed.join(",")}|${normalizeText(note)}`
}

function rememberSuggestion(key: string, value: string | null) {
  // Map itera en orden de inserción: la primera clave es la más vieja.
  if (suggestionCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = suggestionCache.keys().next().value
    if (oldest !== undefined) suggestionCache.delete(oldest)
  }
  suggestionCache.set(key, value)
}

function suggestion(category: string | null, source: SuggestionSource | "cache" | null) {
  return NextResponse.json({ category, source })
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(request, "categorize", 60)
  if (authResult.error) return authResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { note, type, categories } = (body ?? {}) as {
    note?: unknown
    type?: unknown
    categories?: unknown
  }

  if (typeof note !== "string" || note.trim().length < MIN_NOTE_LENGTH) {
    return suggestion(null, null)
  }
  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "type must be 'income' or 'expense'" }, { status: 400 })
  }

  const allowed = Array.isArray(categories)
    ? categories
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim())
        .slice(0, MAX_CATEGORIES)
    : []

  if (allowed.length === 0) {
    return NextResponse.json({ error: "categories must be a non-empty array" }, { status: 400 })
  }

  const trimmedNote = note.trim().slice(0, MAX_NOTE_LENGTH)

  // 1. Reglas locales. Instantáneas y sin costo, así que van primero.
  const byRules = matchByRules(trimmedNote, allowed)
  if (byRules) return suggestion(byRules, "rules")

  const key = cacheKey(trimmedNote, type, allowed)
  if (suggestionCache.has(key)) {
    return suggestion(suggestionCache.get(key) ?? null, "cache")
  }

  // 2. Workers AI para el resto.
  try {
    const { env } = getCloudflareContext()
    if (!env.AI) {
      // Pasa en `next dev` sin wrangler configurado. No es un error del usuario.
      console.warn("[categorize] El binding AI no está disponible; sólo reglas locales.")
      return suggestion(null, null)
    }

    const result = await Promise.race([
      env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content:
              "Sos un clasificador de gastos e ingresos personales en Argentina. " +
              "Respondés siempre con una única categoría de la lista que te dan, sin agregar nada más.",
          },
          { role: "user", content: buildPrompt(trimmedNote, allowed, type) },
        ],
        max_tokens: 16,
        temperature: 0,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), MODEL_TIMEOUT_MS)),
    ])

    // Timeout: no cacheamos, para que el próximo intento vuelva a probar.
    if (!result) return suggestion(null, null)

    const raw = typeof result.response === "string" ? result.response : ""
    const resolved = normalizeText(raw).startsWith("ninguna")
      ? null
      : resolveToAllowed(raw, allowed)

    // Cacheamos también el `null`: si el modelo ya dijo que no encaja nada,
    // repreguntar por el mismo texto va a dar lo mismo.
    rememberSuggestion(key, resolved)
    return suggestion(resolved, resolved ? "model" : null)
  } catch (error) {
    console.error("[categorize] Workers AI falló:", error)
    return suggestion(null, null)
  }
}
