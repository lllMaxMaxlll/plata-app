import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { weeklyPace } from "./weekly-pace.ts"
import type { Transaction } from "./finance-data.ts"

// Domingo 18 de octubre de 2026: la semana arrancó el lunes 12.
const now = new Date(2026, 9, 18, 10, 0)

function tx(date: Date, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `${date.toISOString()}-${amount}`,
    type: "expense",
    amount,
    accountId: "a1",
    currency: "ARS",
    category: "Comida",
    date: date.toISOString(),
    ...overrides,
  }
}

const toARS = (t: Transaction) => (t.currency === "USD" ? t.amount * 1450 : t.amount)

describe("weeklyPace", () => {
  test("suma la semana desde el lunes y la compara con el promedio", () => {
    const pace = weeklyPace(
      [
        tx(new Date(2026, 9, 12, 9), 30000), // lunes de esta semana
        tx(new Date(2026, 9, 17, 20), 50000),
        tx(new Date(2026, 9, 11, 22), 40000), // domingo pasado
        tx(new Date(2026, 9, 1, 12), 120000), // dos semanas atrás
        tx(new Date(2026, 8, 22, 12), 80000), // tres semanas atrás: primer gasto
      ],
      { now, toARS }
    )
    assert.equal(pace.spent, 80000)
    // Tres semanas completas con historial: (40.000 + 120.000 + 80.000) / 3.
    assert.equal(pace.average, 80000)
    assert.equal(pace.ratio, 1)
  })

  test("ignora ingresos y transferencias, y convierte dólares", () => {
    const pace = weeklyPace(
      [
        tx(new Date(2026, 9, 13), 10, { currency: "USD" }),
        tx(new Date(2026, 9, 13), 999999, { type: "income" }),
        tx(new Date(2026, 9, 13), 999999, { type: "transfer" }),
      ],
      { now, toARS }
    )
    assert.equal(pace.spent, 14500)
  })

  test("sin semanas anteriores no hay promedio", () => {
    const pace = weeklyPace([tx(new Date(2026, 9, 14), 5000)], { now, toARS })
    assert.equal(pace.average, null)
    assert.equal(pace.ratio, null)
  })

  test("el promedio no mira más atrás que la ventana", () => {
    const pace = weeklyPace(
      [tx(new Date(2025, 0, 10), 1_000_000), tx(new Date(2026, 9, 6), 70000)],
      { now, toARS, weeks: 2 }
    )
    assert.equal(pace.average, 35000)
  })
})
