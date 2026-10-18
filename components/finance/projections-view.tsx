"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { useConfirm } from "./confirm-dialog"
import { ProjectionControls } from "./projection-controls"
import { ProjectionChart } from "./projection-chart"
import { ProjectionKPIs } from "./projection-kpis"
import { GoalModal, type GoalDraft } from "./goal-modal"
import { runSimulation } from "@/lib/simulation-engine"
import { estimateMonthlySavings, sumOverdueLiabilities } from "@/lib/savings-capacity"
import {
  Target,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  ShieldCheck,
  ShoppingBag,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatShort, type Goal } from "@/lib/finance-data"
import { pageClass } from "./lucas-ui"
import { cn } from "@/lib/utils"

export function ProjectionsView() {
  const {
    totalsByCurrency,
    portfolioTotalValue,
    loading,
    dataLoaded,
    accounts,
    transactions,
    dueItems,
    macroSettings,
    settingsLoaded,
    updateMacroSettings,
    syncMacroFromApi,
    projectionSettings,
    updateProjectionSettings,
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    reorderGoals,
  } = useFinance()
  const confirm = useConfirm()

  // Saldos reales, calculados desde las cuentas del usuario. La cartera va
  // aparte: suma al patrimonio, pero no es plata con la que se pueda pagar una
  // meta sin vender antes.
  const realARSBalance = totalsByCurrency.ARS || 0
  const realLiquidUSD = totalsByCurrency.USD || 0
  const portfolioUSD = portfolioTotalValue || 0

  // Lo que ya se debe sale del patrimonio: sin esto, "patrimonio neto" no era
  // neto. Los vencimientos futuros no se restan porque ya los absorbe el ahorro
  // mensual, y contarlos acá sería contarlos dos veces.
  const overdue = useMemo(() => sumOverdueLiabilities(dueItems), [dueItems])
  const netARSBalance = Math.max(0, realARSBalance - overdue.ARS)
  const netLiquidUSD = Math.max(0, realLiquidUSD - overdue.USD)

  // Capacidad de ahorro deducida de los movimientos reales, para no depender de
  // un número escrito a mano.
  const savingsEstimate = useMemo(
    () => estimateMonthlySavings(transactions, accounts),
    [transactions, accounts]
  )

  // Mientras el usuario no fije el ahorro a mano, sale de sus movimientos. Antes
  // arrancaba en cero y con cero ahorro ninguna meta se alcanza nunca: la página
  // informaba "no se alcanza en 36 meses" para metas que llegaban en 4.
  const usesEstimatedSavings =
    projectionSettings.monthlySavingsSource === "auto" && savingsEstimate.monthsUsed > 0
  const monthlySavingsARS = usesEstimatedSavings
    ? savingsEstimate.ARS
    : projectionSettings.monthlySavingsARS
  const monthlySavingsUSD = usesEstimatedSavings
    ? savingsEstimate.USD
    : projectionSettings.monthlySavingsUSD

  const {
    horizonMonths,
    displayCurrency,
    isRealTerms,
    useRealAccounts,
    manualInitialARS,
    manualInitialUSD,
    annualReturnARS,
    annualReturnUSD,
  } = projectionSettings

  // Variables macro: estado local espejado contra user_settings, porque los
  // sliders necesitan responder en el mismo frame.
  const [annualInflation, setAnnualInflation] = useState<number>(macroSettings.annualInflation ?? 45)
  const [annualDevaluation, setAnnualDevaluation] = useState<number>(macroSettings.annualDevaluation ?? 40)
  const [exchangeRate, setExchangeRate] = useState<number>(macroSettings.exchangeRate ?? 1250)

  const [isSyncingMacro, setIsSyncingMacro] = useState<boolean>(false)

  // Bajamos lo guardado en user_settings al estado local. Va con Number.isFinite
  // y no con un chequeo truthy: 0 es un valor válido (retorno 0%, devaluación 0%)
  // y antes se descartaba, así que la pantalla mostraba el default mientras la
  // base tenía un 0 guardado.
  useEffect(() => {
    if (Number.isFinite(macroSettings.exchangeRate)) setExchangeRate(macroSettings.exchangeRate)
    if (Number.isFinite(macroSettings.annualInflation)) setAnnualInflation(macroSettings.annualInflation)
    if (Number.isFinite(macroSettings.annualDevaluation)) setAnnualDevaluation(macroSettings.annualDevaluation)
  }, [macroSettings])

  // Primera cotización para quien todavía no tiene preferencias guardadas.
  // Espera a settingsLoaded: al montar, macroSettings son los defaults del
  // provider (lastUpdated vacío), así que sin esa guarda la condición daba
  // siempre verdadera y se sincronizaba en cada visita.
  const didAutoSync = useRef(false)
  useEffect(() => {
    if (!settingsLoaded || didAutoSync.current) return
    didAutoSync.current = true
    if (!macroSettings.lastUpdated) syncMacroFromApi()
  }, [settingsLoaded, macroSettings.lastUpdated, syncMacroFromApi])

  async function handleSyncMacro() {
    setIsSyncingMacro(true)
    try {
      const res = await syncMacroFromApi()
      if (Number.isFinite(res.exchangeRate)) setExchangeRate(res.exchangeRate)
    } finally {
      setIsSyncingMacro(false)
    }
  }

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false)

  // Con el switch de sincronización apagado usamos el patrimonio manual; si el
  // usuario todavía no cargó ninguno, arrancamos del saldo real en vez de un
  // número inventado.
  const effectiveInitialARS = useRealAccounts ? netARSBalance : manualInitialARS ?? netARSBalance
  const effectiveInitialUSD = useRealAccounts ? netLiquidUSD : manualInitialUSD ?? netLiquidUSD
  const effectivePortfolioUSD = useRealAccounts ? portfolioUSD : 0

  const simulationResult = useMemo(() => {
    return runSimulation({
      initialNetWorth: {
        ARS: effectiveInitialARS,
        USD: effectiveInitialUSD,
      },
      illiquidNetWorth: {
        ARS: 0,
        USD: effectivePortfolioUSD,
      },
      monthlySavings: {
        ARS: monthlySavingsARS,
        USD: monthlySavingsUSD,
      },
      annualInflationRate: annualInflation,
      annualDevaluationRate: annualDevaluation,
      annualReturnARS,
      annualReturnUSD,
      horizonMonths,
      displayCurrency,
      initialExchangeRate: exchangeRate,
      sequentialGoals: goals,
      isRealTerms,
    })
  }, [
    effectiveInitialARS,
    effectiveInitialUSD,
    effectivePortfolioUSD,
    monthlySavingsARS,
    monthlySavingsUSD,
    annualInflation,
    annualDevaluation,
    annualReturnARS,
    annualReturnUSD,
    horizonMonths,
    displayCurrency,
    exchangeRate,
    goals,
    isRealTerms,
  ])

  const handleOpenAddGoal = () => {
    setEditingGoal(null)
    setIsGoalModalOpen(true)
  }

  const handleOpenEditGoal = (g: Goal) => {
    setEditingGoal(g)
    setIsGoalModalOpen(true)
  }

  const handleSaveGoal = async (draft: GoalDraft) => {
    if (editingGoal) await updateGoal(editingGoal.id, draft)
    else await addGoal(draft)
  }

  const handleRemoveGoal = async (goal: { id: string; name: string }) => {
    const confirmed = await confirm({ title: `¿Eliminar la meta "${goal.name}"?` })
    if (!confirmed) return false
    await deleteGoal(goal.id)
    return true
  }

  const handleMovePriority = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= goals.length) return

    const orderedIds = goals.map((g) => g.id)
    const temp = orderedIds[index]
    orderedIds[index] = orderedIds[targetIndex]
    orderedIds[targetIndex] = temp

    void reorderGoals(orderedIds)
  }

  // Sin esto, el primer render simulaba con las cuentas todavía vacías: se veía
  // un patrimonio de $0 y un gráfico plano que un instante después pegaba un
  // salto.
  if (loading || !settingsLoaded || !dataLoaded) {
    return (
      <div
        className={cn(pageClass, "space-y-6")}
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Cargando tu proyección…</span>
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 xl:col-span-8 h-80 rounded-xl" />
          <Skeleton className="lg:col-span-5 xl:col-span-4 h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(pageClass, "space-y-6")}>
      {/* Header Banner */}
      <PageHeader
        route="projections"
        description="Cuándo llegás a cada meta con lo que ahorrás hoy."
        actions={
          <Button onClick={handleOpenAddGoal}>
            <Plus className="size-4" />
            Nueva meta
          </Button>
        }
      />

      {/* KPI Cards Summary */}
      <ProjectionKPIs
        simulation={simulationResult}
        displayCurrency={displayCurrency}
        horizonMonths={horizonMonths}
        isRealTerms={isRealTerms}
      />

      {/* Metas en orden: se cumplen una detrás de otra */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-extrabold tracking-tight">Tus metas, en orden</h2>
          <p className="text-xs text-muted-foreground">
            Se cumplen una detrás de otra: cuando llegás a una, el ahorro pasa a la siguiente.
          </p>
        </div>

        {goals.length === 0 ? (
          <button
            type="button"
            onClick={handleOpenAddGoal}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/40 px-4 py-8 text-center transition-colors hover:bg-grape/25"
          >
            <Target className="size-6" />
            <span className="font-bold">Poné tu primera meta</span>
            <span className="text-xs text-muted-foreground">Un viaje, un auto, un fondo de emergencia. Te digo cuándo llegás.</span>
          </button>
        ) : (
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {simulationResult.sequentialGoalResults.map((res, idx) => {
              const { goal, estimatedDateLabel, isAchievedInHorizon, coveragePercent, costInDisplayCurrency } = res
              return (
                <li
                  key={goal.id}
                  className={cn(
                    "flex flex-col rounded-2xl border-2 p-4",
                    isAchievedInHorizon ? "border-foreground bg-card" : "border-dashed border-foreground/50 bg-transparent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-lime font-mono text-sm font-bold text-ink">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold">{goal.name}</p>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border-[1.5px] border-foreground px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {goal.kind === "reserve" ? <ShieldCheck className="size-3" /> : <ShoppingBag className="size-3" />}
                        {goal.kind === "reserve" ? "reserva" : "compra"}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold">{formatShort(goal.amount, goal.currency)}</span>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">{isAchievedInHorizon ? "Llegás en" : "Dentro del horizonte no llegás"}</p>
                  <p className="text-lg font-extrabold tracking-tight">{estimatedDateLabel}</p>
                  {isAchievedInHorizon && goal.currency !== displayCurrency && (
                    <p
                      className="font-mono text-[10px] text-muted-foreground"
                      title="Costo estimado al momento de alcanzarla, ya inflacionado y al tipo de cambio proyectado"
                    >
                      ≈ {formatShort(costInDisplayCurrency, displayCurrency)} de ese momento
                    </p>
                  )}

                  <div className="mt-3 h-2 overflow-hidden rounded-full border-[1.5px] border-foreground bg-background">
                    <div className="h-full bg-grape" style={{ width: `${coveragePercent}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{coveragePercent}% cubierto con lo que tenés hoy</p>

                  <div className="mt-3 flex items-center gap-1 border-t-[1.5px] border-dashed border-foreground/15 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === 0}
                      onClick={() => handleMovePriority(idx, "up")}
                      aria-label={`Subir prioridad de ${goal.name}`}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={idx === goals.length - 1}
                      onClick={() => handleMovePriority(idx, "down")}
                      aria-label={`Bajar prioridad de ${goal.name}`}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleOpenEditGoal(goal)}
                      aria-label={`Editar ${goal.name}`}
                      className="ml-auto"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveGoal(goal)}
                      aria-label={`Eliminar ${goal.name}`}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* Main Grid: Chart on Left/Top, Parameter Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Area Chart */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <ProjectionChart
            timeline={simulationResult.timeline}
            displayCurrency={displayCurrency}
            isRealTerms={isRealTerms}
          />
        </div>

        {/* Right Column: Parameter Controls Panel */}
        <div className="lg:col-span-5 xl:col-span-4">
          <ProjectionControls
            horizonMonths={horizonMonths}
            onHorizonChange={(months) => updateProjectionSettings({ horizonMonths: months })}
            displayCurrency={displayCurrency}
            onCurrencyChange={(currency) => updateProjectionSettings({ displayCurrency: currency })}
            isRealTerms={isRealTerms}
            onRealTermsChange={(real) => updateProjectionSettings({ isRealTerms: real })}
            useRealAccounts={useRealAccounts}
            onUseRealAccountsChange={(useReal) =>
              updateProjectionSettings({
                useRealAccounts: useReal,
                // Al pasar a manual se copian los saldos reales del momento, sin
                // "?? ": un 0 guardado no es lo mismo que "sin definir", y con el
                // ?? quedaba clavado en cero para siempre.
                ...(useReal
                  ? {}
                  : { manualInitialARS: netARSBalance, manualInitialUSD: netLiquidUSD }),
              })
            }
            initialARS={effectiveInitialARS}
            onInitialARSChange={(val) => updateProjectionSettings({ manualInitialARS: val })}
            initialUSD={effectiveInitialUSD}
            onInitialUSDChange={(val) => updateProjectionSettings({ manualInitialUSD: val })}
            savingsARS={monthlySavingsARS}
            onSavingsARSChange={(val) =>
              updateProjectionSettings({ monthlySavingsARS: val, monthlySavingsSource: "manual" })
            }
            savingsUSD={monthlySavingsUSD}
            onSavingsUSDChange={(val) =>
              updateProjectionSettings({ monthlySavingsUSD: val, monthlySavingsSource: "manual" })
            }
            annualInflation={annualInflation}
            onAnnualInflationChange={(val) => {
              setAnnualInflation(val)
              updateMacroSettings({ annualInflation: val })
            }}
            annualDevaluation={annualDevaluation}
            onAnnualDevaluationChange={(val) => {
              setAnnualDevaluation(val)
              updateMacroSettings({ annualDevaluation: val })
            }}
            annualReturnARS={annualReturnARS}
            onAnnualReturnARSChange={(val) => updateProjectionSettings({ annualReturnARS: val })}
            annualReturnUSD={annualReturnUSD}
            onAnnualReturnUSDChange={(val) => updateProjectionSettings({ annualReturnUSD: val })}
            portfolioUSD={effectivePortfolioUSD}
            overdueARS={useRealAccounts ? overdue.ARS : 0}
            overdueUSD={useRealAccounts ? overdue.USD : 0}
            savingsEstimate={savingsEstimate}
            usesEstimatedSavings={usesEstimatedSavings}
            onUseEstimatedSavings={() => updateProjectionSettings({ monthlySavingsSource: "auto" })}
            realARSBalance={netARSBalance}
            realLiquidUSD={netLiquidUSD}
            onUseRealBalances={() =>
              updateProjectionSettings({
                manualInitialARS: netARSBalance,
                manualInitialUSD: netLiquidUSD,
              })
            }
            exchangeRate={exchangeRate}
            onExchangeRateChange={(val) => {
              setExchangeRate(val)
              updateMacroSettings({ exchangeRate: val })
            }}
            onSyncMacro={handleSyncMacro}
            isSyncingMacro={isSyncingMacro}
            lastMacroSyncDate={macroSettings.lastUpdated}
            dollarRates={macroSettings.rates}
          />
        </div>
      </div>

      {/* Modal Dialog to Create or Edit Sequential Goals */}
      <GoalModal
        open={isGoalModalOpen}
        onOpenChange={setIsGoalModalOpen}
        currentGoal={editingGoal}
        onSaveGoal={handleSaveGoal}
        onRemoveGoal={async () => (editingGoal ? handleRemoveGoal(editingGoal) : false)}
      />
    </div>
  )
}

