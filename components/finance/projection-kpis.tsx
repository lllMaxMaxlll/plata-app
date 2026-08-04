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

  if (!simulation.nextGoal) return null

  return (
    <Card className="border-purple-500/40 bg-gradient-to-r from-purple-950/30 via-card/50 to-purple-950/20 backdrop-blur-xl shadow-lg">
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="size-4.5 text-purple-400" />
            <span className="font-semibold text-sm text-foreground">
              Próximo Objetivo: {simulation.nextGoal.goal.name}
            </span>
            <Badge variant="outline" className="text-xs font-bold border-purple-500/40 text-purple-300">
              {formatShort(simulation.nextGoal.goal.amount, simulation.nextGoal.goal.currency)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Fecha estimada de logro en escenario neutro:{" "}
            <strong className="text-purple-300 font-semibold">{simulation.nextGoal.estimatedDateLabel}</strong>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium self-stretch md:self-auto justify-between border-t md:border-t-0 border-border/40 pt-2 md:pt-0">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground block">Cobertura Actual</span>
            <span className="font-mono font-bold text-cyan-400 text-sm tabular-nums">
              {simulation.nextGoal.coveragePercent}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

