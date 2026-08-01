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
  type BigPurchaseGoal,
} from "@/lib/simulation-engine"
import { TrendingUp, Sparkles, SlidersHorizontal, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export interface ProjectionsViewProps {
  isDesktop?: boolean
}

export function ProjectionsView({ isDesktop = false }: ProjectionsViewProps) {
  const { totalsByCurrency, portfolioTotalValue, accounts } = useFinance()

  // Auto-calculated real balances from Firestore
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

  // Economic Variables (Defaults for Argentina context)
  const [annualInflation, setAnnualInflation] = useState<number>(50)
  const [annualDevaluation, setAnnualDevaluation] = useState<number>(45)
  const [annualReturn, setAnnualReturn] = useState<number>(12)
  const [exchangeRate, setExchangeRate] = useState<number>(1250)

  // Big Purchase Goal State
  const [bigPurchaseGoal, setBigPurchaseGoal] = useState<BigPurchaseGoal | null>({
    id: "default-auto",
    name: "Compra de Auto 0km",
    amount: 18000,
    currency: "USD",
    targetMonth: 24,
  })

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
      bigPurchaseGoal,
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
    bigPurchaseGoal,
    isRealTerms,
  ])

  return (
    <div className="space-y-6 pb-12">
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
                Simula la evolución de tu patrimonio en horizontes de 1 a 5 años considerando la inflación y metas de compra.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGoalModalOpen(true)}
            className="h-9 text-xs gap-1.5 font-semibold border-purple-500/40 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            {bigPurchaseGoal ? "Editar Meta" : "+ Añadir Meta"}
          </Button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <ProjectionKPIs
        simulation={simulationResult}
        displayCurrency={displayCurrency}
        horizonMonths={horizonMonths}
        bigPurchaseGoal={bigPurchaseGoal}
        isRealTerms={isRealTerms}
      />

      {/* Main Grid: Chart on Left/Top, Parameter Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Area Chart */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <ProjectionChart
            timeline={simulationResult.timeline}
            displayCurrency={displayCurrency}
            bigPurchaseGoal={bigPurchaseGoal}
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
            onAnnualInflationChange={setAnnualInflation}
            annualDevaluation={annualDevaluation}
            onAnnualDevaluationChange={setAnnualDevaluation}
            annualReturn={annualReturn}
            onAnnualReturnChange={setAnnualReturn}
            exchangeRate={exchangeRate}
            onExchangeRateChange={setExchangeRate}
            bigPurchaseGoal={bigPurchaseGoal}
            onOpenGoalModal={() => setIsGoalModalOpen(true)}
            onRemoveGoal={() => setBigPurchaseGoal(null)}
          />
        </div>
      </div>

      {/* Big Purchase Target Goal Dialog Modal */}
      <BigPurchaseModal
        open={isGoalModalOpen}
        onOpenChange={setIsGoalModalOpen}
        currentGoal={bigPurchaseGoal}
        onSaveGoal={(goal) => setBigPurchaseGoal(goal)}
        onRemoveGoal={() => setBigPurchaseGoal(null)}
        horizonMonths={horizonMonths}
      />
    </div>
  )
}
