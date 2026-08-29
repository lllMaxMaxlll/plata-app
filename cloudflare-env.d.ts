/**
 * Tipado mínimo de los bindings de Workers que usa la app.
 *
 * A propósito NO usamos `wrangler types` (el script `cf-typegen`): además del
 * binding, ese comando escribe los tipos completos del runtime de workerd, que
 * pisan los del DOM — entre otras cosas `Response.json()` pasa a devolver
 * `unknown` — y rompen la compilación de una veintena de archivos que hoy
 * compilan bien. Acá declaramos sólo la superficie que consumimos.
 */

/** Subconjunto del binding AI que realmente invocamos. */
interface WorkersAiTextGenerationInput {
  messages: { role: "system" | "user" | "assistant"; content: string }[]
  max_tokens?: number
  temperature?: number
}

interface WorkersAiTextGenerationOutput {
  response?: string
}

/** Entrada del modelo de embeddings (bge-m3). */
interface WorkersAiEmbeddingInput {
  text: string[]
}

interface WorkersAiEmbeddingOutput {
  /** Un vector por cada texto de entrada, en el mismo orden. */
  data?: number[][]
}

interface WorkersAiBinding {
  run(
    model: string,
    input: WorkersAiTextGenerationInput
  ): Promise<WorkersAiTextGenerationOutput>
  run(model: string, input: WorkersAiEmbeddingInput): Promise<WorkersAiEmbeddingOutput>
}

/** Subconjunto de Vectorize que usa la búsqueda semántica. */
interface VectorizeVector {
  id: string
  values: number[]
  metadata?: Record<string, string | number | boolean>
}

interface VectorizeMatch {
  id: string
  score: number
  metadata?: Record<string, string | number | boolean>
}

interface VectorizeBinding {
  upsert(vectors: VectorizeVector[]): Promise<{ mutationId?: string }>
  query(
    vector: number[],
    options?: {
      topK?: number
      filter?: Record<string, unknown>
      /** La API v2 usa este enum de strings; el booleano viejo la hace fallar. */
      returnMetadata?: "none" | "indexed" | "all"
      returnValues?: boolean
    }
  ): Promise<{ matches: VectorizeMatch[] }>
  deleteByIds(ids: string[]): Promise<{ mutationId?: string }>
}

declare global {
  interface CloudflareEnv {
    /** Opcional: sin el binding, la categorización cae a las reglas locales. */
    AI?: WorkersAiBinding
    /** Opcional: sin el binding, la búsqueda semántica se desactiva sola. */
    TRANSACTIONS_INDEX?: VectorizeBinding
  }
}

export {}
