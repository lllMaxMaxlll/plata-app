"use client"

import { useMemo } from "react"
import { CATEGORY_COLORS, formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"

export function ExpenseChart() {
  const { transactions, getAccount, categories, accounts } = useFinance()

  const { rows, total } = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== "expense") continue
      // Only aggregate ARS expenses so the bars share a single unit
      if (getAccount(t.accountId)?.currency !== "ARS") continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    const rows = [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return { rows, total }
  }, [transactions, getAccount, accounts])

  const max = rows[0]?.amount ?? 1

  const getCategoryColor = (catName: string) => {
    return categories.find((c) => c.name === catName)?.color ?? "var(--chart-5)"
  }

  return (
    <section className="mt-6 px-5">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Gastos por categoría</h2>
          <span className="text-xs text-muted-foreground">ARS · este mes</span>
        </div>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
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
