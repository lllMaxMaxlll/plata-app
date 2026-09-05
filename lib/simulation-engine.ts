// ---------------------------------------------------------------------------
// Motor de simulación financiera de PLATA. TypeScript puro, sin dependencias:
// se puede testear sin montar React ni Supabase.
//
// Convenciones del modelo:
//   - Los aportes son de fin de mes (renta ordinaria): el rendimiento del mes
//     se aplica al saldo de apertura y recién después entra el ahorro. Sumarlo
//     antes le regalaba un mes entero de interés a plata que todavía no estaba.
//   - Los escenarios NO mueven la devaluación. Más devaluación sube el
//     patrimonio nominal en pesos de quien tiene dólares, así que usarla como
//     eje pesimista/optimista hacía que la línea "pesimista" quedara por encima
//     de la "optimista" en la vista en ARS. Los escenarios se separan por
//     inflación y rendimiento, que sí empujan siempre para el mismo lado.
//   - El poder adquisitivo se descuenta con la inflación de la moneda que se
//     está mostrando: pesos con inflación en pesos, dólares con inflación en
//     dólares.
//   - El capital ilíquido (la cartera de acciones) suma al patrimonio pero no
//     financia metas.
// ---------------------------------------------------------------------------

export type Currency = "ARS" | "USD"

export interface SequentialGoal {
  id: string
  name: string
  amount: number
  currency: Currency
  /** 'reserve' inmoviliza capital; 'purchase' lo descuenta. */
  kind: "reserve" | "purchase"
  priority: number
}

export interface SequentialGoalResult {
  goal: SequentialGoal
  estimatedMonthNeutral?: number
  estimatedMonthPessimistic?: number
  estimatedMonthOptimistic?: number
  /** "Marzo 2027 (en 7 meses)", o el aviso de que no entra en el horizonte. */
  estimatedDateLabel: string
  isAchievedInHorizon: boolean
  /** Qué parte de la secuencia hasta esta meta cubre el capital líquido de hoy. */
  coveragePercent: number
  /** Costo ya inflacionado al mes en que se alcanza (o de hoy, si no se alcanza). */
  costInDisplayCurrency: number
}

export interface SimulationParams {
  /** Capital líquido: es el que financia las metas. */
  initialNetWorth: { ARS: number; USD: number }
  /** Capital que suma al patrimonio pero no se toca para las metas (cartera). */
  illiquidNetWorth?: { ARS: number; USD: number }
  monthlySavings: { ARS: number; USD: number }
  /** Inflación anual en pesos, en % (ej. 45). */
  annualInflationRate: number
  /** Inflación anual en dólares, en % (ej. 2.5). */
  annualUsdInflationRate?: number
  annualDevaluationRate: number
  annualReturnARS: number
  annualReturnUSD: number
  horizonMonths: number
  displayCurrency: Currency
  /** ARS por USD (ej. 1250). */
  initialExchangeRate: number
  sequentialGoals?: SequentialGoal[]
  isRealTerms?: boolean
}

export interface ScenarioPoint {
  month: number
  label: string
  exchangeRate: number

  pessimistic: number
  neutral: number
  optimistic: number

  /** Trayectoria sin descontar las compras, como referencia. */
  pessimisticPreGoal: number
  neutralPreGoal: number
  optimisticPreGoal: number

  achievedGoalNames: string[]
}

export interface ScenarioResultSummary {
  finalNominal: number
  finalReal: number
  /** Aportes acumulados, en la moneda de vista al tipo de cambio de hoy. */
  totalSaved: number
  /** Rendimientos acumulados, en la moneda de vista al tipo de cambio de hoy. */
  totalReturns: number
}

export interface SimulationResult {
  timeline: ScenarioPoint[]
  sequentialGoalResults: SequentialGoalResult[]
  nextGoal: SequentialGoalResult | null
  finalNetWorth: {
    pessimistic: ScenarioResultSummary
    neutral: ScenarioResultSummary
    optimistic: ScenarioResultSummary
  }
  displayCurrency: Currency
}

export type ScenarioType = "pessimistic" | "neutral" | "optimistic"

interface ScenarioConfig {
  inflationARS: number
  inflationUSD: number
  devaluation: number
  returnARS: number
  returnUSD: number
}

export const DEFAULT_USD_INFLATION = 2.5

/** Pasa una tasa anual en % a su equivalente mensual compuesto. */
function getMonthlyRate(annualPercent: number): number {
  const annualDecimal = annualPercent / 100
  // Una caída anual del 100% o más deja el capital en cero; el equivalente
  // mensual es -1, no un número imaginario.
  if (annualDecimal <= -1) return -1
  return Math.pow(1 + annualDecimal, 1 / 12) - 1
}

function getFutureMonthLabel(monthIndex: number): string {
  const now = new Date()
  const futureDate = new Date(now.getFullYear(), now.getMonth() + monthIndex, 1)
  const monthName = futureDate.toLocaleString("es-AR", { month: "long" })
  const year = futureDate.getFullYear()
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  return `${capitalizedMonth} ${year} (en ${monthIndex} ${monthIndex === 1 ? "mes" : "meses"})`
}

interface ScenarioPointRaw {
  month: number
  label: string
  exchangeRate: number
  netWorthWithGoal: number
  netWorthWithoutGoal: number
  netWorthWithGoalReal: number
  netWorthWithoutGoalReal: number
  achievedGoalNames: string[]
}

/** Proyección mensual de un escenario, con las metas resolviéndose en cascada. */
function calculateScenarioTimeline(params: SimulationParams, config: ScenarioConfig) {
  const {
    initialNetWorth,
    illiquidNetWorth,
    monthlySavings,
    horizonMonths,
    displayCurrency,
    initialExchangeRate,
    sequentialGoals = [],
  } = params

  const iArsMonthly = getMonthlyRate(config.inflationARS)
  const iUsdMonthly = getMonthlyRate(config.inflationUSD)
  const dMonthly = getMonthlyRate(config.devaluation)
  const rArsMonthly = getMonthlyRate(config.returnARS)
  const rUsdMonthly = getMonthlyRate(config.returnUSD)

  // Capital líquido: el único que puede pagar una meta.
  let liquidARS = Math.max(0, initialNetWorth.ARS)
  let liquidUSD = Math.max(0, initialNetWorth.USD)
  // Trayectoria paralela que nunca descuenta compras.
  let liquidARSNoGoal = liquidARS
  let liquidUSDNoGoal = liquidUSD
  // Cartera: suma al patrimonio, no financia metas.
  let illiquidARS = Math.max(0, illiquidNetWorth?.ARS ?? 0)
  let illiquidUSD = Math.max(0, illiquidNetWorth?.USD ?? 0)

  const fx0 = Math.max(1, initialExchangeRate)
  let fxRate = fx0

  let totalContributed = 0
  let totalReturns = 0

  const sortedGoals = [...sequentialGoals].sort((a, b) => a.priority - b.priority)
  let currentGoalIdx = 0
  let lockedReserveUSD = 0

  const goalAchievementMonths = new Map<string, number>()
  const goalAchievementFx = new Map<string, number>()

  const toDisplay = (ars: number, usd: number, fx: number) =>
    displayCurrency === "ARS" ? ars + usd * fx : usd + ars / fx

  const points: ScenarioPointRaw[] = []

  const initialNominal = toDisplay(liquidARS + illiquidARS, liquidUSD + illiquidUSD, fxRate)
  points.push({
    month: 0,
    label: "Actual",
    exchangeRate: fxRate,
    netWorthWithGoal: initialNominal,
    netWorthWithoutGoal: initialNominal,
    netWorthWithGoalReal: initialNominal,
    netWorthWithoutGoalReal: initialNominal,
    achievedGoalNames: [],
  })

  for (let m = 1; m <= horizonMonths; m++) {
    fxRate = fxRate * (1 + dMonthly)

    // 1. Rendimiento sobre el saldo de apertura.
    const returnARS = liquidARS * rArsMonthly
    const returnUSD = liquidUSD * rUsdMonthly
    liquidARS += returnARS
    liquidUSD += returnUSD
    liquidARSNoGoal *= 1 + rArsMonthly
    liquidUSDNoGoal *= 1 + rUsdMonthly
    illiquidARS *= 1 + rArsMonthly
    illiquidUSD *= 1 + rUsdMonthly
    totalReturns += displayCurrency === "ARS" ? returnARS + returnUSD * fx0 : returnUSD + returnARS / fx0

    // 2. Aporte de fin de mes.
    liquidARS += monthlySavings.ARS
    liquidUSD += monthlySavings.USD
    liquidARSNoGoal += monthlySavings.ARS
    liquidUSDNoGoal += monthlySavings.USD
    totalContributed +=
      displayCurrency === "ARS"
        ? monthlySavings.ARS + monthlySavings.USD * fx0
        : monthlySavings.USD + monthlySavings.ARS / fx0

    // 3. La reserva ya bloqueada mantiene su poder adquisitivo.
    lockedReserveUSD *= 1 + iUsdMonthly

    // 4. Metas en cascada.
    const achievedNames: string[] = []
    while (currentGoalIdx < sortedGoals.length) {
      const activeGoal = sortedGoals[currentGoalIdx]

      // El precio de la meta acompaña a la inflación de su moneda: una moto de
      // $7.000.000 de hoy no vale $7.000.000 dentro de tres años.
      const inflatedAmount =
        activeGoal.amount *
        Math.pow(1 + (activeGoal.currency === "ARS" ? iArsMonthly : iUsdMonthly), m)
      const goalCostUSD =
        activeGoal.currency === "USD" ? inflatedAmount : inflatedAmount / fxRate

      const liquidUSDEquivalent = liquidUSD + liquidARS / fxRate
      const availableUSD = Math.max(0, liquidUSDEquivalent - lockedReserveUSD)

      if (availableUSD < goalCostUSD) break

      goalAchievementMonths.set(activeGoal.id, m)
      goalAchievementFx.set(activeGoal.id, fxRate)
      achievedNames.push(activeGoal.name)

      if (activeGoal.kind === "purchase") {
        // Se paga primero con la moneda de la meta y el resto con la otra.
        if (activeGoal.currency === "ARS") {
          const costARS = inflatedAmount
          if (liquidARS >= costARS) {
            liquidARS -= costARS
          } else {
            const deficitARS = costARS - liquidARS
            liquidARS = 0
            liquidUSD = Math.max(0, liquidUSD - deficitARS / fxRate)
          }
        } else {
          const costUSD = inflatedAmount
          if (liquidUSD >= costUSD) {
            liquidUSD -= costUSD
          } else {
            const deficitUSD = costUSD - liquidUSD
            liquidUSD = 0
            liquidARS = Math.max(0, liquidARS - deficitUSD * fxRate)
          }
        }
      } else {
        lockedReserveUSD += goalCostUSD
      }

      currentGoalIdx++
    }

    const nominalWithGoal = toDisplay(liquidARS + illiquidARS, liquidUSD + illiquidUSD, fxRate)
    const nominalNoGoal = toDisplay(
      liquidARSNoGoal + illiquidARS,
      liquidUSDNoGoal + illiquidUSD,
      fxRate
    )

    // El poder adquisitivo se pierde al ritmo de la moneda que se muestra.
    const inflationForDisplay = displayCurrency === "ARS" ? iArsMonthly : iUsdMonthly
    const discountFactor = Math.pow(1 + inflationForDisplay, -m)

    let label = `M${m}`
    if (m % 12 === 0) {
      const years = m / 12
      label = `${years} año${years > 1 ? "s" : ""}`
    }

    points.push({
      month: m,
      label,
      exchangeRate: fxRate,
      netWorthWithGoal: Math.max(0, nominalWithGoal),
      netWorthWithoutGoal: Math.max(0, nominalNoGoal),
      netWorthWithGoalReal: Math.max(0, nominalWithGoal * discountFactor),
      netWorthWithoutGoalReal: Math.max(0, nominalNoGoal * discountFactor),
      achievedGoalNames: achievedNames,
    })
  }

  return { points, totalContributed, totalReturns, goalAchievementMonths, goalAchievementFx }
}

/** Corre la simulación en los tres escenarios. */
export function runSimulation(params: SimulationParams): SimulationResult {
  const {
    annualInflationRate,
    annualUsdInflationRate = DEFAULT_USD_INFLATION,
    annualDevaluationRate,
    annualReturnARS,
    annualReturnUSD,
    sequentialGoals = [],
    isRealTerms = false,
    displayCurrency,
    horizonMonths,
  } = params

  // Más inflación y menos rendimiento empujan siempre para el mismo lado, en
  // las dos monedas. La devaluación queda fija: es un supuesto del usuario, no
  // un eje del escenario (ver la nota de arriba).
  const devaluation = Math.max(0, annualDevaluationRate)
  const scaleReturn = (rate: number, factor: number) =>
    rate >= 0 ? rate * factor : rate / factor

  const pessimisticConfig: ScenarioConfig = {
    inflationARS: Math.max(0, annualInflationRate * 1.2),
    inflationUSD: Math.max(0, annualUsdInflationRate * 1.2),
    devaluation,
    returnARS: scaleReturn(annualReturnARS, 0.7),
    returnUSD: scaleReturn(annualReturnUSD, 0.7),
  }

  const neutralConfig: ScenarioConfig = {
    inflationARS: Math.max(0, annualInflationRate),
    inflationUSD: Math.max(0, annualUsdInflationRate),
    devaluation,
    returnARS: annualReturnARS,
    returnUSD: annualReturnUSD,
  }

  const optimisticConfig: ScenarioConfig = {
    inflationARS: Math.max(0, annualInflationRate * 0.85),
    inflationUSD: Math.max(0, annualUsdInflationRate * 0.85),
    devaluation,
    returnARS: scaleReturn(annualReturnARS, 1.25),
    returnUSD: scaleReturn(annualReturnUSD, 1.25),
  }

  const pSim = calculateScenarioTimeline(params, pessimisticConfig)
  const nSim = calculateScenarioTimeline(params, neutralConfig)
  const oSim = calculateScenarioTimeline(params, optimisticConfig)

  const timeline: ScenarioPoint[] = nSim.points.map((nPoint, i) => {
    const pPoint = pSim.points[i]
    const oPoint = oSim.points[i]

    return {
      month: nPoint.month,
      label: nPoint.label,
      exchangeRate: nPoint.exchangeRate,

      pessimistic: isRealTerms ? pPoint.netWorthWithGoalReal : pPoint.netWorthWithGoal,
      neutral: isRealTerms ? nPoint.netWorthWithGoalReal : nPoint.netWorthWithGoal,
      optimistic: isRealTerms ? oPoint.netWorthWithGoalReal : oPoint.netWorthWithGoal,

      pessimisticPreGoal: isRealTerms
        ? pPoint.netWorthWithoutGoalReal
        : pPoint.netWorthWithoutGoal,
      neutralPreGoal: isRealTerms ? nPoint.netWorthWithoutGoalReal : nPoint.netWorthWithoutGoal,
      optimisticPreGoal: isRealTerms
        ? oPoint.netWorthWithoutGoalReal
        : oPoint.netWorthWithoutGoal,

      achievedGoalNames: nPoint.achievedGoalNames,
    }
  })

  const summarize = (sim: ReturnType<typeof calculateScenarioTimeline>): ScenarioResultSummary => {
    const final = sim.points[sim.points.length - 1]
    return {
      finalNominal: final.netWorthWithGoal,
      finalReal: final.netWorthWithGoalReal,
      totalSaved: sim.totalContributed,
      totalReturns: sim.totalReturns,
    }
  }

  const finalNetWorth = {
    pessimistic: summarize(pSim),
    neutral: summarize(nSim),
    optimistic: summarize(oSim),
  }

  // Cobertura: qué parte del costo acumulado de la secuencia hasta cada meta
  // cubre el capital líquido de hoy. Medirla contra el costo de una sola meta
  // daba 100% en la tercera de la fila con la plata que ya está comprometida en
  // las dos anteriores.
  const fx0 = Math.max(1, params.initialExchangeRate)
  const liquidTodayUSD = params.initialNetWorth.USD + params.initialNetWorth.ARS / fx0
  let cumulativeCostUSD = 0

  const sortedGoals = [...sequentialGoals].sort((a, b) => a.priority - b.priority)
  const sequentialGoalResults: SequentialGoalResult[] = sortedGoals.map((g) => {
    const monthNeutral = nSim.goalAchievementMonths.get(g.id)
    const isAchievedInHorizon = monthNeutral !== undefined

    const costTodayUSD = g.currency === "USD" ? g.amount : g.amount / fx0
    cumulativeCostUSD += costTodayUSD

    // Costo al tipo de cambio e inflación del mes en que efectivamente se logra.
    const fxAtAchievement = nSim.goalAchievementFx.get(g.id) ?? fx0
    const monthsToAchievement = monthNeutral ?? 0
    const inflationMonthly =
      Math.pow(1 + (g.currency === "ARS" ? annualInflationRate : annualUsdInflationRate) / 100, 1 / 12) - 1
    const inflatedAmount = g.amount * Math.pow(1 + inflationMonthly, monthsToAchievement)
    const costInDisplayCurrency =
      g.currency === displayCurrency
        ? inflatedAmount
        : displayCurrency === "ARS"
        ? inflatedAmount * fxAtAchievement
        : inflatedAmount / fxAtAchievement

    return {
      goal: g,
      estimatedMonthNeutral: monthNeutral,
      estimatedMonthPessimistic: pSim.goalAchievementMonths.get(g.id),
      estimatedMonthOptimistic: oSim.goalAchievementMonths.get(g.id),
      estimatedDateLabel: isAchievedInHorizon
        ? getFutureMonthLabel(monthNeutral!)
        : `No se alcanza en ${horizonMonths} meses`,
      isAchievedInHorizon,
      coveragePercent: Math.max(
        0,
        Math.min(100, Math.round((liquidTodayUSD / (cumulativeCostUSD || 1)) * 100))
      ),
      costInDisplayCurrency,
    }
  })

  // La próxima meta es la primera que todavía no se logra. Si están todas
  // cubiertas no hay ninguna próxima, y antes se mostraba la última ya lograda.
  const nextGoal = sequentialGoalResults.find((r) => !r.isAchievedInHorizon) ?? null

  return {
    timeline,
    sequentialGoalResults,
    nextGoal,
    finalNetWorth,
    displayCurrency,
  }
}
