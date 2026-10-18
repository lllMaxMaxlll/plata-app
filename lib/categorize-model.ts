/**
 * La capa de Workers AI de la categorización. Server-only.
 *
 * Vive separada de `categorize.ts` porque aquél es isomórfico —lo importa
 * `use-category-suggestion` en el browser— y esto necesita el binding AI, que
 * sólo existe del lado del Worker. Meter `getCloudflareContext` allá arrastraría
 * el runtime de Cloudflare al bundle del cliente.
 *
 * Lo consumen la ruta `/api/categorize` (mientras tipeás en el formulario) y el
 * bot de Telegram. Las dos entradas comparten la caché, que es justo lo que
 * querés: cargar "carrefour" por Telegram y después abrir la app no debería
 * pagar dos veces el mismo neuron.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare"
import {
  buildPrompt,
  normalizeText,
  resolveToAllowed,
  MAX_NOTE_LENGTH,
  type SuggestionSource,
} from "@/lib/categorize"

/** Modelo chico y barato: la tarea es clasificar una línea de texto. */
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"

/** El formulario espera esta respuesta mientras el usuario tipea. */
const MODEL_TIMEOUT_MS = 4_000

/**
 * Caché por isolate, con la misma lógica que el rate limiter de `server-api`:
 * no es una caché compartida, es un amortiguador. Un usuario cargando varios
 * gastos del mismo comercio no paga neurons de más, y un cold start sólo
 * significa volver a preguntar.
 */
const suggestionCache = new Map<string, string | null>()
const MAX_CACHE_ENTRIES = 500

export type ModelSource = SuggestionSource | "cache" | null

export interface ModelSuggestion {
  category: string | null
  source: ModelSource
}

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

/**
 * Le pregunta al modelo por una categoría de `allowed`.
 *
 * Nunca tira: sin binding, con timeout o con una respuesta fuera de la lista
 * devuelve `category: null`. Es una ayuda, no un paso obligatorio, y tanto el
 * formulario como el bot tienen que poder seguir sin ella.
 *
 * Asume que ya probaste `matchByRules`: acá se paga neurons.
 */
export async function classifyNote(
  note: string,
  allowed: string[],
  type: "income" | "expense"
): Promise<ModelSuggestion> {
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH)
  if (!trimmed || allowed.length === 0) return { category: null, source: null }

  const key = cacheKey(trimmed, type, allowed)
  if (suggestionCache.has(key)) {
    return { category: suggestionCache.get(key) ?? null, source: "cache" }
  }

  try {
    const { env } = getCloudflareContext()
    if (!env.AI) {
      // Pasa en `next dev` sin wrangler configurado. No es un error del usuario.
      console.warn("[categorize] El binding AI no está disponible; sólo reglas locales.")
      return { category: null, source: null }
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
          { role: "user", content: buildPrompt(trimmed, allowed, type) },
        ],
        max_tokens: 16,
        temperature: 0,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), MODEL_TIMEOUT_MS)),
    ])

    // Timeout: no cacheamos, para que el próximo intento vuelva a probar.
    if (!result) return { category: null, source: null }

    const raw = typeof result.response === "string" ? result.response : ""
    const resolved = normalizeText(raw).startsWith("ninguna")
      ? null
      : resolveToAllowed(raw, allowed)

    // Cacheamos también el `null`: si el modelo ya dijo que no encaja nada,
    // repreguntar por el mismo texto va a dar lo mismo.
    rememberSuggestion(key, resolved)
    return { category: resolved, source: resolved ? "model" : null }
  } catch (error) {
    console.error("[categorize] Workers AI falló:", error)
    return { category: null, source: null }
  }
}
