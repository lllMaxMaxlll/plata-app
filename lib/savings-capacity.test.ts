import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { estimateMonthlySavings, sumOverdueLiabilities } from "./savings-capacity.ts"
import type { Account, DueItem, Transaction } from "./finance-data.ts"

const now = new Date("2026-09-05T12:00:00Z")

const accounts: Account[] = [
  { id: "ars", name: "Banco", currency: "ARS", kind: "bank", balance: 0 },
  { id: "usd", name: "Dólares", currency: "USD", kind: "savings", balance: 0 },
]

const tx = (
  id: string,
  type: Transaction["type"],
  amount: number,
  date: string,
  accountId = "ars",
  currency?: Transaction["currency"]
): Transaction => ({ id, type, amount, accountId, currency, category: "x", date })

describe("estimateMonthlySavings", () => {
  test("sin movimientos devuelve cero", () => {
    assert.deepEqual(estimateMonthlySavings([], accounts, 6, now), { ARS: 0, USD: 0, monthsUsed: 0 })
  })

  test("neto de ingresos menos gastos, por moneda", () => {
    const txs = [
      tx("1", "income", 1_000_000, "2026-07-05"),
      tx("2", "expense", 600_000, "2026-07-20"),
      tx("3", "income", 1_000_000, "2026-08-05"),
      tx("4", "expense", 600_000, "2026-08-20"),
      tx("5", "income", 800, "2026-08-10", "usd", "USD"),
    ]
    const r = estimateMonthlySavings(txs, accounts, 6, now)
    assert.equal(r.ARS, 400_000)
    assert.equal(r.monthsUsed, 2)
  })

  test("ignora el mes en curso, que está incompleto", () => {
    const txs = [
      tx("1", "income", 1_000_000, "2026-07-05"),
      tx("2", "expense", 600_000, "2026-07-20"),
      tx("3", "income", 9_000_000, "2026-09-02"), // mes actual: no cuenta
    ]
    const r = estimateMonthlySavings(txs, accounts, 6, now)
    assert.equal(r.ARS, 400_000)
    assert.equal(r.monthsUsed, 1)
  })

  test("las transferencias no son ahorro", () => {
    const txs = [
      tx("1", "income", 500_000, "2026-08-01"),
      { ...tx("2", "transfer", 400_000, "2026-08-02"), toAccountId: "usd" },
    ]
    assert.equal(estimateMonthlySavings(txs, accounts, 6, now).ARS, 500_000)
  })

  // La mediana y no el promedio: un mes con aguinaldo o una compra grande no
  // debería mover la estimación de todo el plan.
  test("un mes atípico no arrastra la estimación", () => {
    const txs = [
      tx("1", "income", 500_000, "2026-04-01"),
      tx("2", "income", 500_000, "2026-05-01"),
      tx("3", "income", 500_000, "2026-06-01"),
      tx("4", "income", 500_000, "2026-07-01"),
      tx("5", "income", 20_000_000, "2026-08-01"),
    ]
    assert.equal(estimateMonthlySavings(txs, accounts, 6, now).ARS, 500_000)
  })

  test("un mes con más gasto que ingreso da negativo", () => {
    const txs = [tx("1", "income", 100_000, "2026-08-01"), tx("2", "expense", 300_000, "2026-08-02")]
    assert.equal(estimateMonthlySavings(txs, accounts, 6, now).ARS, -200_000)
  })

  test("toma la moneda de la cuenta cuando el movimiento no la trae", () => {
    const txs = [tx("1", "income", 300, "2026-08-01", "usd")]
    const r = estimateMonthlySavings(txs, accounts, 6, now)
    assert.equal(r.USD, 300)
    assert.equal(r.ARS, 0)
  })

  test("respeta la ventana de meses pedida", () => {
    const txs = [
      tx("1", "income", 100_000, "2026-01-01"),
      tx("2", "income", 900_000, "2026-07-01"),
      tx("3", "income", 900_000, "2026-08-01"),
    ]
    assert.equal(estimateMonthlySavings(txs, accounts, 2, now).monthsUsed, 2)
    assert.equal(estimateMonthlySavings(txs, accounts, 2, now).ARS, 900_000)
  })
})

describe("sumOverdueLiabilities", () => {
  const due = (
    id: string,
    amount: number,
    dueDate: string,
    status: DueItem["status"] = "pending",
    currency: DueItem["currency"] = "ARS"
  ): DueItem => ({
    id,
    title: "x",
    category: "x",
    amount,
    currency,
    dueDate,
    frequency: "monthly",
    reminderDaysBefore: 3,
    status,
    autoRenew: false,
    createdAt: "2026-01-01",
  })

  test("suma sólo lo vencido o que vence hoy", () => {
    const items = [
      due("1", 50_000, "2026-08-01"),
      due("2", 30_000, "2026-09-05"), // hoy
      due("3", 90_000, "2026-10-01"), // futuro: lo absorbe el ahorro mensual
    ]
    assert.deepEqual(sumOverdueLiabilities(items, now), { ARS: 80_000, USD: 0 })
  })

  test("lo ya pagado no cuenta", () => {
    assert.deepEqual(sumOverdueLiabilities([due("1", 50_000, "2026-08-01", "paid")], now), {
      ARS: 0,
      USD: 0,
    })
  })

  test("separa por moneda", () => {
    const items = [due("1", 50_000, "2026-08-01"), due("2", 200, "2026-08-01", "pending", "USD")]
    assert.deepEqual(sumOverdueLiabilities(items, now), { ARS: 50_000, USD: 200 })
  })
})
