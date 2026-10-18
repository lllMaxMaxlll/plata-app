import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { buildAgenda, relativeDays } from "./agenda.ts"
import type { DueItem, Vehicle, VehicleLog } from "./finance-data.ts"

// Domingo 18 de octubre de 2026.
const now = new Date(2026, 9, 18, 10, 0)

function due(overrides: Partial<DueItem>): DueItem {
  return {
    id: "d1",
    title: "Edenor",
    category: "Servicios",
    amount: 38200,
    currency: "ARS",
    dueDate: "2026-10-19",
    frequency: "monthly",
    reminderDaysBefore: 3,
    status: "pending",
    autoRenew: true,
    createdAt: "2026-01-01",
    ...overrides,
  }
}

const corolla: Vehicle = {
  id: "v1",
  name: "Corolla",
  type: "car",
  odometer: 84580,
  createdAt: "2025-01-01",
}

function service(overrides: Partial<VehicleLog>): VehicleLog {
  return {
    id: "l1",
    vehicleId: "v1",
    type: "service",
    date: "2026-03-03",
    odometer: 80000,
    amount: 148000,
    nextServiceOdometer: 85000,
    ...overrides,
  }
}

describe("buildAgenda", () => {
  test("ordena vencidos, después lo próximo y por último lo demás", () => {
    const agenda = buildAgenda({
      dueItems: [
        due({ id: "late", title: "VTV", dueDate: "2026-11-10" }),
        due({ id: "soon", title: "Edenor", dueDate: "2026-10-19" }),
        due({ id: "over", title: "Monotributo", dueDate: "2026-10-15" }),
      ],
      vehicles: [],
      vehicleLogs: [],
      now,
    })
    assert.deepEqual(
      agenda.map((i) => [i.title, i.urgency, i.daysUntil]),
      [
        ["Monotributo", "overdue", -3],
        ["Edenor", "soon", 1],
        ["VTV", "later", 23],
      ]
    )
  })

  test("deja afuera lo pagado y lo que está fuera del horizonte", () => {
    const agenda = buildAgenda({
      dueItems: [due({ status: "paid" }), due({ id: "far", dueDate: "2027-01-10" })],
      vehicles: [],
      vehicleLogs: [],
      now,
    })
    assert.equal(agenda.length, 0)
  })

  test("el aviso respeta los días de recordatorio del vencimiento", () => {
    const [item] = buildAgenda({
      dueItems: [due({ dueDate: "2026-10-25", reminderDaysBefore: 7 })],
      vehicles: [],
      vehicleLogs: [],
      now,
    })
    assert.equal(item.urgency, "soon")
  })

  test("el service por km aparece con lo que falta y el avance del intervalo", () => {
    const [item] = buildAgenda({ dueItems: [], vehicles: [corolla], vehicleLogs: [service({})], now })
    assert.equal(item.kind, "service")
    if (item.kind !== "service") return
    assert.equal(item.kmLeft, 420)
    assert.equal(item.urgency, "soon")
    assert.ok(Math.abs((item.progress ?? 0) - 0.916) < 0.001)
  })

  test("manda el último service, no uno viejo que ya quedó atrás", () => {
    const agenda = buildAgenda({
      dueItems: [],
      vehicles: [corolla],
      vehicleLogs: [
        service({ id: "old", date: "2025-09-01", odometer: 70000, nextServiceOdometer: 75000 }),
        service({ id: "new", date: "2026-03-03", odometer: 80000, nextServiceOdometer: 90000 }),
      ],
      now,
    })
    // 90.000 − 84.580 = 5.420 km: lejos, no se avisa.
    assert.equal(agenda.length, 0)
  })

  test("un service pasado de km es vencido", () => {
    const [item] = buildAgenda({
      dueItems: [],
      vehicles: [{ ...corolla, odometer: 85300 }],
      vehicleLogs: [service({})],
      now,
    })
    assert.equal(item.urgency, "overdue")
  })

  test("un service con sólo fecha también avisa", () => {
    const [item] = buildAgenda({
      dueItems: [],
      vehicles: [corolla],
      vehicleLogs: [service({ nextServiceOdometer: undefined, nextServiceDate: "2026-10-28" })],
      now,
    })
    assert.equal(item.urgency, "soon")
    assert.equal(item.daysUntil, 10)
  })
})

describe("relativeDays", () => {
  test("nombra los días cercanos", () => {
    assert.equal(relativeDays(0), "hoy")
    assert.equal(relativeDays(1), "mañana")
    assert.equal(relativeDays(-1), "ayer")
    assert.equal(relativeDays(-4), "hace 4 días")
    assert.equal(relativeDays(9), "en 9 días")
  })
})
