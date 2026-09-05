"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { useFinance } from "./finance-provider"
import { ProjectionControls } from "./projection-controls"
import { ProjectionChart } from "./projection-chart"
import { ProjectionKPIs } from "./projection-kpis"
import { GoalModal, type GoalDraft } from "./goal-modal"
import { runSimulation } from "@/lib/simulation-engine"
import { estimateMonthlySavings, sumOverdueLiabilities } from "@/lib/savings-capacity"
import {
  TrendingUp,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  ShieldCheck,
  ShoppingBag,
  Plus,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatShort, type Goal } from "@/lib/finance-data"

export function ProjectionsView() {
  const {
    totalsByCurrency,
    portfolioTotalValue,
    loading,
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

  const {
    horizonMonths,
    displayCurrency,
    isRealTerms,
    useRealAccounts,
    monthlySavingsARS,
    monthlySavingsUSD,
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

  const handleRemoveGoal = async (idToRemove: string) => {
    await deleteGoal(idToRemove)
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
  if (loading || !settingsLoaded) {
    return (
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 space-y-6"
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Proyección Financiera & Escenarios
              </h1>
              <p className="text-xs text-muted-foreground">
                Planifica tus metas secuenciales y calcula la fecha estimada de llegada según tu capacidad de ahorro.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenAddGoal}
            className="h-9 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-sm"
          >
            <Plus className="size-3.5" />
            Añadir Meta a la Secuencia
          </Button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <ProjectionKPIs
        simulation={simulationResult}
        displayCurrency={displayCurrency}
        horizonMonths={horizonMonths}
        isRealTerms={isRealTerms}
      />

      {/* Sequential Goals Cascading Timeline Card */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-4.5 text-purple-400" />
                Línea de Tiempo de Metas Secuenciales (En Cascada)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las metas se completan una detrás de otra. Al cumplir una, tus ahorros libres se reorientan automáticamente a la siguiente.
              </p>
            </div>

          </div>
        </CardHeader>

        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-dashed border-border/60 bg-muted/10">
              <p className="text-xs text-muted-foreground mb-3">
                Aún no has agregado metas a tu secuencia de ahorro.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenAddGoal}
                className="h-8 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
              >
                + Crear mi primera meta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {simulationResult.sequentialGoalResults.map((res, idx) => {
                const { goal, estimatedDateLabel, isAchievedInHorizon, coveragePercent, costInDisplayCurrency } = res

                return (
                  <div
                    key={goal.id}
                    className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                      isAchievedInHorizon
                        ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                        : "border-border/60 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-muted-foreground shrink-0 border border-border">
                        {idx + 1}º
                      </span>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">
                            {goal.name}
                          </span>
                          <Badge
                            variant={goal.kind === "reserve" ? "secondary" : "outline"}
                            className="text-[10px] font-mono gap-1"
                          >
                            {goal.kind === "reserve" ? (
                              <>
                                <ShieldCheck className="size-3 text-emerald-500" /> Reserva
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="size-3 text-purple-400" /> Compra
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono flex-wrap">
                          <span>
                            Monto: <strong className="text-foreground">{formatShort(goal.amount, goal.currency)}</strong>
                          </span>
                          <span aria-hidden>•</span>
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Calendar className="size-3" />
                            {estimatedDateLabel}
                          </span>
                          {isAchievedInHorizon && goal.currency !== displayCurrency && (
                            <>
                              <span aria-hidden>•</span>
                              <span title="Costo estimado al momento de alcanzarla, ya inflacionado y al tipo de cambio proyectado">
                                ≈ {formatShort(costInDisplayCurrency, displayCurrency)} de ese momento
                              </span>
                            </>
                          )}
                          {!isAchievedInHorizon && (
                            <>
                              <span aria-hidden>•</span>
                              <span>{coveragePercent}% cubierto</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                      {/* Priority Controls & Edit/Delete */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMovePriority(idx, "up")}
                          className="size-9 sm:size-7 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                          title="Subir prioridad"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === goals.length - 1}
                          onClick={() => handleMovePriority(idx, "down")}
                          className="size-9 sm:size-7 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                          title="Bajar prioridad"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditGoal(goal)}
                          className="size-9 sm:size-7 text-muted-foreground hover:text-primary cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveGoal(goal.id)}
                          className="size-9 sm:size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                // Al pasar a manual arrancamos del saldo real, para no tirar al
                // usuario a un número inventado que no es su patrimonio.
                ...(useReal
                  ? {}
                  : {
                      manualInitialARS: manualInitialARS ?? netARSBalance,
                      manualInitialUSD: manualInitialUSD ?? netLiquidUSD,
                    }),
              })
            }
            initialARS={effectiveInitialARS}
            onInitialARSChange={(val) => updateProjectionSettings({ manualInitialARS: val })}
            initialUSD={effectiveInitialUSD}
            onInitialUSDChange={(val) => updateProjectionSettings({ manualInitialUSD: val })}
            savingsARS={monthlySavingsARS}
            onSavingsARSChange={(val) => updateProjectionSettings({ monthlySavingsARS: val })}
            savingsUSD={monthlySavingsUSD}
            onSavingsUSDChange={(val) => updateProjectionSettings({ monthlySavingsUSD: val })}
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
            onUseEstimatedSavings={() =>
              updateProjectionSettings({
                monthlySavingsARS: savingsEstimate.ARS,
                monthlySavingsUSD: savingsEstimate.USD,
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
        onRemoveGoal={async () => {
          if (editingGoal) await handleRemoveGoal(editingGoal.id)
        }}
      />
    </div>
  )
}

