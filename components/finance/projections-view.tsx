"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useFinance } from "./finance-provider"
import { ProjectionControls } from "./projection-controls"
import { ProjectionChart } from "./projection-chart"
import { ProjectionKPIs } from "./projection-kpis"
import { BigPurchaseModal } from "./big-purchase-modal"
import {
  runSimulation,
  type Currency,
  type SequentialGoal,
} from "@/lib/simulation-engine"
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
  CheckCircle2,
  Clock,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatShort } from "@/lib/finance-data"

export interface ProjectionsViewProps {
  isDesktop?: boolean
}

const DEFAULT_GOALS: SequentialGoal[] = [
  {
    id: "goal-reserve",
    name: "Fondo de Reserva de Emergencia",
    amount: 2000,
    currency: "USD",
    type: "reserve",
    priority: 1,
  },
  {
    id: "goal-moto",
    name: "Compra de Moto 0km",
    amount: 7000000,
    currency: "ARS",
    type: "purchase",
    priority: 2,
  },
]

export function ProjectionsView({ isDesktop = false }: ProjectionsViewProps) {
  const {
    totalsByCurrency,
    portfolioTotalValue,
    macroSettings,
    updateMacroSettings,
    syncMacroFromApi,
  } = useFinance()

  // Auto-calculated real balances from the user's accounts
  const realARSBalance = totalsByCurrency.ARS || 0
  const realUSDBalance = (totalsByCurrency.USD || 0) + (portfolioTotalValue || 0)

  // Simulation Parameters State
  const [horizonMonths, setHorizonMonths] = useState<number>(36) // 3 years by default
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD")
  const [isRealTerms, setIsRealTerms] = useState<boolean>(true)
  const [useRealAccounts, setUseRealAccounts] = useState<boolean>(true)

  // Initial Net Worth (Manual or Synced)
  const [manualInitialARS, setManualInitialARS] = useState<number>(5000000)
  const [manualInitialUSD, setManualInitialUSD] = useState<number>(10000)

  // Monthly Savings Capacity
  const [savingsARS, setSavingsARS] = useState<number>(300000)
  const [savingsUSD, setSavingsUSD] = useState<number>(500)

  // Economic Variables
  const [annualInflation, setAnnualInflation] = useState<number>(macroSettings.annualInflation ?? 45)
  const [annualDevaluation, setAnnualDevaluation] = useState<number>(macroSettings.annualDevaluation ?? 40)
  const [annualReturn, setAnnualReturn] = useState<number>(macroSettings.annualReturn ?? 12)
  const [exchangeRate, setExchangeRate] = useState<number>(macroSettings.exchangeRate ?? 1250)

  const [isSyncingMacro, setIsSyncingMacro] = useState<boolean>(false)

  // Load from the stored macroSettings when updated
  useEffect(() => {
    if (macroSettings.exchangeRate) setExchangeRate(macroSettings.exchangeRate)
    if (macroSettings.annualInflation) setAnnualInflation(macroSettings.annualInflation)
    if (macroSettings.annualDevaluation) setAnnualDevaluation(macroSettings.annualDevaluation)
    if (macroSettings.annualReturn) setAnnualReturn(macroSettings.annualReturn)
  }, [macroSettings])

  // Auto-sync on mount if empty or stale
  useEffect(() => {
    if (!macroSettings.lastUpdated) {
      syncMacroFromApi()
    }
  }, [])

  async function handleSyncMacro() {
    setIsSyncingMacro(true)
    try {
      const res = await syncMacroFromApi()
      if (res.exchangeRate) setExchangeRate(res.exchangeRate)
      if (res.annualInflation) setAnnualInflation(res.annualInflation)
      if (res.annualDevaluation) setAnnualDevaluation(res.annualDevaluation)
      if (res.annualReturn) setAnnualReturn(res.annualReturn)
    } finally {
      setIsSyncingMacro(false)
    }
  }

  // Sequential Goals State
  const [goals, setGoals] = useState<SequentialGoal[]>(DEFAULT_GOALS)
  const [editingGoal, setEditingGoal] = useState<SequentialGoal | null>(null)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false)

  // Effective initial net worth based on sync switch
  const effectiveInitialARS = useRealAccounts ? realARSBalance : manualInitialARS
  const effectiveInitialUSD = useRealAccounts ? realUSDBalance : manualInitialUSD

  // Real-time reactive simulation calculation
  const simulationResult = useMemo(() => {
    return runSimulation({
      initialNetWorth: {
        ARS: effectiveInitialARS,
        USD: effectiveInitialUSD,
      },
      monthlySavings: {
        ARS: savingsARS,
        USD: savingsUSD,
      },
      annualInflationRate: annualInflation,
      annualDevaluationRate: annualDevaluation,
      annualInvestmentReturnRate: annualReturn,
      horizonMonths,
      displayCurrency,
      initialExchangeRate: exchangeRate,
      sequentialGoals: goals,
      isRealTerms,
    })
  }, [
    effectiveInitialARS,
    effectiveInitialUSD,
    savingsARS,
    savingsUSD,
    annualInflation,
    annualDevaluation,
    annualReturn,
    horizonMonths,
    displayCurrency,
    exchangeRate,
    goals,
    isRealTerms,
  ])

  // Sequential Goal Actions
  const handleOpenAddGoal = () => {
    setEditingGoal(null)
    setIsGoalModalOpen(true)
  }

  const handleOpenEditGoal = (g: SequentialGoal) => {
    setEditingGoal(g)
    setIsGoalModalOpen(true)
  }

  const handleSaveGoal = (goalToSave: SequentialGoal) => {
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === goalToSave.id)
      if (exists) {
        return prev.map((g) => (g.id === goalToSave.id ? goalToSave : g))
      }
      return [...prev, goalToSave]
    })
  }

  const handleRemoveGoal = (idToRemove: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== idToRemove))
  }

  const handleMovePriority = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= goals.length) return

    const newGoals = [...goals]
    const temp = newGoals[index]
    newGoals[index] = newGoals[targetIndex]
    newGoals[targetIndex] = temp

    // Reassign priorities
    const reordered = newGoals.map((g, idx) => ({ ...g, priority: idx + 1 }))
    setGoals(reordered)
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenAddGoal}
              className="h-7 text-xs gap-1 border-purple-500/40 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
            >
              <Plus className="size-3.5" /> Nueva Meta
            </Button>
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
                + Crear primera meta (ej. Fondo de Reserva de $2.000 USD)
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
                            variant={goal.type === "reserve" ? "secondary" : "outline"}
                            className="text-[10px] font-mono gap-1"
                          >
                            {goal.type === "reserve" ? (
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

                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                          <span>
                            Monto: <strong className="text-foreground">{formatShort(goal.amount, goal.currency)}</strong>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Calendar className="size-3" />
                            {estimatedDateLabel}
                          </span>
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
            onHorizonChange={setHorizonMonths}
            displayCurrency={displayCurrency}
            onCurrencyChange={setDisplayCurrency}
            isRealTerms={isRealTerms}
            onRealTermsChange={setIsRealTerms}
            useRealAccounts={useRealAccounts}
            onUseRealAccountsChange={setUseRealAccounts}
            initialARS={effectiveInitialARS}
            onInitialARSChange={setManualInitialARS}
            initialUSD={effectiveInitialUSD}
            onInitialUSDChange={setManualInitialUSD}
            savingsARS={savingsARS}
            onSavingsARSChange={setSavingsARS}
            savingsUSD={savingsUSD}
            onSavingsUSDChange={setSavingsUSD}
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
            annualReturn={annualReturn}
            onAnnualReturnChange={(val) => {
              setAnnualReturn(val)
              updateMacroSettings({ annualReturn: val })
            }}
            exchangeRate={exchangeRate}
            onExchangeRateChange={(val) => {
              setExchangeRate(val)
              updateMacroSettings({ exchangeRate: val })
            }}
            onOpenGoalModal={handleOpenAddGoal}
            onRemoveGoal={() => setGoals([])}
            onSyncMacro={handleSyncMacro}
            isSyncingMacro={isSyncingMacro}
            lastMacroSyncDate={macroSettings.lastUpdated}
            dollarRates={macroSettings.rates}
          />
        </div>
      </div>

      {/* Modal Dialog to Create or Edit Sequential Goals */}
      <BigPurchaseModal
        open={isGoalModalOpen}
        onOpenChange={setIsGoalModalOpen}
        currentGoal={editingGoal}
        onSaveGoal={handleSaveGoal}
        onRemoveGoal={() => editingGoal && handleRemoveGoal(editingGoal.id)}
        priorityCount={goals.length}
      />
    </div>
  )
}

