/**
 * Parseo de un gasto escrito en una sola línea, como el que llega por Telegram.
 *
 * El objetivo es que escribir un gasto desde el teléfono cueste menos que abrir
 * la app: "30 lucas super carrefour galicia" tiene que alcanzar. Por eso el
 * parser es tolerante con el orden — el monto y la cuenta se buscan en
 * cualquier posición — y lo que sobra queda como nota, que es lo que después
 * alimenta la categorización de `categorize.ts`.
 *
 * Dos decisiones que valen la pena:
 *
 *  1. **Nunca adivina la cuenta.** Si la mención encaja con más de una cuenta,
 *     devuelve las candidatas en vez de elegir. Un gasto imputado mal en
 *     silencio es peor que un mensaje de más pidiendo que aclares, y el
 *     webhook resuelve el caso con botones.
 *  2. **No decide la moneda.** `create_transaction` la saca de la cuenta de
 *     origen, así que dejar que el texto la pise sólo abriría la puerta a
 *     guardar un movimiento en una moneda que la cuenta no tiene.
 *
 * Es deliberado que sólo entienda gastos: el bot registra lo que gastás, y no
 * tiene que poder mover plata ni corregir el historial.
 */

import type { Account } from "@/lib/finance-data"
import { normalizeText, MAX_NOTE_LENGTH } from "./categorize.ts"

/** Un gasto listo para mandar a `create_transaction`. */
export interface ExpenseDraft {
  amount: number
  account: Account
  /** Lo que quedó del mensaje; puede ser vacío. */
  note: string
}

export type ParseResult =
  | ({ status: "ok" } & ExpenseDraft)
  /** El mensaje no tiene texto útil. */
  | { status: "empty" }
  /** Hay texto pero ningún token que se lea como monto. */
  | { status: "no-amount" }
  /** Se reconoció un número pero no es un monto válido (cero, negativo, absurdo). */
  | { status: "invalid-amount"; raw: string }
  /** Monto claro, pero ninguna cuenta mencionada: hay que ofrecerlas todas. */
  | { status: "no-account"; amount: number; note: string }
  /** La mención encaja con varias cuentas: que elija. */
  | { status: "ambiguous-account"; amount: number; note: string; candidates: Account[] }

/**
 * Tope de cordura, atado a la columna: `transactions.amount` es
 * `numeric(14, 2)`, así que doce dígitos enteros es todo lo que entra. Pasarse
 * no sería un gasto raro, sería un error de Postgres, y el dedo que repite un
 * cero de más existe.
 */
export const MAX_AMOUNT = 999_999_999_999.99

/**
 * Multiplicadores del habla corriente. "Luca" y "palo" son moneda diaria acá,
 * y sin esto "30 lucas" se registraría como treinta pesos.
 *
 * `m` suelta queda afuera a propósito: aparece como unidad en notas de auto
 * ("120 m") mucho más seguido que como millón.
 */
const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  mil: 1_000,
  luca: 1_000,
  lucas: 1_000,
  palo: 1_000_000,
  palos: 1_000_000,
  millon: 1_000_000,
  millones: 1_000_000,
}

/** Sinónimos de los `kind` de cuenta, para poder decir "efectivo" y que entienda. */
const KIND_ALIASES: Record<string, Account["kind"]> = {
  efectivo: "cash",
  cash: "cash",
  contado: "cash",
  banco: "bank",
  bank: "bank",
  billetera: "wallet",
  wallet: "wallet",
  ahorro: "savings",
  ahorros: "savings",
  cripto: "crypto",
  crypto: "crypto",
}

/**
 * Convierte la parte numérica de un token a número, con las convenciones de
 * acá: el punto separa miles y la coma decimales.
 *
 * El caso ambiguo es la coma seguida de exactamente tres dígitos ("1,500"):
 * nadie escribe "1,500" para decir uno con medio, así que la leemos como
 * separador de miles a la americana. Con una o dos cifras después ("3,50") es
 * decimal, que es como se escribe en castellano.
 */
function toNumber(raw: string): number | null {
  // Sin separadores colgando en las puntas: ".500" y "3." no son montos.
  if (!/^\d(?:[\d.,]*\d)?$/.test(raw)) return null

  const commas = (raw.match(/,/g) || []).length
  if (commas > 1) return null

  let integer: string
  let decimals = ""

  if (commas === 1) {
    const [before, after] = raw.split(",")
    if (after.length === 3 && !before.includes(".")) {
      integer = before + after
    } else if (after.length >= 1 && after.length <= 2) {
      if (!hasValidGrouping(before)) return null
      integer = before.replace(/\./g, "")
      decimals = after
    } else {
      return null
    }
  } else {
    const lastDot = raw.lastIndexOf(".")
    const tail = lastDot === -1 ? "" : raw.slice(lastDot + 1)
    // Un punto final con una o dos cifras es decimal; con tres es separador de
    // miles, que es el uso habitual en castellano ("3.500").
    if (lastDot !== -1 && tail.length <= 2) {
      const head = raw.slice(0, lastDot)
      if (!hasValidGrouping(head)) return null
      integer = head.replace(/\./g, "")
      decimals = tail
    } else {
      if (!hasValidGrouping(raw)) return null
      integer = raw.replace(/\./g, "")
    }
  }

  const value = Number(decimals ? `${integer}.${decimals}` : integer)
  return Number.isFinite(value) ? value : null
}

/** Los puntos, si están, tienen que separar grupos de tres: "1.234.567". */
function hasValidGrouping(value: string): boolean {
  if (!value.includes(".")) return true
  const groups = value.split(".")
  if (groups[0].length < 1 || groups[0].length > 3) return false
  return groups.slice(1).every((g) => g.length === 3)
}

interface AmountMatch {
  value: number
  /** Cuántos tokens consumió: 1 para "30k", 2 para "30 lucas". */
  length: number
  raw: string
}

/**
 * Lee un monto a partir del token `index`, mirando el siguiente por si el
 * multiplicador vino suelto.
 *
 * Devuelve `null` cuando el token no pretende ser un monto, y un match con
 * `value` en NaN cuando sí lo pretende pero no da — así el llamador distingue
 * "no hay monto" de "el monto está mal", que merecen mensajes distintos.
 */
function readAmountAt(tokens: string[], index: number): AmountMatch | null {
  const token = tokens[index]
  // El token entero tiene que ser el monto: así "24hs" o "ruta 22" no se cuelan.
  const match = /^\$?([\d.,]*\d[\d.,]*)([a-z]*)$/.exec(token)
  if (!match) return null

  const [, digits, suffix] = match
  if (suffix && !Object.hasOwn(MULTIPLIERS, suffix)) return null

  let length = 1
  let multiplier = suffix ? MULTIPLIERS[suffix] : 1

  if (!suffix) {
    const next = tokens[index + 1]
    if (next && Object.hasOwn(MULTIPLIERS, next)) {
      multiplier = MULTIPLIERS[next]
      length = 2
    }
  }

  const raw = tokens.slice(index, index + length).join(" ")
  const base = toNumber(digits)
  if (base === null) return { value: NaN, length, raw }

  // Redondeamos a centavos: 1,5 palos no tiene por qué arrastrar el error de
  // coma flotante de 1.5 * 1e6.
  const value = Math.round(base * multiplier * 100) / 100
  return { value, length, raw }
}

/** Prioridad de una coincidencia de cuenta: menor es mejor. */
const EXACT = 0
const PARTIAL = 1
const BY_KIND = 2

interface AccountMatch {
  candidates: Account[]
  start: number
  length: number
}

/**
 * Busca la cuenta entre los tokens que no se llevó el monto.
 *
 * Recorre por niveles y no por posición: un nombre completo le gana a una
 * palabra suelta, y una palabra del nombre le gana a un sinónimo de tipo. Sin
 * eso, tener una cuenta llamada "Efectivo" haría que "banco galicia" empatara
 * con ella por el alias de `kind`.
 */
function matchAccount(
  tokens: string[],
  used: boolean[],
  accounts: Account[]
): AccountMatch | null {
  const names = accounts.map((a) => normalizeText(a.name))
  let best: (AccountMatch & { tier: number }) | null = null

  for (let length = tokens.length; length >= 1; length--) {
    for (let start = 0; start + length <= tokens.length; start++) {
      if (used.slice(start, start + length).some(Boolean)) continue
      const phrase = tokens.slice(start, start + length).join(" ")

      const exact = accounts.filter((_, i) => names[i] === phrase)
      const partial = accounts.filter((_, i) => containsWords(names[i], phrase))
      const kind = Object.hasOwn(KIND_ALIASES, phrase) ? KIND_ALIASES[phrase] : undefined
      const byKind = kind ? accounts.filter((a) => a.kind === kind) : []

      const tier = exact.length ? EXACT : partial.length ? PARTIAL : byKind.length ? BY_KIND : -1
      if (tier === -1) continue

      const candidates = tier === EXACT ? exact : tier === PARTIAL ? partial : byKind
      // Dentro del mismo nivel gana la frase más larga, y a igual largo la
      // primera: el bucle ya viene de mayor a menor, así que sólo mejoramos
      // cuando el nivel es estrictamente mejor.
      if (!best || tier < best.tier) best = { candidates, start, length, tier }
    }
  }

  return best
}

/** ¿`phrase` aparece en `name` como palabra completa? "gal" no matchea "galicia". */
function containsWords(name: string, phrase: string): boolean {
  const words = name.split(" ")
  const target = phrase.split(" ")
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((w, j) => words[i + j] === w)) return true
  }
  return false
}

/**
 * Lee un mensaje de gasto contra las cuentas del usuario.
 *
 * No escribe nada ni consulta nada: es una función pura, y por eso el webhook
 * puede confirmarle al usuario qué entendió antes de tocar la base.
 */
export function parseExpenseMessage(text: string, accounts: Account[]): ParseResult {
  const tokens = normalizeText(text).split(" ").filter(Boolean)
  if (tokens.length === 0) return { status: "empty" }

  // Los tokens originales, para que la nota conserve mayúsculas y acentos.
  const original = text.trim().split(/\s+/)

  let amount: AmountMatch | null = null
  let amountAt = -1
  for (let i = 0; i < tokens.length; i++) {
    const found = readAmountAt(tokens, i)
    if (found) {
      amount = found
      amountAt = i
      break
    }
  }

  if (!amount) return { status: "no-amount" }
  if (!Number.isFinite(amount.value) || amount.value <= 0 || amount.value > MAX_AMOUNT) {
    return { status: "invalid-amount", raw: amount.raw }
  }

  const spent = amount
  const used = tokens.map((_, i) => i >= amountAt && i < amountAt + spent.length)

  const account = matchAccount(tokens, used, accounts)
  if (account) {
    for (let i = account.start; i < account.start + account.length; i++) used[i] = true
  }

  const note = original
    .filter((_, i) => !used[i])
    .join(" ")
    .slice(0, MAX_NOTE_LENGTH)
    .trim()

  if (!account) return { status: "no-account", amount: amount.value, note }
  if (account.candidates.length > 1) {
    return { status: "ambiguous-account", amount: amount.value, note, candidates: account.candidates }
  }

  return { status: "ok", amount: amount.value, account: account.candidates[0], note }
}
