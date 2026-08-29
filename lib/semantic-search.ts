/**
 * Búsqueda semántica del historial de movimientos.
 *
 * La idea: "cuánto gasté en el auto el verano pasado" se resuelve en dos
 * mitades independientes, y ninguna de las dos genera texto.
 *
 *  - El QUÉ ("en el auto") sale de la similitud entre el embedding de la
 *    consulta y el de cada movimiento, guardados en Vectorize.
 *  - El CUÁNDO ("el verano pasado") lo resuelve `parseDateRange`, que es
 *    determinístico. Las fechas no se le preguntan a un modelo: un rango mal
 *    inferido cambia el total y no hay forma de que el usuario lo note.
 *
 * El resultado es siempre una lista de movimientos reales con su suma real,
 * calculada sobre los datos que ya tiene el cliente. El modelo sólo ordena por
 * relevancia; nunca escribe la respuesta.
 */

import type { Transaction } from "@/lib/finance-data"
import { normalizeText } from "@/lib/categorize"

/** bge-m3 devuelve vectores de 1024 dimensiones. El índice se crea con esto. */
export const EMBEDDING_DIMENSIONS = 1024

export const EMBEDDING_MODEL = "@cf/baai/bge-m3"

/** Tope de vectores por request de embedding e upsert. */
export const BATCH_SIZE = 50

export interface SearchMatch {
  id: string
  score: number
}

export interface DateRange {
  /** ISO date inclusive. */
  from: string
  /** ISO date inclusive. */
  to: string
  /** Cómo describirle al usuario el filtro que aplicamos. */
  label: string
}

// ---------------------------------------------------------------------------
// Texto que se embebe
// ---------------------------------------------------------------------------

/**
 * Representación textual de un movimiento para el embedding.
 *
 * Incluye categoría y cuenta además de la nota porque la consulta del usuario
 * casi nunca repite las palabras exactas de la nota: "gastos del auto" tiene
 * que poder pegar con una nota que dice sólo "YPF" si su categoría es
 * Transporte. El monto y la fecha quedan afuera a propósito — para eso están
 * el filtro de fechas y la suma real, que no dependen de similitud.
 */
export function buildEmbeddingText(
  transaction: Pick<Transaction, "type" | "category" | "note">,
  accountName?: string,
  vehicleName?: string
): string {
  const kind =
    transaction.type === "income"
      ? "Ingreso"
      : transaction.type === "expense"
        ? "Gasto"
        : "Transferencia"

  return [
    kind,
    transaction.category,
    transaction.note,
    accountName,
    vehicleName,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ")
}

/**
 * Huella del contenido embebido, para saber qué hay que reindexar.
 *
 * No necesita ser criptográfica: sólo tiene que cambiar cuando cambia el texto.
 * Es un djb2 de toda la vida, que corre igual en el navegador y en el Worker
 * sin depender de `crypto.subtle` (que es async y acá no hace falta).
 */
export function contentHash(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

// ---------------------------------------------------------------------------
// Rangos de fecha en castellano
// ---------------------------------------------------------------------------

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/** `septiembre` también se escribe `setiembre` en Argentina. */
const MONTH_ALIASES: Record<string, number> = { setiembre: 8 }

/**
 * Estaciones del hemisferio sur. Escribir esto al revés es el bug clásico de
 * copiar una librería pensada para el norte: acá "verano" es diciembre.
 * Se guardan como [mes, día] de inicio; cada estación dura hasta el día
 * anterior al inicio de la siguiente.
 */
const SEASONS: Record<string, { start: [number, number]; end: [number, number] }> = {
  verano: { start: [11, 21], end: [2, 20] }, // 21-dic → 20-mar (cruza el año)
  otono: { start: [2, 21], end: [5, 20] },  // 21-mar → 20-jun
  invierno: { start: [5, 21], end: [8, 20] }, // 21-jun → 20-sep
  primavera: { start: [8, 21], end: [11, 20] }, // 21-sep → 20-dic
}

function isoDate(date: Date) {
  // No usamos toISOString(): es UTC, y de noche en Argentina (UTC-3) devuelve
  // el día siguiente. Los rangos se arman con fechas locales.
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function range(from: Date, to: Date, label: string): DateRange {
  return { from: isoDate(from), to: isoDate(to), label }
}

/**
 * Extrae un rango de fechas de la consulta en lenguaje natural.
 *
 * Devuelve `null` cuando no hay ninguna referencia temporal, que es el caso más
 * común: entonces se busca sobre todo el historial. Deliberadamente conservador
 * — ante la duda, no filtra. Filtrar de menos muestra resultados de más, que el
 * usuario ve y descarta; filtrar de más esconde movimientos sin avisar.
 */
export function parseDateRange(query: string, now: Date = new Date()): DateRange | null {
  // normalizeText descompone y limpia diacríticos, así que acá "año" ya es
  // "ano" y "otoño" es "otono". Los patrones se escriben en esa forma.
  const text = normalizeText(query)
  const year = now.getFullYear()

  // --- Relativos simples ---
  if (/\b(hoy)\b/.test(text)) {
    return range(now, now, "hoy")
  }
  if (/\b(ayer)\b/.test(text)) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return range(yesterday, yesterday, "ayer")
  }
  if (/\beste mes\b/.test(text)) {
    return range(
      new Date(year, now.getMonth(), 1),
      new Date(year, now.getMonth() + 1, 0),
      "este mes"
    )
  }
  if (/\b(el )?mes pasado\b/.test(text)) {
    return range(
      new Date(year, now.getMonth() - 1, 1),
      new Date(year, now.getMonth(), 0),
      "el mes pasado"
    )
  }
  if (/\beste ano\b/.test(text)) {
    return range(new Date(year, 0, 1), new Date(year, 11, 31), "este año")
  }
  if (/\b(el )?ano pasado\b/.test(text)) {
    return range(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31), "el año pasado")
  }
  if (/\b(esta semana|la semana pasada|ultima semana)\b/.test(text)) {
    const days = /esta semana/.test(text) ? 7 : 14
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    return range(from, now, /esta semana/.test(text) ? "esta semana" : "la última semana")
  }

  // --- "últimos N meses" / "últimos N días" ---
  const lastN = text.match(/ultim[oa]s?\s+(\d{1,2})\s+(meses|mes|semanas?|dias?)/)
  if (lastN) {
    const amount = Number(lastN[1])
    const unit = lastN[2]
    const from = new Date(now)
    if (unit.startsWith("mes")) from.setMonth(from.getMonth() - amount)
    else if (unit.startsWith("semana")) from.setDate(from.getDate() - amount * 7)
    else from.setDate(from.getDate() - amount)
    return range(from, now, `los últimos ${amount} ${unit}`)
  }

  // --- Estaciones ---
  for (const [name, season] of Object.entries(SEASONS)) {
    if (!new RegExp(`\\b${name}\\b`).test(text)) continue

    const isPast = /\b(pasad[oa]|ultim[oa])\b/.test(text)
    const [startMonth, startDay] = season.start
    const [endMonth, endDay] = season.end
    // El verano cruza el fin de año: empieza en diciembre y termina en marzo.
    const crossesYear = endMonth < startMonth

    // Instancia en curso, o la más reciente si la estación ya terminó.
    let startYear = year
    const currentMonth = now.getMonth()
    if (crossesYear ? currentMonth < startMonth && currentMonth > endMonth : currentMonth < startMonth) {
      startYear -= 1
    }

    const buildDates = (base: number) => ({
      from: new Date(base, startMonth, startDay),
      to: new Date(base + (crossesYear ? 1 : 0), endMonth, endDay),
    })

    // "El verano pasado" dicho en agosto ya apunta al verano que terminó en
    // marzo: sólo hay que retroceder otro año si la estación sigue en curso.
    let dates = buildDates(startYear)
    if (isPast && now <= dates.to) {
      startYear -= 1
      dates = buildDates(startYear)
    }

    const label = `${name === "otono" ? "otoño" : name} de ${dates.from.getFullYear()}`
    return range(dates.from, dates.to, label)
  }

  // --- Año explícito: "en 2024", "gastos 2025" ---
  const explicitYear = text.match(/\b(20\d{2})\b/)
  if (explicitYear) {
    const target = Number(explicitYear[1])
    return range(new Date(target, 0, 1), new Date(target, 11, 31), String(target))
  }

  // --- Mes por nombre: "en marzo", "marzo 2024" ---
  for (let i = 0; i < MONTHS.length; i++) {
    if (!new RegExp(`\\b${MONTHS[i]}\\b`).test(text)) continue
    return monthRange(i, text, now)
  }
  for (const [alias, index] of Object.entries(MONTH_ALIASES)) {
    if (!new RegExp(`\\b${alias}\\b`).test(text)) continue
    return monthRange(index, text, now)
  }

  return null
}

/** Un mes por nombre: el del año indicado, o el más reciente ya transcurrido. */
function monthRange(monthIndex: number, text: string, now: Date): DateRange {
  const explicitYear = text.match(/\b(20\d{2})\b/)
  // Sin año, "en marzo" significa el marzo más reciente, no el del año que viene.
  const targetYear = explicitYear
    ? Number(explicitYear[1])
    : monthIndex > now.getMonth()
      ? now.getFullYear() - 1
      : now.getFullYear()

  return range(
    new Date(targetYear, monthIndex, 1),
    new Date(targetYear, monthIndex + 1, 0),
    `${MONTHS[monthIndex]} ${targetYear}`
  )
}

/** Filtra por el rango devuelto por `parseDateRange`. Inclusivo en ambos extremos. */
export function withinRange(transaction: Pick<Transaction, "date">, dateRange: DateRange | null) {
  if (!dateRange) return true
  const day = transaction.date.slice(0, 10)
  return day >= dateRange.from && day <= dateRange.to
}
