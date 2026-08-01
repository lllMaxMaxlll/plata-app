"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  Target,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowUpRight
} from "lucide-react"
import {
  type SimulationResult,
  type Currency,
  type BigPurchaseGoal,
} from "@/lib/simulation-engine"
import { formatShort } from "@/lib/finance-data"

export interface ProjectionKPIsProps {
  simulation: SimulationResult
  displayCurrency: Currency
  horizonMonths: number
  bigPurchaseGoal?: BigPurchaseGoal | null
  isRealTerms?: boolean
}

export function ProjectionKPIs({
  simulation,
  displayCurrency,
  horizonMonths,
  bigPurchaseGoal,
  isRealTerms = false,
}: ProjectionKPIsProps) {
  const { finalNetWorth, goalViability } = simulation
  const horizonYears = horizonMonths / 12

  const getBadgeVariant = (variant: string) => {
    switch (variant) {
      case "success":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      case "warning":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30"
      case "destructive":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Neutral Scenario Main KPI */}
      <Card className="border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-card/40 backdrop-blur-xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <TrendingUp className="size-20 text-cyan-400" />
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Escenario Neutro (Base)
            </span>
            <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-400">
              {horizonYears} {horizonYears === 1 ? "Año" : "Años"}
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-1">
            {formatShort(
              isRealTerms
                ? finalNetWorth.neutral.finalReal
                : finalNetWorth.neutral.finalNominal,
              displayCurrency
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Ahorro total aportado:</span>
            <strong className="text-foreground tabular-nums">
              {formatShort(finalNetWorth.neutral.totalSaved, displayCurrency)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Retorno de inversión:</span>
            <strong className="text-emerald-400 tabular-nums">
              +{formatShort(finalNetWorth.neutral.totalReturns, displayCurrency)}
            </strong>
          </div>
        </CardContent>
      </Card>

      {/* 2. Optimistic Scenario KPI */}
      <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Escenario Optimista
            </span>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
              +25% Rend. / -15% Infl.
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-emerald-400 tabular-nums mt-1">
            {formatShort(
              isRealTerms
                ? finalNetWorth.optimistic.finalReal
                : finalNetWorth.optimistic.finalNominal,
              displayCurrency
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Diferencia vs Neutro:</span>
            <strong className="text-emerald-400 tabular-nums">
              +
              {formatShort(
                (isRealTerms
                  ? finalNetWorth.optimistic.finalReal
                  : finalNetWorth.optimistic.finalNominal) -
                  (isRealTerms
                    ? finalNetWorth.neutral.finalReal
                    : finalNetWorth.neutral.finalNominal),
                displayCurrency
              )}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Retorno estimado:</span>
            <strong className="text-emerald-400 tabular-nums">
              +{formatShort(finalNetWorth.optimistic.totalReturns, displayCurrency)}
            </strong>
          </div>
        </CardContent>
      </Card>

      {/* 3. Pessimistic Scenario KPI */}
      <Card className="border-rose-500/30 bg-gradient-to-b from-rose-950/20 to-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Escenario Pesimista
            </span>
            <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-400">
              -30% Rend. / +20% Infl.
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-rose-400 tabular-nums mt-1">
            {formatShort(
              isRealTerms
                ? finalNetWorth.pessimistic.finalReal
                : finalNetWorth.pessimistic.finalNominal,
              displayCurrency
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Diferencia vs Neutro:</span>
            <strong className="text-rose-400 tabular-nums">
              {formatShort(
                (isRealTerms
                  ? finalNetWorth.pessimistic.finalReal
                  : finalNetWorth.pessimistic.finalNominal) -
                  (isRealTerms
                    ? finalNetWorth.neutral.finalReal
                    : finalNetWorth.neutral.finalNominal),
                displayCurrency
              )}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Retorno estimado:</span>
            <strong className="text-rose-400 tabular-nums">
              +{formatShort(finalNetWorth.pessimistic.totalReturns, displayCurrency)}
            </strong>
          </div>
        </CardContent>
      </Card>

      {/* Goal Viability Assessment Bar (if goal exists) */}
      {bigPurchaseGoal && goalViability && (
        <Card className="md:col-span-3 border-purple-500/40 bg-gradient-to-r from-purple-950/30 via-card/50 to-purple-950/20 backdrop-blur-xl shadow-lg">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="size-4.5 text-purple-400" />
                <span className="font-semibold text-sm text-foreground">
                  Diagnóstico de Viabilidad: {bigPurchaseGoal.name}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeVariant(goalViability.statusBadge.variant)}`}>
                  {goalViability.statusBadge.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Costo: <strong className="text-foreground">{formatShort(bigPurchaseGoal.amount, bigPurchaseGoal.currency)}</strong> en el Mes {bigPurchaseGoal.targetMonth}.
                {goalViability.estimatedMonthNeutral && (
                  <span className="ml-1 text-purple-300">
                    (Alcanzable aproximadamente en el Mes {goalViability.estimatedMonthNeutral})
                  </span>
                )}
              </p>
            </div>

            {/* Coverage percentages per scenario */}
            <div className="flex items-center gap-4 text-xs font-medium self-stretch md:self-auto justify-between border-t md:border-t-0 border-border/40 pt-2 md:pt-0">
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Cobertura Pesimista</span>
                <span className={`font-bold tabular-nums ${goalViability.isViablePessimistic ? "text-emerald-400" : "text-rose-400"}`}>
                  {goalViability.coveragePercentPessimistic}%
                </span>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Cobertura Neutro</span>
                <span className={`font-bold tabular-nums ${goalViability.isViableNeutral ? "text-cyan-400" : "text-amber-400"}`}>
                  {goalViability.coveragePercentNeutral}%
                </span>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Cobertura Optimista</span>
                <span className={`font-bold tabular-nums ${goalViability.isViableOptimistic ? "text-emerald-400" : "text-rose-400"}`}>
                  {goalViability.coveragePercentOptimistic}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
