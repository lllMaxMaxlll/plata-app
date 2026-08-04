// ---------------------------------------------------------------------------
// Pure TypeScript Financial Simulation Engine for PLATA
// ---------------------------------------------------------------------------

export type Currency = "ARS" | "USD"

export interface BigPurchaseGoal {
  id?: string
  name: string
  amount: number
  currency: Currency
  targetMonth: number // 1 to 60
}

export interface SequentialGoal {
  id: string
  name: string
  amount: number
  currency: Currency
  type: "reserve" | "purchase" // 'reserve' (reserva de capital) | 'purchase' (gasto/compra)
  priority: number
}

export interface SequentialGoalResult {
  goal: SequentialGoal
  estimatedMonthNeutral?: number
  estimatedMonthPessimistic?: number
  estimatedMonthOptimistic?: number
  estimatedDateLabel?: string // e.g. "Marzo 2027 (en 7 meses)"
  isAchievedInHorizon: boolean
  coveragePercent: number
  costInDisplayCurrency: number
}

export interface SimulationParams {
  initialNetWorth: {
    ARS: number
    USD: number
  }
  monthlySavings: {
    ARS: number
    USD: number
  }
  annualInflationRate: number // e.g. 50 (%)
  annualDevaluationRate: number // e.g. 50 (%)
  annualInvestmentReturnRate: number // e.g. 15 (%)
  horizonMonths: number // 12, 24, 36, 60
  displayCurrency: Currency
  initialExchangeRate: number // ARS per USD, e.g. 1250
  bigPurchaseGoal?: BigPurchaseGoal | null
  sequentialGoals?: SequentialGoal[]
  isRealTerms?: boolean // If true, adjusts by inflation discount factor
}

export interface ScenarioPoint {
  month: number
  label: string
  exchangeRate: number

  // Values in displayCurrency
  pessimistic: number
  neutral: number
  optimistic: number

  // Values excluding big purchase deduction (for clean trajectory reference)
  pessimisticPreGoal: number
  neutralPreGoal: number
  optimisticPreGoal: number

  // Goal cost at this month in display currency
  goalCostInDisplayCurrency?: number
  achievedGoalNames?: string[]
}

export interface ScenarioResultSummary {
  finalNominal: number
  finalReal: number
  totalSaved: number
  totalReturns: number
}

export interface GoalViability {
  isViablePessimistic: boolean
  isViableNeutral: boolean
  isViableOptimistic: boolean
  coveragePercentPessimistic: number
  coveragePercentNeutral: number
  coveragePercentOptimistic: number
  estimatedMonthPessimistic?: number
  estimatedMonthNeutral?: number
  estimatedMonthOptimistic?: number
  statusBadge: {
    label: string
    variant: "success" | "warning" | "destructive" | "secondary"
  }
}

export interface SimulationResult {
  timeline: ScenarioPoint[]
  goalViability: GoalViability | null
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
  inflationRate: number
  devaluationRate: number
  returnRate: number
}

/**
 * Calculate monthly rate from annual percentage
 */
function getMonthlyRate(annualPercent: number): number {
  const annualDecimal = annualPercent / 100
  if (annualDecimal <= -1) return -0.99
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

/**
 * Generates monthly projection for a given scenario with sequential cascading goals
 */
function calculateScenarioTimeline(
  params: SimulationParams,
  config: ScenarioConfig
) {
  const {
    initialNetWorth,
    monthlySavings,
    horizonMonths,
    displayCurrency,
    initialExchangeRate,
    bigPurchaseGoal,
    sequentialGoals = [],
  } = params

  const iMonthly = getMonthlyRate(config.inflationRate)
  const dMonthly = getMonthlyRate(config.devaluationRate)
  const rMonthly = getMonthlyRate(config.returnRate)

  let balanceARS = Math.max(0, initialNetWorth.ARS)
  let balanceUSD = Math.max(0, initialNetWorth.USD)

  let fxRate = Math.max(1, initialExchangeRate)
  let totalSavedInDisplayCurrency = 0

  // Track sequential goals state
  const sortedGoals = [...sequentialGoals].sort((a, b) => a.priority - b.priority)
  let currentGoalIdx = 0
  let lockedReserveUSD = 0

  const goalAchievementMonths = new Map<string, number>()
  const goalAchievementNamesPerMonth = new Map<number, string[]>()

  const points: {
    month: number
    label: string
    exchangeRate: number
    netWorthWithGoal: number
    netWorthWithoutGoal: number
    netWorthWithGoalReal: number
    netWorthWithoutGoalReal: number
    goalCostInDisplay: number
    achievedGoalNames: string[]
  }[] = []

  // Month 0 (Initial state)
  const initNominal =
    displayCurrency === "ARS"
      ? balanceARS + balanceUSD * fxRate
      : balanceUSD + balanceARS / fxRate

  points.push({
    month: 0,
    label: "Actual",
    exchangeRate: fxRate,
    netWorthWithGoal: initNominal,
    netWorthWithoutGoal: initNominal,
    netWorthWithGoalReal: initNominal,
    netWorthWithoutGoalReal: initNominal,
    goalCostInDisplay: 0,
    achievedGoalNames: [],
  })

  let balanceARSNoGoal = balanceARS
  let balanceUSDNoGoal = balanceUSD

  for (let m = 1; m <= horizonMonths; m++) {
    // Update Exchange rate
    fxRate = fxRate * (1 + dMonthly)

    // Add monthly savings
    balanceARS += monthlySavings.ARS
    balanceUSD += monthlySavings.USD

    balanceARSNoGoal += monthlySavings.ARS
    balanceUSDNoGoal += monthlySavings.USD

    // Track total savings added
    const savingsThisMonthInDisplay =
      displayCurrency === "ARS"
        ? monthlySavings.ARS + monthlySavings.USD * fxRate
        : monthlySavings.USD + monthlySavings.ARS / fxRate
    totalSavedInDisplayCurrency += savingsThisMonthInDisplay

    // Investment returns
    balanceARS = balanceARS * (1 + rMonthly)
    balanceUSD = balanceUSD * (1 + rMonthly)

    balanceARSNoGoal = balanceARSNoGoal * (1 + rMonthly)
    balanceUSDNoGoal = balanceUSDNoGoal * (1 + rMonthly)

    let goalCostInDisplay = 0
    const achievedNames: string[] = []

    // 1. Single Legacy Big Purchase Goal
    if (bigPurchaseGoal && m === bigPurchaseGoal.targetMonth) {
      if (bigPurchaseGoal.currency === "ARS") {
        goalCostInDisplay =
          displayCurrency === "ARS"
            ? bigPurchaseGoal.amount
            : bigPurchaseGoal.amount / fxRate
        if (balanceARS >= bigPurchaseGoal.amount) {
          balanceARS -= bigPurchaseGoal.amount
        } else {
          const deficit = bigPurchaseGoal.amount - balanceARS
          balanceARS = 0
          balanceUSD = Math.max(0, balanceUSD - deficit / fxRate)
        }
      } else {
        goalCostInDisplay =
          displayCurrency === "USD"
            ? bigPurchaseGoal.amount
            : bigPurchaseGoal.amount * fxRate
        if (balanceUSD >= bigPurchaseGoal.amount) {
          balanceUSD -= bigPurchaseGoal.amount
        } else {
          const deficit = bigPurchaseGoal.amount - balanceUSD
          balanceUSD = 0
          balanceARS = Math.max(0, balanceARS - deficit * fxRate)
        }
      }
      achievedNames.push(bigPurchaseGoal.name)
    }

    // 2. Sequential Cascading Goals Check
    while (currentGoalIdx < sortedGoals.length) {
      const activeGoal = sortedGoals[currentGoalIdx]
      const goalCostUSD =
        activeGoal.currency === "USD"
          ? activeGoal.amount
          : activeGoal.amount / fxRate

      // Total net worth available in USD equivalent
      const netWorthUSD = balanceUSD + balanceARS / fxRate
      const availableNetWorthUSD = Math.max(0, netWorthUSD - lockedReserveUSD)

      if (availableNetWorthUSD < goalCostUSD) {
        break // Not enough free capital for this goal yet
      }

      // Goal achieved!
      goalAchievementMonths.set(activeGoal.id, m)
      achievedNames.push(activeGoal.name)

      if (!goalAchievementNamesPerMonth.has(m)) {
        goalAchievementNamesPerMonth.set(m, [])
      }
      goalAchievementNamesPerMonth.get(m)?.push(activeGoal.name)

      // Handle goal completion type:
      if (activeGoal.type === "purchase") {
        // Deduct purchase cost from liquid balances (ARS then USD, or USD then ARS)
        if (activeGoal.currency === "ARS") {
          const costARS = activeGoal.amount
          if (balanceARS >= costARS) {
            balanceARS -= costARS
          } else {
            const deficitARS = costARS - balanceARS
            balanceARS = 0
            const deficitUSD = deficitARS / fxRate
            balanceUSD = Math.max(0, balanceUSD - deficitUSD)
          }
        } else {
          const costUSD = activeGoal.amount
          if (balanceUSD >= costUSD) {
            balanceUSD -= costUSD
          } else {
            const deficitUSD = costUSD - balanceUSD
            balanceUSD = 0
            const deficitARS = deficitUSD * fxRate
            balanceARS = Math.max(0, balanceARS - deficitARS)
          }
        }
      } else if (activeGoal.type === "reserve") {
        // Lock reserve capital so future goals accumulate on top of it
        lockedReserveUSD += goalCostUSD
      }

      // Advance to next sequential goal
      currentGoalIdx++
    }

    // Nominal Net Worth
    const nominalWithGoal =
      displayCurrency === "ARS"
        ? balanceARS + balanceUSD * fxRate
        : balanceUSD + balanceARS / fxRate

    const nominalNoGoal =
      displayCurrency === "ARS"
        ? balanceARSNoGoal + balanceUSDNoGoal * fxRate
        : balanceUSDNoGoal + balanceARSNoGoal / fxRate

    // Inflation Discount Factor (real purchasing power)
    const discountFactor = Math.pow(1 + iMonthly, -m)

    const realWithGoal = nominalWithGoal * discountFactor
    const realNoGoal = nominalNoGoal * discountFactor

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
      netWorthWithGoalReal: Math.max(0, realWithGoal),
      netWorthWithoutGoalReal: Math.max(0, realNoGoal),
      goalCostInDisplay,
      achievedGoalNames: achievedNames,
    })
  }

  return { points, totalSavedInDisplayCurrency, goalAchievementMonths }
}

/**
 * Main Engine Function: runs simulation across 3 scenarios
 */
export function runSimulation(params: SimulationParams): SimulationResult {
  const {
    annualInflationRate,
    annualDevaluationRate,
    annualInvestmentReturnRate,
    bigPurchaseGoal,
    sequentialGoals = [],
    isRealTerms = false,
    displayCurrency,
  } = params

  // 1. Configure 3 Scenarios
  const pessimisticConfig: ScenarioConfig = {
    inflationRate: Math.max(0, annualInflationRate * 1.2),
    devaluationRate: Math.max(0, annualDevaluationRate * 1.2),
    returnRate:
      annualInvestmentReturnRate >= 0
        ? annualInvestmentReturnRate * 0.7
        : annualInvestmentReturnRate * 1.3,
  }

  const neutralConfig: ScenarioConfig = {
    inflationRate: Math.max(0, annualInflationRate),
    devaluationRate: Math.max(0, annualDevaluationRate),
    returnRate: annualInvestmentReturnRate,
  }

  const optimisticConfig: ScenarioConfig = {
    inflationRate: Math.max(0, annualInflationRate * 0.85),
    devaluationRate: Math.max(0, annualDevaluationRate * 0.85),
    returnRate:
      annualInvestmentReturnRate >= 0
        ? annualInvestmentReturnRate * 1.25
        : annualInvestmentReturnRate * 0.75,
  }

  const pSim = calculateScenarioTimeline(params, pessimisticConfig)
  const nSim = calculateScenarioTimeline(params, neutralConfig)
  const oSim = calculateScenarioTimeline(params, optimisticConfig)

  // 2. Build Timeline Array
  const timeline: ScenarioPoint[] = []
  const len = pSim.points.length

  for (let i = 0; i < len; i++) {
    const pPoint = pSim.points[i]
    const nPoint = nSim.points[i]
    const oPoint = oSim.points[i]

    let goalCostInDisplayCurrency = 0
    if (bigPurchaseGoal && pPoint.month === bigPurchaseGoal.targetMonth) {
      if (bigPurchaseGoal.currency === displayCurrency) {
        goalCostInDisplayCurrency = bigPurchaseGoal.amount
      } else if (displayCurrency === "ARS") {
        goalCostInDisplayCurrency = bigPurchaseGoal.amount * nPoint.exchangeRate
      } else {
        goalCostInDisplayCurrency = bigPurchaseGoal.amount / nPoint.exchangeRate
      }
    }

    timeline.push({
      month: pPoint.month,
      label: pPoint.label,
      exchangeRate: nPoint.exchangeRate,

      pessimistic: isRealTerms
        ? pPoint.netWorthWithGoalReal
        : pPoint.netWorthWithGoal,
      neutral: isRealTerms
        ? nPoint.netWorthWithGoalReal
        : nPoint.netWorthWithGoal,
      optimistic: isRealTerms
        ? oPoint.netWorthWithGoalReal
        : oPoint.netWorthWithGoal,

      pessimisticPreGoal: isRealTerms
        ? pPoint.netWorthWithoutGoalReal
        : pPoint.netWorthWithoutGoal,
      neutralPreGoal: isRealTerms
        ? nPoint.netWorthWithoutGoalReal
        : nPoint.netWorthWithoutGoal,
      optimisticPreGoal: isRealTerms
        ? oPoint.netWorthWithoutGoalReal
        : oPoint.netWorthWithoutGoal,

      goalCostInDisplayCurrency,
      achievedGoalNames: nPoint.achievedGoalNames,
    })
  }

  // 3. Summaries
  const pFinal = pSim.points[pSim.points.length - 1]
  const nFinal = nSim.points[nSim.points.length - 1]
  const oFinal = oSim.points[oSim.points.length - 1]

  const finalNetWorth = {
    pessimistic: {
      finalNominal: pFinal.netWorthWithGoal,
      finalReal: pFinal.netWorthWithGoalReal,
      totalSaved: pSim.totalSavedInDisplayCurrency,
      totalReturns: Math.max(
        0,
        pFinal.netWorthWithGoal -
          pSim.points[0].netWorthWithGoal -
          pSim.totalSavedInDisplayCurrency
      ),
    },
    neutral: {
      finalNominal: nFinal.netWorthWithGoal,
      finalReal: nFinal.netWorthWithGoalReal,
      totalSaved: nSim.totalSavedInDisplayCurrency,
      totalReturns: Math.max(
        0,
        nFinal.netWorthWithGoal -
          nSim.points[0].netWorthWithGoal -
          nSim.totalSavedInDisplayCurrency
      ),
    },
    optimistic: {
      finalNominal: oFinal.netWorthWithGoal,
      finalReal: oFinal.netWorthWithGoalReal,
      totalSaved: oSim.totalSavedInDisplayCurrency,
      totalReturns: Math.max(
        0,
        oFinal.netWorthWithGoal -
          oSim.points[0].netWorthWithGoal -
          oSim.totalSavedInDisplayCurrency
      ),
    },
  }

  // 4. Sequential Goals Results Processing
  const sortedGoals = [...sequentialGoals].sort((a, b) => a.priority - b.priority)
  const sequentialGoalResults: SequentialGoalResult[] = sortedGoals.map((g) => {
    const monthNeutral = nSim.goalAchievementMonths.get(g.id)
    const monthPessimistic = pSim.goalAchievementMonths.get(g.id)
    const monthOptimistic = oSim.goalAchievementMonths.get(g.id)

    const isAchievedInHorizon = monthNeutral !== undefined

    // Calculate cost in display currency at current FX
    const initFx = params.initialExchangeRate || 1250
    const costInDisplay =
      g.currency === displayCurrency
        ? g.amount
        : displayCurrency === "ARS"
        ? g.amount * initFx
        : g.amount / initFx

    // Coverage percent at end of horizon or at target
    const currentNWDisplay = nSim.points[0].netWorthWithoutGoal
    const coveragePercent = Math.min(100, Math.round((currentNWDisplay / (costInDisplay || 1)) * 100))

    let estimatedDateLabel = "Más de 5 años"
    if (monthNeutral !== undefined) {
      estimatedDateLabel = getFutureMonthLabel(monthNeutral)
    }

    return {
      goal: g,
      estimatedMonthNeutral: monthNeutral,
      estimatedMonthPessimistic: monthPessimistic,
      estimatedMonthOptimistic: monthOptimistic,
      estimatedDateLabel,
      isAchievedInHorizon,
      coveragePercent,
      costInDisplayCurrency: costInDisplay,
    }
  })

  const nextGoal = sequentialGoalResults.find((r) => !r.isAchievedInHorizon) || sequentialGoalResults[sequentialGoalResults.length - 1] || null

  // 5. Calculate Goal Viability if a single legacy big purchase goal exists
  let goalViability: GoalViability | null = null

  if (bigPurchaseGoal) {
    const tMonth = Math.min(bigPurchaseGoal.targetMonth, timeline.length - 1)

    const pPreAtTarget = pSim.points[tMonth]?.netWorthWithoutGoal ?? 0
    const nPreAtTarget = nSim.points[tMonth]?.netWorthWithoutGoal ?? 0
    const oPreAtTarget = oSim.points[tMonth]?.netWorthWithoutGoal ?? 0

    const targetFx = nSim.points[tMonth]?.exchangeRate ?? params.initialExchangeRate
    const goalCostInDisplay =
      bigPurchaseGoal.currency === displayCurrency
        ? bigPurchaseGoal.amount
        : displayCurrency === "ARS"
        ? bigPurchaseGoal.amount * targetFx
        : bigPurchaseGoal.amount / targetFx

    const covPessimistic =
      goalCostInDisplay > 0 ? (pPreAtTarget / goalCostInDisplay) * 100 : 100
    const covNeutral =
      goalCostInDisplay > 0 ? (nPreAtTarget / goalCostInDisplay) * 100 : 100
    const covOptimistic =
      goalCostInDisplay > 0 ? (oPreAtTarget / goalCostInDisplay) * 100 : 100

    const isViablePessimistic = covPessimistic >= 100
    const isViableNeutral = covNeutral >= 100
    const isViableOptimistic = covOptimistic >= 100

    const findAchieveMonth = (simPoints: typeof nSim.points) => {
      const idx = simPoints.findIndex((pt) => {
        if (pt.month === 0) return false
        const costAtPt =
          bigPurchaseGoal.currency === displayCurrency
            ? bigPurchaseGoal.amount
            : displayCurrency === "ARS"
            ? bigPurchaseGoal.amount * pt.exchangeRate
            : bigPurchaseGoal.amount / pt.exchangeRate
        return pt.netWorthWithoutGoal >= costAtPt
      })
      return idx > -1 ? idx : undefined
    }

    const estimatedMonthPessimistic = findAchieveMonth(pSim.points)
    const estimatedMonthNeutral = findAchieveMonth(nSim.points)
    const estimatedMonthOptimistic = findAchieveMonth(oSim.points)

    let statusLabel = ""
    let variant: "success" | "warning" | "destructive" | "secondary" = "secondary"

    if (isViablePessimistic) {
      statusLabel = "Viable en todos los escenarios"
      variant = "success"
    } else if (isViableNeutral) {
      statusLabel = "Viable en escenario Neutro"
      variant = "success"
    } else if (isViableOptimistic) {
      statusLabel = "Viable solo en escenario Optimista"
      variant = "warning"
    } else {
      statusLabel = `Riesgo de déficit (${Math.round(covNeutral)}% cubierto)`
      variant = "destructive"
    }

    goalViability = {
      isViablePessimistic,
      isViableNeutral,
      isViableOptimistic,
      coveragePercentPessimistic: Math.round(covPessimistic),
      coveragePercentNeutral: Math.round(covNeutral),
      coveragePercentOptimistic: Math.round(covOptimistic),
      estimatedMonthPessimistic,
      estimatedMonthNeutral,
      estimatedMonthOptimistic,
      statusBadge: {
        label: statusLabel,
        variant,
      },
    }
  }

  return {
    timeline,
    goalViability,
    sequentialGoalResults,
    nextGoal,
    finalNetWorth,
    displayCurrency,
  }
}

