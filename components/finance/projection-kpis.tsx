"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Target, PiggyBank, TrendingUp, Wallet, CheckCircle2 } from "lucide-react"
import { type SimulationResult, type Currency } from "@/lib/simulation-engine"
import { formatShort } from "@/lib/finance-data"

export interface ProjectionKPIsProps {
  simulation: SimulationResult
  displayCurrency: Currency
  horizonMonths: number
  isRealTerms?: boolean
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: React.ReactNode
}) {
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-[11px] font-medium">{label}</span>
        </div>
        <p className="text-xl font-semibold text-foreground">{value}</p>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export function ProjectionKPIs({
  simulation,
  displayCurrency,
  horizonMonths,
  isRealTerms = false,
}: ProjectionKPIsProps) {
  const { finalNetWorth, nextGoal, sequentialGoalResults } = simulation
  const years = horizonMonths / 12

  const pick = (s: { finalNominal: number; finalReal: number }) =>
    isRealTerms ? s.finalReal : s.finalNominal

  const neutral = pick(finalNetWorth.neutral)
  const pessimistic = pick(finalNetWorth.pessimistic)
  const optimistic = pick(finalNetWorth.optimistic)

  const hasGoals = sequentialGoalResults.length > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatTile
        icon={<Wallet className="size-3.5" />}
        label={`Patrimonio a ${years} ${years === 1 ? "año" : "años"}`}
        value={formatShort(neutral, displayCurrency)}
        hint={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
              Pesimista {formatShort(pessimistic, displayCurrency)}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Optimista {formatShort(optimistic, displayCurrency)}
            </span>
          </span>
        }
      />

      <StatTile
        icon={<PiggyBank className="size-3.5" />}
        label="Aportes acumulados"
        value={formatShort(finalNetWorth.neutral.totalSaved, displayCurrency)}
        hint="Lo que ponés vos, a tipo de cambio de hoy"
      />

      <StatTile
        icon={<TrendingUp className="size-3.5" />}
        label="Rendimientos acumulados"
        value={formatShort(finalNetWorth.neutral.totalReturns, displayCurrency)}
        hint="Lo que genera el capital, escenario neutro"
      />

      <Card className="border-purple-500/40 bg-purple-500/5 backdrop-blur-xl shadow-sm">
        <CardContent className="p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="size-3.5" />
            <span className="text-[11px] font-medium">Próximo objetivo</span>
          </div>

          {!hasGoals ? (
            <p className="text-xs text-muted-foreground pt-1">
              Todavía no cargaste metas. Agregá una para ver la fecha estimada de llegada.
            </p>
          ) : !nextGoal ? (
            <div className="flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <p className="text-xs font-medium text-foreground">
                Toda la secuencia entra en el horizonte.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground truncate">
                  {nextGoal.goal.name}
                </p>
                <Badge variant="outline" className="text-[10px] font-mono border-purple-500/40">
                  {formatShort(nextGoal.goal.amount, nextGoal.goal.currency)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{nextGoal.estimatedDateLabel}</p>
              <div className="pt-1 space-y-1">
                <Progress value={nextGoal.coveragePercent} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {nextGoal.coveragePercent}% de la secuencia hasta acá, cubierto con tu capital
                  líquido de hoy
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
