/**
 * El medidor "Esta semana" de Hoy: cuánto gastaste desde el lunes contra lo
 * que gastás en una semana normal.
 *
 * No hay un tope cargado por el usuario, así que la referencia es su propio
 * promedio de las últimas semanas completas. Sólo cuentan las semanas desde el
 * primer movimiento: un usuario nuevo no tiene que ver su gasto comparado
 * contra ocho semanas en cero.
 */

import { addWeeks, startOfWeek } from "date-fns"
import type { Transaction } from "./finance-data.ts"

export interface WeeklyPace {
  /** Gasto de la semana en curso, en pesos. */
  spent: number
  /** Promedio semanal de las semanas completas anteriores; null sin historial. */
  average: number | null
  /** spent / average; null sin promedio. */
  ratio: number | null
}

const WEEK = { weekStartsOn: 1 } as const

export function weeklyPace(
  transactions: Transaction[],
  {
    now = new Date(),
    weeks = 8,
    toARS,
  }: {
    now?: Date
    weeks?: number
    /** Monto del movimiento en pesos: los gastos en dólares se convierten. */
    toARS: (tx: Transaction) => number
  }
): WeeklyPace {
  const thisWeek = startOfWeek(now, WEEK)
  const windowStart = addWeeks(thisWeek, -weeks)

  const expenses = transactions.filter((tx) => tx.type === "expense")
  let spent = 0
  let previous = 0
  let earliest: Date | null = null

  for (const tx of expenses) {
    const date = new Date(tx.date)
    if (Number.isNaN(date.getTime())) continue
    if (!earliest || date < earliest) earliest = date
    if (date >= thisWeek && date <= now) spent += toARS(tx)
    else if (date >= windowStart && date < thisWeek) previous += toARS(tx)
  }

  // Semanas completas con historial: desde la del primer gasto, sin pasar la ventana.
  const firstWeek = earliest ? startOfWeek(earliest, WEEK) : thisWeek
  const from = firstWeek > windowStart ? firstWeek : windowStart
  const fullWeeks = Math.round((thisWeek.getTime() - from.getTime()) / (7 * 24 * 3600 * 1000))

  const average = fullWeeks > 0 ? previous / fullWeeks : null
  const ratio = average && average > 0 ? spent / average : null
  return { spent, average, ratio }
}
