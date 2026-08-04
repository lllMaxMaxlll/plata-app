"use client"

import { useState, useMemo } from "react"
import { ArrowUpRight, TrendingUp, TrendingDown, Calendar, DollarSign } from "lucide-react"
import { formatCurrency, formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type PeriodOption = "this_month" | "last_month" | "last_30" | "all"
type CurrencyOption = "ARS" | "USD"

const PERIOD_LABELS: Record<PeriodOption, string> = {
  this_month: "Este mes",
  last_month: "Mes anterior",
  last_30: "Últimos 30d",
  all: "Histórico",
}

function getPeriodDates(period: PeriodOption, referenceDate = new Date()) {
  const now = new Date(referenceDate)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  if (period === "this_month") {
    const start = new Date(currentYear, currentMonth, 1)
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
    // Prev period for trend: last month
    const prevStart = new Date(currentYear, currentMonth - 1, 1)
    const prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59)
    return { start, end, prevStart, prevEnd }
  }

  if (period === "last_month") {
    const start = new Date(currentYear, currentMonth - 1, 1)
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59)
    // Prev period for trend: 2 months ago
    const prevStart = new Date(currentYear, currentMonth - 2, 1)
    const prevEnd = new Date(currentYear, currentMonth - 1, 0, 23, 59, 59)
    return { start, end, prevStart, prevEnd }
  }

  if (period === "last_30") {
    const end = new Date(now)
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { start, end, prevStart, prevEnd }
  }

  return { start: null, end: null, prevStart: null, prevEnd: null }
}

export function ExpenseChart({
  onSeeAnalytics,
  mask = (v) => v,
  className = "",
}: {
  onSeeAnalytics?: () => void
  mask?: (val: string) => string
  className?: string
}) {
  const { transactions, getAccount, categories, vehicles } = useFinance()
  const [period, setPeriod] = useState<PeriodOption>("this_month")
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>("ARS")

  const { rows, total, maxAmount, hasPrevData } = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getPeriodDates(period)
    const currentMap = new Map<string, number>()
    const prevMap = new Map<string, number>()

    for (const t of transactions) {
      if (t.type !== "expense") continue
      const acc = getAccount(t.accountId)
      if (!acc || acc.currency !== selectedCurrency) continue

      const tDate = new Date(t.date)
      if (isNaN(tDate.getTime())) continue

      let groupName = t.category
      if (t.vehicleId && vehicles) {
        const veh = vehicles.find((v) => v.id === t.vehicleId)
        if (veh) {
          groupName = veh.name
        }
      }

      // Check current period
      const inCurrent = !start || !end || (tDate >= start && tDate <= end)
      if (inCurrent) {
        currentMap.set(groupName, (currentMap.get(groupName) ?? 0) + t.amount)
      }

      // Check prev period for comparison
      const inPrev = prevStart && prevEnd && tDate >= prevStart && tDate <= prevEnd
      if (inPrev) {
        prevMap.set(groupName, (prevMap.get(groupName) ?? 0) + t.amount)
      }
    }

    const total = [...currentMap.values()].reduce((s, a) => s + a, 0)
    const hasPrevData = prevMap.size > 0

    const rows = [...currentMap.entries()]
      .map(([category, amount]) => {
        const pctOfTotal = total > 0 ? (amount / total) * 100 : 0
        const prevAmount = prevMap.get(category) ?? 0
        let trendPercent: number | null = null
        if (prevAmount > 0) {
          trendPercent = Math.round(((amount - prevAmount) / prevAmount) * 100)
        } else if (amount > 0 && hasPrevData) {
          trendPercent = 100
        }

        return {
          category,
          amount,
          pctOfTotal,
          trendPercent,
          prevAmount,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const maxAmount = rows[0]?.amount ?? 1

    return { rows, total, maxAmount, hasPrevData }
  }, [transactions, getAccount, vehicles, period, selectedCurrency])

  const getCategoryColor = (catName: string) => {
    const isVehicle = vehicles?.some((v) => v.name === catName)
    if (isVehicle) {
      return categories.find((c) => c.name === "Transporte")?.color ?? "var(--chart-1)"
    }
    return categories.find((c) => c.name === catName)?.color ?? "var(--chart-1)"
  }

  return (
    <section className={className}>
      <Card className="rounded-md border-border bg-card p-5 shadow-sm">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Gastos por Categoría</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Selector */}
            <div className="inline-flex rounded-md bg-muted/60 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSelectedCurrency("ARS")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  selectedCurrency === "ARS"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ARS
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency("USD")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  selectedCurrency === "USD"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                USD
              </button>
            </div>

            {onSeeAnalytics && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSeeAnalytics}
                className="text-xs font-medium text-primary hover:bg-primary/10 h-7 px-2 cursor-pointer"
              >
                Ver Análisis <ArrowUpRight className="size-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((pKey) => (
            <button
              key={pKey}
              type="button"
              onClick={() => setPeriod(pKey)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                period === pKey
                  ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
              }`}
            >
              {PERIOD_LABELS[pKey]}
            </button>
          ))}
        </div>

        {/* Total Display */}
        <div className="mt-3.5 flex items-baseline justify-between">
          <div>
            <p className="text-xl font-mono font-bold text-foreground tabular-nums tracking-tight">
              {mask(formatCurrency(total, selectedCurrency))}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Total consumido • {PERIOD_LABELS[period]}
            </p>
          </div>
          {rows.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
              {rows.length} {rows.length === 1 ? "categoría" : "categorías"}
            </span>
          )}
        </div>

        {/* Categories List */}
        {rows.length === 0 ? (
          <div className="mt-6 py-6 text-center border border-dashed border-border/60 rounded-md bg-muted/20">
            <p className="text-xs font-mono text-muted-foreground">
              Sin gastos registrados en {selectedCurrency} para {PERIOD_LABELS[period].toLowerCase()}.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3.5 font-sans">
            {rows.map((r) => {
              const color = getCategoryColor(r.category)
              // Width relative to highest category for nice visual hierarchy
              const barWidth = Math.max((r.amount / maxAmount) * 100, 3)

              return (
                <li key={r.category} className="group">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span
                        className="size-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ background: color }}
                      />
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">{r.category}</span>
                    </span>

                    <div className="flex items-center gap-2.5 tabular-nums">
                      {/* Comparative Trend Badge */}
                      {r.trendPercent !== null && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                            r.trendPercent > 0
                              ? "bg-destructive/10 text-destructive"
                              : r.trendPercent < 0
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={`vs período anterior (${mask(formatShort(r.prevAmount, selectedCurrency))})`}
                        >
                          {r.trendPercent > 0 ? (
                            <TrendingUp className="size-3" />
                          ) : r.trendPercent < 0 ? (
                            <TrendingDown className="size-3" />
                          ) : null}
                          {r.trendPercent > 0 ? `+${r.trendPercent}%` : `${r.trendPercent}%`}
                        </span>
                      )}

                      {/* Percentage of total */}
                      <span className="text-[11px] font-mono font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                        {r.pctOfTotal.toFixed(1)}%
                      </span>

                      {/* Absolute amount */}
                      <span className="font-mono font-bold text-foreground min-w-[70px] text-right">
                        {mask(formatShort(r.amount, selectedCurrency))}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        background: color,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </section>
  )
}


