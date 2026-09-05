import type { Account, Currency, DueItem, Transaction } from "@/lib/finance-data"

export interface SavingsEstimate {
  ARS: number
  USD: number
  /** Meses completos con movimientos que se usaron para el cálculo. */
  monthsUsed: number
}

const EMPTY: SavingsEstimate = { ARS: 0, USD: 0, monthsUsed: 0 }

function monthKey(iso: string): string | null {
  // Leemos el prefijo del texto en vez de construir un Date: "2026-08-01" pelado
  // se parsea como medianoche UTC, y en un huso al oeste de Greenwich —el
  // nuestro— getMonth() lo devolvía como julio.
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (match) return `${match[1]}-${match[2]}`

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Estima cuánto ahorra el usuario por mes a partir de sus movimientos reales.
 *
 * Existe porque el simulador arrancaba con un ahorro inventado (300.000 ARS y
 * 500 USD hardcodeados), que es el número del que más depende toda la
 * proyección. Usa la mediana y no el promedio para que un mes con el aguinaldo
 * o una compra grande no distorsione la estimación.
 *
 * Las transferencias quedan afuera: mueven plata entre cuentas propias, no son
 * ingreso ni gasto. El mes en curso también, porque está incompleto y siempre
 * daría un ahorro más alto de lo real.
 */
export function estimateMonthlySavings(
  transactions: Transaction[],
  accounts: Account[],
  monthsBack = 6,
  now = new Date()
): SavingsEstimate {
  if (transactions.length === 0) return EMPTY

  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency]))
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // mes -> moneda -> neto
  const byMonth = new Map<string, Record<Currency, number>>()

  for (const tx of transactions) {
    if (tx.type === "transfer") continue
    const key = monthKey(tx.date)
    if (!key || key >= currentMonth) continue

    const currency = tx.currency ?? currencyByAccount.get(tx.accountId)
    if (currency !== "ARS" && currency !== "USD") continue

    const amount = Number(tx.amount)
    if (!Number.isFinite(amount)) continue

    if (!byMonth.has(key)) byMonth.set(key, { ARS: 0, USD: 0 })
    const bucket = byMonth.get(key)!
    bucket[currency] += tx.type === "income" ? amount : -amount
  }

  const months = [...byMonth.keys()].sort().slice(-monthsBack)
  if (months.length === 0) return EMPTY

  return {
    ARS: Math.round(median(months.map((m) => byMonth.get(m)!.ARS))),
    USD: Math.round(median(months.map((m) => byMonth.get(m)!.USD))),
    monthsUsed: months.length,
  }
}

/**
 * Deuda ya vencida o que vence hoy, por moneda.
 *
 * Sólo cuenta lo que ya se debe: los vencimientos futuros se pagan con el
 * ahorro mensual, que la simulación ya modela, y restarlos del patrimonio los
 * contaría dos veces.
 */
export function sumOverdueLiabilities(
  dueItems: DueItem[],
  now = new Date()
): Record<Currency, number> {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`

  return dueItems.reduce(
    (acc, item) => {
      if (item.status !== "pending") return acc
      if (!item.dueDate || item.dueDate > today) return acc
      const amount = Number(item.amount)
      if (!Number.isFinite(amount) || amount <= 0) return acc
      acc[item.currency] += amount
      return acc
    },
    { ARS: 0, USD: 0 } as Record<Currency, number>
  )
}
