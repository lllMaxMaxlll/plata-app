import { getCloudflareContext } from "@opennextjs/cloudflare"
import { EMBEDDING_MODEL } from "@/lib/semantic-search"

/**
 * Acceso a los bindings de Cloudflare desde las rutas de /api.
 *
 * Todo devuelve `null` en vez de tirar: en `next dev` sin credenciales los
 * bindings no existen, y las features que dependen de ellos están diseñadas
 * para desactivarse solas en lugar de romper la pantalla.
 */
export function getBindings(): CloudflareEnv | null {
  try {
    return getCloudflareContext().env
  } catch {
    return null
  }
}

/**
 * Convierte textos en vectores con bge-m3.
 *
 * Devuelve `null` ante cualquier problema — sin binding, con una respuesta de
 * forma inesperada o si la cantidad de vectores no coincide con la de textos.
 * Esa última verificación importa: los vectores se aparean por posición con los
 * movimientos, y un desfasaje silencioso indexaría cada gasto con el embedding
 * de otro.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return []

  const env = getBindings()
  if (!env?.AI) return null

  try {
    const result = await env.AI.run(EMBEDDING_MODEL, { text: texts })
    const vectors = result?.data
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      console.error(
        `[embed] se esperaban ${texts.length} vectores y llegaron ${vectors?.length ?? 0}`
      )
      return null
    }
    return vectors
  } catch (error) {
    console.error("[embed] Workers AI falló:", error)
    return null
  }
}
