"use client"

import { useMemo } from "react"
import { ArrowUpRight } from "lucide-react"
import { CATEGORY_COLORS, formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
 
export function ExpenseChart({ onSeeAnalytics }: { onSeeAnalytics?: () => void }) {
  const { transactions, getAccount, categories, accounts, vehicles } = useFinance()
 
  const { rows, total } = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== "expense") continue
      // Only aggregate ARS expenses so the bars share a5 single unit
      if (getAccount(t.accountId)?.currency !== "ARS") continue
      
      let groupName = t.category
      if (t.vehicleId && vehicles) {
        const veh = vehicles.find(v => v.id === t.vehicleId)
        if (veh) {
          groupName = veh.name
        }
      }
      
      map.set(groupName, (map.get(groupName) ?? 0) + t.amount)
    }
    const rows = [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return { rows, total }
  }, [transactions, getAccount, accounts, vehicles])
 
  const max = rows[0]?.amount ?? 1
 
  const getCategoryColor = (catName: string) => {
    const isVehicle = vehicles?.some((v) => v.name === catName)
    if (isVehicle) {
      return categories.find((c) => c.name === "Transporte")?.color ?? "var(--chart-5)"
    }
    return categories.find((c) => c.name === catName)?.color ?? "var(--chart-5)"
  }
 
  return (
    <section className="mt-6 px-5">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Gastos por categoría</h2>
          {onSeeAnalytics && (
            <button
              onClick={onSeeAnalytics}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Ver análisis <ArrowUpRight className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
          {formatShort(total, "ARS")}
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aún no hay gastos registrados.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3.5">
            {rows.map((r) => {
              const color = getCategoryColor(r.category)
              return (
                <li key={r.category}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: color }}
                      />
                      {r.category}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatShort(r.amount, "ARS")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((r.amount / max) * 100, 4)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
