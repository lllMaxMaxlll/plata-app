import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { runSimulation, type SimulationParams, type SequentialGoal } from "./simulation-engine.ts"

const base: SimulationParams = {
  initialNetWorth: { ARS: 5_000_000, USD: 10_000 },
  monthlySavings: { ARS: 300_000, USD: 500 },
  annualInflationRate: 45,
  annualDevaluationRate: 40,
  annualReturnARS: 45,
  annualReturnUSD: 8,
  horizonMonths: 36,
  displayCurrency: "USD",
  initialExchangeRate: 1250,
}

const goals: SequentialGoal[] = [
  { id: "reserva", name: "Reserva", amount: 3_000, currency: "USD", kind: "reserve", priority: 1 },
  { id: "moto", name: "Moto", amount: 7_000_000, currency: "ARS", kind: "purchase", priority: 2 },
]

describe("escenarios", () => {
  // El bug original: el escenario pesimista escalaba la devaluación, y más
  // devaluación sube el patrimonio nominal en pesos de quien tiene dólares. La
  // línea "pesimista" terminaba por encima de la "optimista" en la vista en ARS.
  for (const displayCurrency of ["ARS", "USD"] as const) {
    for (const isRealTerms of [false, true]) {
      test(`nunca se cruzan (${displayCurrency}, ${isRealTerms ? "real" : "nominal"})`, () => {
        const r = runSimulation({ ...base, displayCurrency, isRealTerms })
        for (const pt of r.timeline) {
          assert.ok(
            pt.optimistic >= pt.neutral && pt.neutral >= pt.pessimistic,
            `mes ${pt.month}: pes ${pt.pessimistic} / neu ${pt.neutral} / opt ${pt.optimistic}`
          )
        }
      })
    }
  }

  test("la trayectoria sin compras respeta el orden aunque haya metas", () => {
    const r = runSimulation({ ...base, displayCurrency: "ARS", sequentialGoals: goals })
    for (const pt of r.timeline) {
      assert.ok(pt.optimisticPreGoal >= pt.neutralPreGoal)
      assert.ok(pt.neutralPreGoal >= pt.pessimisticPreGoal)
    }
  })
})

describe("moneda", () => {
  test("el patrimonio en ARS equivale al de USD al tipo de cambio del mes", () => {
    const ars = runSimulation({ ...base, displayCurrency: "ARS", sequentialGoals: goals })
    const usd = runSimulation({ ...base, displayCurrency: "USD", sequentialGoals: goals })

    for (let i = 0; i < ars.timeline.length; i++) {
      const a = ars.timeline[i]
      const u = usd.timeline[i]
      assert.equal(a.exchangeRate, u.exchangeRate)
      const diff = Math.abs(a.neutral - u.neutral * a.exchangeRate)
      assert.ok(diff / Math.max(1, a.neutral) < 1e-9, `mes ${a.month}: desvío ${diff}`)
    }
  })

  // El descuento por inflación usaba siempre la inflación en pesos, también
  // cuando la vista estaba en dólares: US$41.405 nominales pasaban a "US$13.581
  // reales" con 45% de inflación argentina.
  test("los dólares se descuentan por inflación en dólares, no por la de pesos", () => {
    const nominal = runSimulation({ ...base, displayCurrency: "USD", isRealTerms: false })
    const real = runSimulation({
      ...base,
      displayCurrency: "USD",
      isRealTerms: true,
      annualUsdInflationRate: 2.5,
    })
    const n = nominal.timeline.at(-1)!.neutral
    const r = real.timeline.at(-1)!.neutral
    const esperado = n * Math.pow(1 + 0.025, -3) // 36 meses = 3 años
    assert.ok(Math.abs(r - esperado) / esperado < 1e-9)
    assert.ok(r > n * 0.9, "descontar dólares al ritmo del peso los destruía")
  })

  test("con inflación en dólares cero, real y nominal coinciden en USD", () => {
    const p = { ...base, displayCurrency: "USD" as const, annualUsdInflationRate: 0 }
    const nominal = runSimulation({ ...p, isRealTerms: false })
    const real = runSimulation({ ...p, isRealTerms: true })
    assert.ok(Math.abs(real.timeline.at(-1)!.neutral - nominal.timeline.at(-1)!.neutral) < 1e-6)
  })
})

describe("aportes y rendimientos", () => {
  // Los aportes se sumaban antes de aplicar el rendimiento del mes, así que la
  // plata cobraba un mes de interés antes de existir.
  test("sin rendimiento ni inflación, el patrimonio es capital inicial más aportes", () => {
    const r = runSimulation({
      ...base,
      annualInflationRate: 0,
      annualUsdInflationRate: 0,
      annualDevaluationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      monthlySavings: { ARS: 0, USD: 1_000 },
      initialNetWorth: { ARS: 0, USD: 5_000 },
      horizonMonths: 12,
      displayCurrency: "USD",
    })
    assert.equal(Math.round(r.timeline.at(-1)!.neutral), 5_000 + 12 * 1_000)
    assert.equal(Math.round(r.finalNetWorth.neutral.totalSaved), 12_000)
    assert.equal(Math.round(r.finalNetWorth.neutral.totalReturns), 0)
  })

  test("los rendimientos acumulados son positivos con tasa positiva", () => {
    const r = runSimulation(base)
    assert.ok(r.finalNetWorth.neutral.totalReturns > 0)
    assert.ok(r.finalNetWorth.optimistic.totalReturns > r.finalNetWorth.pessimistic.totalReturns)
  })
})

describe("metas", () => {
  // El costo se tomaba nominal fijo y se dividía por el TC futuro, así que una
  // moto de $7.000.000 "costaba" US$2.041 a tres años.
  test("el costo de una meta en pesos acompaña a la inflación", () => {
    const lenta = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 0 },
      monthlySavings: { ARS: 200_000, USD: 0 },
      annualInflationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      sequentialGoals: [
        { id: "x", name: "X", amount: 2_400_000, currency: "ARS", kind: "purchase", priority: 1 },
      ],
    })
    const conInflacion = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 0 },
      monthlySavings: { ARS: 200_000, USD: 0 },
      annualInflationRate: 100,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      sequentialGoals: [
        { id: "x", name: "X", amount: 2_400_000, currency: "ARS", kind: "purchase", priority: 1 },
      ],
    })
    const sinInf = lenta.sequentialGoalResults[0].estimatedMonthNeutral
    const conInf = conInflacion.sequentialGoalResults[0].estimatedMonthNeutral
    assert.ok(sinInf !== undefined)
    // Con inflación la meta se aleja: nunca puede lograrse antes.
    assert.ok(conInf === undefined || conInf > sinInf!, `${conInf} vs ${sinInf}`)
  })

  test("la cascada respeta la prioridad", () => {
    const r = runSimulation({ ...base, sequentialGoals: goals, initialNetWorth: { ARS: 0, USD: 0 } })
    const [primera, segunda] = r.sequentialGoalResults
    if (primera.estimatedMonthNeutral !== undefined && segunda.estimatedMonthNeutral !== undefined) {
      assert.ok(segunda.estimatedMonthNeutral >= primera.estimatedMonthNeutral)
    } else {
      assert.equal(segunda.estimatedMonthNeutral, undefined)
    }
  })

  test("la reserva queda inmovilizada y no paga la compra siguiente", () => {
    const soloReserva = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 6_000 },
      monthlySavings: { ARS: 0, USD: 0 },
      annualInflationRate: 0,
      annualUsdInflationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      horizonMonths: 12,
      sequentialGoals: [
        { id: "r", name: "Reserva", amount: 5_000, currency: "USD", kind: "reserve", priority: 1 },
        { id: "c", name: "Compra", amount: 2_000, currency: "USD", kind: "purchase", priority: 2 },
      ],
    })
    // Quedan US$1.000 libres tras bloquear la reserva: no alcanzan para US$2.000.
    assert.equal(soloReserva.sequentialGoalResults[0].estimatedMonthNeutral, 1)
    assert.equal(soloReserva.sequentialGoalResults[1].estimatedMonthNeutral, undefined)
  })

  // Las metas se validaban contra el patrimonio total, cartera de acciones
  // incluida, y se descontaban de los saldos líquidos.
  test("la cartera suma al patrimonio pero no financia metas", () => {
    const p: SimulationParams = {
      ...base,
      initialNetWorth: { ARS: 0, USD: 1_000 },
      illiquidNetWorth: { ARS: 0, USD: 50_000 },
      monthlySavings: { ARS: 0, USD: 0 },
      annualInflationRate: 0,
      annualUsdInflationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      horizonMonths: 12,
      sequentialGoals: [
        { id: "c", name: "Compra", amount: 20_000, currency: "USD", kind: "purchase", priority: 1 },
      ],
    }
    const r = runSimulation(p)
    assert.equal(r.sequentialGoalResults[0].estimatedMonthNeutral, undefined)
    assert.equal(Math.round(r.timeline.at(-1)!.neutral), 51_000)
  })

  test("una meta fuera del horizonte lo dice, y no inventa 'más de 5 años'", () => {
    const r = runSimulation({
      ...base,
      horizonMonths: 12,
      sequentialGoals: [
        { id: "d", name: "Depto", amount: 500_000, currency: "USD", kind: "purchase", priority: 1 },
      ],
    })
    const res = r.sequentialGoalResults[0]
    assert.equal(res.isAchievedInHorizon, false)
    assert.match(res.estimatedDateLabel, /12 meses/)
    assert.equal(r.nextGoal?.goal.id, "d")
  })

  test("sin metas pendientes no hay próximo objetivo", () => {
    assert.equal(runSimulation(base).nextGoal, null)
    const todasLogradas = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 100_000 },
      sequentialGoals: [
        { id: "r", name: "Reserva", amount: 1_000, currency: "USD", kind: "reserve", priority: 1 },
      ],
    })
    assert.equal(todasLogradas.nextGoal, null)
  })

  test("la cobertura se mide contra el costo acumulado de la secuencia", () => {
    const r = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 5_000 },
      sequentialGoals: [
        { id: "a", name: "A", amount: 5_000, currency: "USD", kind: "reserve", priority: 1 },
        { id: "b", name: "B", amount: 15_000, currency: "USD", kind: "purchase", priority: 2 },
      ],
    })
    assert.equal(r.sequentialGoalResults[0].coveragePercent, 100)
    // US$5.000 sobre US$20.000 acumulados
    assert.equal(r.sequentialGoalResults[1].coveragePercent, 25)
  })
})

// Caso real reportado: la página decía "no se alcanza en 36 meses" para una meta
// que con los saldos y el ahorro reales se cumple en 4. El motor estaba bien; lo
// que le llegaba no: patrimonio inicial en 0 porque el seeding del modo manual
// corrió antes de que cargaran las cuentas, y ahorro en 0 porque nunca se había
// fijado y no se derivaba del historial.
describe("regresión: metas cercanas no deben verse inalcanzables", () => {
  const caso = (initialARS: number, savingsARS: number): SimulationParams => ({
    initialNetWorth: { ARS: initialARS, USD: 1_285.32 },
    illiquidNetWorth: { ARS: 0, USD: 161 },
    monthlySavings: { ARS: savingsARS, USD: 0 },
    annualInflationRate: 45,
    annualDevaluationRate: 40,
    annualReturnARS: 45,
    annualReturnUSD: 12,
    horizonMonths: 36,
    displayCurrency: "USD",
    isRealTerms: true,
    initialExchangeRate: 1540,
    sequentialGoals: [
      { id: "g1", name: "Fondo de reserva", amount: 3_000, currency: "USD", kind: "purchase", priority: 1 },
    ],
  })

  test("con los saldos y el ahorro reales, la meta entra en menos de 6 meses", () => {
    const r = runSimulation(caso(1_795_320, 265_238))
    const mes = r.sequentialGoalResults[0].estimatedMonthNeutral
    assert.ok(mes !== undefined, "la meta debería alcanzarse dentro del horizonte")
    assert.ok(mes! <= 6, `se esperaba <= 6 meses, dio ${mes}`)
  })

  test("con el patrimonio en cero la misma meta se vuelve inalcanzable", () => {
    const r = runSimulation(caso(0, 265_238))
    assert.ok(
      (r.sequentialGoalResults[0].estimatedMonthNeutral ?? 99) > 6,
      "perder el capital inicial tiene que alejar la meta: es el síntoma que hay que evitar"
    )
  })

  // El precio de la meta se inflacionaba pero el aporte que la paga quedaba
  // clavado en pesos nominales, así que a 45% anual toda meta en pesos a más de
  // un año se volvía inalcanzable por construcción.
  test("una meta en pesos a mediano plazo se alcanza con un ahorro realista", () => {
    const r = runSimulation({
      ...caso(1_795_320, 265_238),
      sequentialGoals: [
        { id: "moto", name: "Moto", amount: 7_000_000, currency: "ARS", kind: "purchase", priority: 1 },
      ],
    })
    const mes = r.sequentialGoalResults[0].estimatedMonthNeutral
    assert.ok(mes !== undefined, "7.000.000 ahorrando 265.000 por mes tiene que entrar en 36 meses")
    assert.ok(mes! <= 24, `se esperaba <= 24 meses, dio ${mes}`)
  })

  test("el aporte mensual acompaña a la inflación de su moneda", () => {
    const sinInflacion = runSimulation({
      ...caso(0, 100_000),
      annualInflationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      initialNetWorth: { ARS: 0, USD: 0 },
      illiquidNetWorth: { ARS: 0, USD: 0 },
      displayCurrency: "ARS",
      isRealTerms: false,
      annualDevaluationRate: 0,
      horizonMonths: 12,
      sequentialGoals: [],
    })
    const conInflacion = runSimulation({
      ...caso(0, 100_000),
      annualInflationRate: 100,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      initialNetWorth: { ARS: 0, USD: 0 },
      illiquidNetWorth: { ARS: 0, USD: 0 },
      displayCurrency: "ARS",
      isRealTerms: false,
      annualDevaluationRate: 0,
      horizonMonths: 12,
      sequentialGoals: [],
    })
    assert.equal(Math.round(sinInflacion.timeline.at(-1)!.neutral), 1_200_000)
    // Con inflación, el mismo esfuerzo aporta más pesos nominales.
    assert.ok(conInflacion.timeline.at(-1)!.neutral > 1_200_000 * 1.3)
  })

  // El ahorro neto en dólares del usuario era negativo (gasta más de lo que
  // entra). El saldo en dólares se hundía sin límite y seguía componiendo al 12%
  // anual, restando de la plata disponible para las metas.
  test("un gasto neto en dólares se cubre con pesos, no genera un descubierto", () => {
    const r = runSimulation({
      ...caso(5_000_000, 0),
      monthlySavings: { ARS: 0, USD: -100 },
      annualInflationRate: 0,
      annualUsdInflationRate: 0,
      annualDevaluationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      initialNetWorth: { ARS: 5_000_000, USD: 100 },
      illiquidNetWorth: { ARS: 0, USD: 0 },
      displayCurrency: "USD",
      isRealTerms: false,
      horizonMonths: 12,
      sequentialGoals: [],
    })
    // Arranca con 100 + 5.000.000/1540 = 3.346 y gasta 100 por mes: quedan 2.246.
    const esperado = 100 + 5_000_000 / 1540 - 12 * 100
    assert.ok(
      Math.abs(r.timeline.at(-1)!.neutral - esperado) < 1,
      `se esperaba ~${esperado.toFixed(0)}, dio ${r.timeline.at(-1)!.neutral.toFixed(0)}`
    )
  })

  test("una meta que queda apenas afuera dice cuánto falta, no sólo que no llega", () => {
    const r = runSimulation({
      ...caso(1_795_320, 265_238),
      horizonMonths: 36,
      sequentialGoals: [
        { id: "r", name: "Reserva", amount: 3_000, currency: "USD", kind: "reserve", priority: 1 },
        { id: "m", name: "Moto", amount: 20_000_000, currency: "ARS", kind: "purchase", priority: 2 },
      ],
    })
    const moto = r.sequentialGoalResults[1]
    assert.equal(moto.isAchievedInHorizon, false)
    assert.ok(moto.estimatedMonthBeyondHorizon! > 36)
    assert.match(moto.estimatedDateLabel, /Fuera del horizonte/)
  })

  test("con ahorro cero no se alcanza nunca, por más capital que haya", () => {
    const r = runSimulation({ ...caso(1_000_000, 0), annualReturnARS: 0, annualReturnUSD: 0 })
    assert.equal(r.sequentialGoalResults[0].estimatedMonthNeutral, undefined)
  })
})

describe("casos borde", () => {
  test("todo en cero no rompe", () => {
    const r = runSimulation({
      ...base,
      initialNetWorth: { ARS: 0, USD: 0 },
      monthlySavings: { ARS: 0, USD: 0 },
      annualInflationRate: 0,
      annualDevaluationRate: 0,
      annualReturnARS: 0,
      annualReturnUSD: 0,
      horizonMonths: 12,
    })
    for (const pt of r.timeline) {
      assert.ok(Number.isFinite(pt.neutral) && Number.isFinite(pt.exchangeRate))
    }
    assert.equal(r.timeline.at(-1)!.neutral, 0)
  })

  test("rendimientos negativos no producen NaN", () => {
    const r = runSimulation({ ...base, annualReturnARS: -100, annualReturnUSD: -100 })
    for (const pt of r.timeline) assert.ok(Number.isFinite(pt.neutral))
  })

  test("la línea de tiempo tiene un punto por mes más el actual", () => {
    const r = runSimulation({ ...base, horizonMonths: 24 })
    assert.equal(r.timeline.length, 25)
    assert.equal(r.timeline[0].month, 0)
    assert.equal(r.timeline[0].label, "Actual")
    assert.equal(r.timeline.at(-1)!.month, 24)
  })
})
