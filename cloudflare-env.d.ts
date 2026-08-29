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

interface WorkersAiBinding {
  run(
    model: string,
    input: WorkersAiTextGenerationInput
  ): Promise<WorkersAiTextGenerationOutput>
}

declare global {
  interface CloudflareEnv {
    /** Opcional: sin el binding, la categorización cae a las reglas locales. */
    AI?: WorkersAiBinding
  }
}

export {}
