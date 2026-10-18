/**
 * Lo que la barra Anotar resuelve antes de llegar al parser de gastos.
 *
 * La barra es una sola para dos cosas: anotar un gasto ("30 lucas super
 * galicia") y preguntarle al historial ("cuánto gasté en el auto"). Elegir el
 * modo a mano sería un toque más cada vez, así que se decide por la forma del
 * texto. El criterio es conservador a propósito: sólo es pregunta si arranca
 * con una palabra interrogativa o lleva signos de pregunta. Un gasto mal leído
 * como pregunta no guarda nada; al revés, guardaría basura.
 *
 * El parser de `expense-message.ts` es compartido con el bot de Telegram y no
 * entiende fechas, porque el bot registra lo que pasa en el momento. En la app
 * sí se anota lo de ayer, así que el día se saca acá y el resto del texto sigue
 * el camino de siempre.
 */

import { normalizeText } from "./categorize.ts"

const QUESTION_START = /^(cuant[oa]s?|cuando|que|donde|en que|cual(es)?|mostrame|busca(r)?)\b/

export function isQuestion(text: string): boolean {
  const raw = text.trim()
  if (!raw) return false
  if (raw.startsWith("¿") || raw.endsWith("?")) return true
  return QUESTION_START.test(normalizeText(raw))
}

/** Palabras de día que entiende la barra, en días hacia atrás. */
const RELATIVE_DAYS: [phrase: string, daysAgo: number][] = [
  ["antes de ayer", 2],
  ["anteayer", 2],
  ["antier", 2],
  ["ayer", 1],
  ["hoy", 0],
]

export interface DayExtraction {
  /** El texto sin la palabra de día, listo para `parseExpenseMessage`. */
  text: string
  /** Días hacia atrás; 0 cuando no se mencionó ninguno. */
  daysAgo: number
  /** Si el texto traía una palabra de día explícita. */
  explicit: boolean
}

/**
 * Saca "hoy", "ayer" o "anteayer" del texto. Sólo la primera mención: "ayer
 * fui al super de hoy" no es un caso real y no vale la pena desambiguarlo.
 */
export function extractRelativeDay(text: string): DayExtraction {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const normalized = words.map(normalizeText)

  for (const [phrase, daysAgo] of RELATIVE_DAYS) {
    const target = phrase.split(" ")
    for (let i = 0; i + target.length <= normalized.length; i++) {
      if (target.every((w, j) => normalized[i + j] === w)) {
        const rest = [...words.slice(0, i), ...words.slice(i + target.length)]
        return { text: rest.join(" "), daysAgo, explicit: true }
      }
    }
  }

  return { text: words.join(" "), daysAgo: 0, explicit: false }
}

/** Palabras que dicen "esto fue en dólares". El peso es lo que se asume. */
const USD_WORDS = new Set(["usd", "u$s", "us$", "u$d", "dolar", "dolares", "verdes"])

export interface CurrencyExtraction {
  /** El texto sin la palabra de moneda. */
  text: string
  /** La moneda mencionada; `null` si el texto no dijo ninguna. */
  currency: "USD" | null
}

/**
 * Saca "usd" o "dólares" del texto. No decide la moneda del movimiento, que la
 * pone la cuenta: sólo dice qué cuenta por defecto ofrecer cuando el texto no
 * nombró ninguna. Por eso se saca siempre, así no termina en la nota.
 */
export function extractCurrency(text: string): CurrencyExtraction {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const index = words.findIndex((w) => USD_WORDS.has(normalizeText(w)))
  if (index === -1) return { text: words.join(" "), currency: null }
  return { text: [...words.slice(0, index), ...words.slice(index + 1)].join(" "), currency: "USD" }
}

/**
 * La fecha a guardar. Para hoy es el momento exacto, como el formulario; para
 * días anteriores es el mediodía de ese día, así ningún huso horario lo corre
 * al día de al lado.
 */
export function dateForDaysAgo(daysAgo: number, now: Date = new Date()): Date {
  if (daysAgo === 0) return new Date(now)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0)
}
