"use client"

import React from "react"
import { CheckCircle2, PiggyBank, Target, TrendingUp } from "lucide-react"
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
    <section className="rounded-2xl border-2 border-foreground bg-card p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </section>
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
  // Dónde cae el escenario neutro dentro del rango: el marcador de la barra.
  const spread = optimistic - pessimistic
  const neutralAt = spread > 0 ? Math.min(1, Math.max(0, (neutral - pessimistic) / spread)) : 0.5

  const hasGoals = sequentialGoalResults.length > 0

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <section className="col-span-2 rounded-3xl border-2 border-foreground bg-lime p-4 text-ink shadow-md">
        <p className="text-sm font-bold">
          En {years} {years === 1 ? "año" : "años"} tendrías
        </p>
        <p className="mt-1 text-[2.25rem] leading-none font-extrabold tracking-tighter">
          {formatShort(neutral, displayCurrency)}
        </p>
        <div className="mt-4">
          <div className="relative h-3 rounded-full border-2 border-ink bg-white">
            <span
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-ink"
              style={{ left: `${neutralAt * 100}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex justify-between gap-2 font-mono text-[11px] font-semibold">
            <span>pesimista {formatShort(pessimistic, displayCurrency)}</span>
            <span>optimista {formatShort(optimistic, displayCurrency)}</span>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10px]">{isRealTerms ? "en poder de compra de hoy" : "en valores nominales"}</p>
      </section>

      <StatTile
        icon={<PiggyBank className="size-3.5" />}
        label="Lo que ponés"
        value={formatShort(finalNetWorth.neutral.totalSaved, displayCurrency)}
        hint="Aportes, al tipo de cambio de hoy"
      />

      <StatTile
        icon={<TrendingUp className="size-3.5" />}
        label="Lo que rinde"
        value={formatShort(finalNetWorth.neutral.totalReturns, displayCurrency)}
        hint="Rendimientos, escenario neutro"
      />

      <section className="col-span-2 rounded-2xl border-2 border-foreground bg-grape p-4 text-ink xl:col-span-4">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase">
          <Target className="size-3.5" />
          Próxima meta
        </p>
        {!hasGoals ? (
          <p className="mt-1 text-sm">Todavía no cargaste metas. Agregá una y te digo cuándo llegás.</p>
        ) : !nextGoal ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
            <CheckCircle2 className="size-4" />
            Llegás a todas dentro del horizonte.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-lg font-extrabold tracking-tight">
              {nextGoal.goal.name}{" "}
              <span className="font-mono text-xs font-semibold">
                {formatShort(nextGoal.goal.amount, nextGoal.goal.currency)}
              </span>
            </p>
            <div className="min-w-48 flex-1 sm:max-w-sm">
              <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white">
                <div className="h-full bg-ink" style={{ width: `${nextGoal.coveragePercent}%` }} />
              </div>
              <p className="mt-1 font-mono text-[10px]">
                {nextGoal.coveragePercent}% cubierto con lo que tenés hoy · {nextGoal.estimatedDateLabel}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
