"use client"

import { useEffect, useMemo, useState } from "react"
import { Bike, Car, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, TrendingDown, TrendingUp, Truck } from "lucide-react"
import { useFinance } from "./finance-provider"
import { formatCompact, formatShort, transactionCurrency, type Transaction, type Currency } from "@/lib/finance-data"
import { Button } from "@/components/ui/button"
import { cn, focusRing } from "@/lib/utils"
import { PageHeader } from "./page-header"
import { OptionSelect } from "./option-select"
import { Segmented } from "./segmented"
import { TransactionList } from "./transaction-list"
import { IconTile, pageClass } from "./lucas-ui"

interface AnalyticsViewProps {
  onEditTransaction: (tx: Transaction) => void
}

export function AnalyticsView({ onEditTransaction }: AnalyticsViewProps) {
  const { transactions, getAccount, categories, vehicles, vehicleLogs } = useFinance()
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("ARS")
  
  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.type === "expense")
  }, [transactions])

  const availableMonthsByCurrency = useMemo(() => {
    const monthSets: Record<Currency, Set<string>> = {
      ARS: new Set<string>(),
      USD: new Set<string>(),
    }
    for (const t of expenseTransactions) {
      if (!t.date) continue
      const currency = transactionCurrency(t, getAccount(t.accountId))
      if (!currency) continue
      const dateObj = new Date(t.date)
      if (isNaN(dateObj.getTime())) continue
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, "0")
      monthSets[currency].add(`${year}-${month}`)
    }

    const currentMonth = (() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      return `${year}-${month}`
    })()

    return {
      ARS: [...monthSets.ARS].sort((a, b) => b.localeCompare(a)),
      USD: [...monthSets.USD].sort((a, b) => b.localeCompare(a)),
      fallback: currentMonth,
    }
  }, [expenseTransactions, getAccount])

  const availableMonths = availableMonthsByCurrency[selectedCurrency].length > 0
    ? availableMonthsByCurrency[selectedCurrency]
    : [availableMonthsByCurrency.fallback]

  const currencyActivity = useMemo(() => {
    return expenseTransactions.reduce(
      (summary, transaction) => {
        const currency = transactionCurrency(transaction, getAccount(transaction.accountId))
        if (currency) summary[currency] += 1
        return summary
      },
      { ARS: 0, USD: 0 } as Record<Currency, number>
    )
  }, [expenseTransactions, getAccount])

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0])
  const [comparisonMonth, setComparisonMonth] = useState<string>(
    availableMonths[1] || "none"
  )
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [trendMonths, setTrendMonths] = useState<3 | 6 | 12>(6)
  const [categorySortMode, setCategorySortMode] = useState<"amount_desc" | "diff_desc" | "name_asc">("amount_desc")

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0])
      setComparisonMonth(availableMonths[1] || "none")
    } else if (comparisonMonth !== "none" && !availableMonths.includes(comparisonMonth)) {
      setComparisonMonth(availableMonths.find((month) => month !== selectedMonth) || "none")
    }
  }, [availableMonths, comparisonMonth, selectedMonth])

  function handleCurrencyChange(currency: Currency) {
    const months = availableMonthsByCurrency[currency]
    const nextMonths = months.length > 0 ? months : [availableMonthsByCurrency.fallback]
    setSelectedCurrency(currency)
    setSelectedMonth(nextMonths[0])
    setComparisonMonth(nextMonths[1] || "none")
    setExpandedCategory(null)
  }

  const formatMonthName = (monthStr: string) => {
    if (!monthStr || monthStr === "none") return "Ninguno"
    const [year, month] = monthStr.split("-")
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 15)
    const monthName = dateObj.toLocaleString("es-AR", { month: "long" })
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
  }

  const getCategoryColor = (catName: string) => {
    return categories.find((c) => c.name === catName)?.color ?? "oklch(0.66 0.18 350)"
  }

  const analyticsData = useMemo(() => {
    const selectedMap = new Map<string, number>()
    const selectedTxs: Transaction[] = []
    const comparisonMap = new Map<string, number>()

    for (const t of expenseTransactions) {
      const currency = transactionCurrency(t, getAccount(t.accountId))
      if (currency !== selectedCurrency) continue

      const dateObj = new Date(t.date)
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, "0")
      const tMonth = `${year}-${month}`

      if (tMonth === selectedMonth) {
        selectedMap.set(t.category, (selectedMap.get(t.category) ?? 0) + t.amount)
        selectedTxs.push(t)
      } else if (tMonth === comparisonMonth) {
        comparisonMap.set(t.category, (comparisonMap.get(t.category) ?? 0) + t.amount)
      }
    }

    const selectedRows = [...selectedMap.entries()]
      .map(([category, amount]) => {
        const compAmount = comparisonMap.get(category) ?? 0
        const diff = amount - compAmount
        const percentChange = compAmount > 0 ? (diff / compAmount) * 100 : null
        
        return {
          category,
          amount,
          compAmount,
          diff,
          percentChange,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const selectedTotal = selectedRows.reduce((sum, r) => sum + r.amount, 0)
    const comparisonTotal = [...comparisonMap.values()].reduce((sum, amt) => sum + amt, 0)

    const totalDiff = selectedTotal - comparisonTotal
    const totalPercentChange = comparisonTotal > 0 ? (totalDiff / comparisonTotal) * 100 : null

    return {
      rows: selectedRows,
      total: selectedTotal,
      comparisonTotal,
      totalDiff,
      totalPercentChange,
      transactions: selectedTxs,
    }
  }, [expenseTransactions, selectedMonth, comparisonMonth, selectedCurrency, getAccount])

  const trendData = useMemo(() => {
    const lastMonths = [...availableMonths].slice(0, trendMonths).reverse()
    const categoriesSet = new Set<string>()

    const chartData = lastMonths.map((m) => {
      const row: Record<string, any> = { month: m }
      let monthTotal = 0

      const [year, month] = m.split("-")
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 15)
      const labelShort = dateObj.toLocaleString("es-AR", { month: "short" })
      row.label = `${labelShort.charAt(0).toUpperCase() + labelShort.slice(1)} ${year.slice(2)}`

      for (const t of expenseTransactions) {
        const currency = transactionCurrency(t, getAccount(t.accountId))
        if (currency !== selectedCurrency) continue

        const tDateObj = new Date(t.date)
        const tYear = tDateObj.getFullYear()
        const tMonth = String(tDateObj.getMonth() + 1).padStart(2, "0")
        const tMonthStr = `${tYear}-${tMonth}`

        if (tMonthStr === m) {
          categoriesSet.add(t.category)
          row[t.category] = (row[t.category] ?? 0) + t.amount
          monthTotal += t.amount
        }
      }

      row.total = monthTotal
      return row
    })

    const categoriesList = Array.from(categoriesSet)
    const maxTotal = Math.max(...chartData.map((d) => d.total), 1)
    const avgTotal = chartData.length > 0 ? chartData.reduce((acc, d) => acc + d.total, 0) / chartData.length : 0

    return {
      chartData,
      categories: categoriesList,
      maxTotal,
      avgTotal,
    }
  }, [availableMonths, expenseTransactions, selectedCurrency, getAccount, trendMonths])

  const sortedCategoryRows = useMemo(() => {
    if (!analyticsData.rows) return []
    const list = [...analyticsData.rows]
    if (categorySortMode === "amount_desc") {
      return list.sort((a, b) => b.amount - a.amount)
    }
    if (categorySortMode === "diff_desc") {
      return list.sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0))
    }
    if (categorySortMode === "name_asc") {
      return list.sort((a, b) => a.category.localeCompare(b.category))
    }
    return list
  }, [analyticsData.rows, categorySortMode])

  const vehicleSpendData = useMemo(() => {
    if (!vehicles || !vehicleLogs) return []

    const vehicleMap = new Map<string, number>()
    
    vehicles.forEach(v => {
      vehicleMap.set(v.id, 0)
    })
    
    vehicleLogs.forEach(l => {
      if (!l.date) return
      const dateObj = new Date(l.date)
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, "0")
      const tMonth = `${year}-${month}`
      if (tMonth !== selectedMonth) return
      
      let logCurrency: Currency = "ARS"
      if (l.accountId) {
        const acc = getAccount(l.accountId)
        if (acc) {
          logCurrency = acc.currency
        }
      }
      if (logCurrency !== selectedCurrency) return
      
      vehicleMap.set(l.vehicleId, (vehicleMap.get(l.vehicleId) ?? 0) + l.amount)
    })
    
    return [...vehicleMap.entries()]
      .map(([vehicleId, amount]) => {
        const vehicle = vehicles.find(v => v.id === vehicleId)
        return {
          id: vehicleId,
          name: vehicle?.name || "Vehículo Desconocido",
          plate: vehicle?.plate || "",
          type: vehicle?.type || "car",
          amount
        }
      })
      .filter(r => r.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [vehicles, vehicleLogs, selectedMonth, selectedCurrency, getAccount])

  const maxRowVal = analyticsData.rows[0]?.amount ?? 1
  const monthIndex = availableMonths.indexOf(selectedMonth)
  const compareLabel = comparisonMonth === "none" ? null : formatMonthName(comparisonMonth)
  const vsAverage = trendData.avgTotal > 0 ? (analyticsData.total - trendData.avgTotal) / trendData.avgTotal : null

  function selectMonth(month: string) {
    setSelectedMonth(month)
    setExpandedCategory(null)
    if (month === comparisonMonth) {
      const idx = availableMonths.indexOf(month)
      setComparisonMonth(availableMonths[idx + 1] || "none")
    }
  }

  return (
    <div className={cn(pageClass, "space-y-6")}>
      <PageHeader route="analytics" description="En qué se te va la plata, mes a mes." />

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes anterior"
            disabled={monthIndex >= availableMonths.length - 1}
            onClick={() => selectMonth(availableMonths[monthIndex + 1])}
          >
            <ChevronLeft />
          </Button>
          <OptionSelect
            ariaLabel="Mes a analizar"
            value={selectedMonth}
            onValueChange={selectMonth}
            className="w-44 font-bold"
            options={availableMonths.map((m) => ({ value: m, label: formatMonthName(m) }))}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes siguiente"
            disabled={monthIndex <= 0}
            onClick={() => selectMonth(availableMonths[monthIndex - 1])}
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">vs</span>
          <OptionSelect
            ariaLabel="Comparar con"
            value={comparisonMonth}
            onValueChange={setComparisonMonth}
            className="w-44"
            options={[
              { value: "none", label: "Sin comparar" },
              ...availableMonths.filter((m) => m !== selectedMonth).map((m) => ({ value: m, label: formatMonthName(m) })),
            ]}
          />
        </div>

        <Segmented
          ariaLabel="Moneda de los movimientos"
          value={selectedCurrency}
          onValueChange={handleCurrencyChange}
          className="sm:ml-auto"
          options={[
            { value: "ARS", label: <>ARS <span className="font-mono text-[10px] opacity-70">{currencyActivity.ARS}</span></> },
            { value: "USD", label: <>USD <span className="font-mono text-[10px] opacity-70">{currencyActivity.USD}</span></> },
          ]}
        />
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <section className="rounded-3xl border-2 border-foreground bg-lime p-4 text-ink shadow-md md:col-span-2">
          <p className="text-sm font-bold">Gastaste en {formatMonthName(selectedMonth)}</p>
          <p className="mt-1 text-[2.5rem] leading-none font-extrabold tracking-tighter">
            {formatShort(analyticsData.total, selectedCurrency)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold">
            {compareLabel === null ? (
              <span>Elegí un mes para comparar</span>
            ) : analyticsData.totalPercentChange === null ? (
              <span>{compareLabel}: sin gastos para comparar</span>
            ) : (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border-2 border-ink px-2 py-0.5",
                    analyticsData.totalDiff > 0 ? "bg-coral" : "bg-white"
                  )}
                >
                  {analyticsData.totalDiff > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {analyticsData.totalDiff > 0 ? "+" : ""}
                  {analyticsData.totalPercentChange.toFixed(1)}%
                </span>
                <span>
                  {analyticsData.totalDiff > 0 ? "más" : "menos"} que en {compareLabel} (
                  {formatShort(analyticsData.comparisonTotal, selectedCurrency)})
                </span>
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border-2 border-foreground bg-card p-4">
          <p className="text-sm font-bold">Promedio de {trendMonths} meses</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tighter">{formatShort(trendData.avgTotal, selectedCurrency)}</p>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            {vsAverage === null
              ? "sin historial para promediar"
              : `${formatMonthName(selectedMonth).split(" ")[0]} está ${Math.abs(Math.round(vsAverage * 100))}% ${vsAverage > 0 ? "arriba" : "abajo"}`}
          </p>
        </section>
      </div>

      {/* Mes a mes */}
      <section className="rounded-2xl border-2 border-foreground bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Mes a mes</h2>
            <p className="text-xs text-muted-foreground">Tocá una barra para ver ese mes. La línea es tu promedio.</p>
          </div>
          <Segmented
            ariaLabel="Meses a mostrar"
            size="sm"
            value={String(trendMonths) as "3" | "6" | "12"}
            onValueChange={(v) => setTrendMonths(Number(v) as 3 | 6 | 12)}
            options={[
              { value: "3", label: "3M" },
              { value: "6", label: "6M" },
              { value: "12", label: "12M" },
            ]}
          />
        </div>
        <TrendBars
          data={trendData.chartData}
          categories={trendData.categories}
          max={trendData.maxTotal}
          average={trendData.avgTotal}
          selected={selectedMonth}
          currency={selectedCurrency}
          colorOf={getCategoryColor}
          onSelect={selectMonth}
        />
      </section>

      {/* Por categoría */}
      <section className="rounded-2xl border-2 border-foreground bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Por categoría</h2>
            <p className="text-xs text-muted-foreground">Tocá una categoría para ver sus movimientos.</p>
          </div>
          <Segmented
            ariaLabel="Ordenar categorías"
            size="sm"
            value={categorySortMode}
            onValueChange={setCategorySortMode}
            options={[
              { value: "amount_desc", label: "Monto" },
              { value: "diff_desc", label: "Variación" },
              { value: "name_asc", label: "A-Z" },
            ]}
          />
        </div>

        {analyticsData.rows.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-foreground/30 py-8 text-center text-sm text-muted-foreground">
            No hay gastos en {selectedCurrency} en {formatMonthName(selectedMonth)}.
          </p>
        ) : (
          <>
            <div className="flex h-6 overflow-hidden rounded-lg border-2 border-foreground">
              {analyticsData.rows.map((r) => (
                <span
                  key={r.category}
                  className="h-full border-r-2 border-foreground last:border-r-0"
                  style={{ width: `${(r.amount / analyticsData.total) * 100}%`, background: getCategoryColor(r.category) }}
                  title={`${r.category} ${Math.round((r.amount / analyticsData.total) * 100)}%`}
                />
              ))}
            </div>

            <ul className="mt-4 divide-y-[1.5px] divide-dashed divide-foreground/15">
              {sortedCategoryRows.map((r) => {
                const isExpanded = expandedCategory === r.category
                const share = r.amount / analyticsData.total
                const categoryTxs = analyticsData.transactions.filter((t) => t.category === r.category)
                return (
                  <li key={r.category}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedCategory(isExpanded ? null : r.category)}
                      className={cn("w-full cursor-pointer py-3 text-left", focusRing)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-3 shrink-0 rounded-[4px] border-[1.5px] border-foreground"
                            style={{ background: getCategoryColor(r.category) }}
                          />
                          <span className="truncate font-bold">{r.category}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{Math.round(share * 100)}%</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {r.percentChange !== null && (
                            <span
                              className={cn(
                                "rounded-full border-[1.5px] border-foreground px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                                Math.round(r.percentChange) > 0 ? "bg-coral text-ink" : "bg-card"
                              )}
                            >
                              {Math.round(r.percentChange) === 0
                                ? "= 0%"
                                : `${r.percentChange > 0 ? "▲" : "▼"} ${Math.abs(Math.round(r.percentChange))}%`}
                            </span>
                          )}
                          <span className="font-mono text-sm font-semibold">{formatShort(r.amount, selectedCurrency)}</span>
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground" style={{ width: `${(r.amount / maxRowVal) * 100}%` }} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mb-3 rounded-xl border-2 border-foreground/20 bg-background px-3 py-1">
                        <TransactionList transactions={categoryTxs} onEditTransaction={onEditTransaction} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {/* Vehículos */}
      {vehicleSpendData.length > 0 && (
        <section className="rounded-2xl border-2 border-foreground bg-card p-4">
          <h2 className="mb-3 text-base font-extrabold tracking-tight">Vehículos · {formatMonthName(selectedMonth)}</h2>
          <ul className="space-y-3">
            {vehicleSpendData.map((v) => {
              const Icon = v.type === "motorcycle" ? Bike : v.type === "truck" ? Truck : Car
              return (
                <li key={v.id} className="flex items-center gap-3">
                  <IconTile Icon={Icon} className="bg-sky" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-bold">{v.name}</span>
                      <span className="font-mono text-sm font-semibold">{formatShort(v.amount, selectedCurrency)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${(v.amount / (vehicleSpendData[0]?.amount || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * Barras apiladas por categoría, una por mes, con la línea del promedio. Hechas
 * a mano y no con recharts: con bordes de tinta y sin animaciones se leen como
 * el resto de la app, y en un teléfono no hay tooltips que perseguir.
 */
function TrendBars({
  data,
  categories,
  max,
  average,
  selected,
  currency,
  colorOf,
  onSelect,
}: {
  data: Record<string, number | string>[]
  categories: string[]
  max: number
  average: number
  selected: string
  currency: Currency
  colorOf: (category: string) => string
  onSelect: (month: string) => void
}) {
  const many = data.length > 6
  return (
    <div>
      <div className="relative flex h-48 items-end gap-1.5 border-b-2 border-foreground sm:gap-3">
        {average > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-foreground/60"
            style={{ bottom: `${(average / max) * 100}%` }}
            aria-hidden
          />
        )}
        {data.map((row) => {
          const month = String(row.month)
          const total = Number(row.total) || 0
          const active = month === selected
          return (
            <button
              key={month}
              type="button"
              onClick={() => onSelect(month)}
              aria-pressed={active}
              aria-label={`${row.label}: ${formatShort(total, currency)}`}
              className="group flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end"
            >
              <span
                className={cn(
                  "mb-1 font-mono text-[10px] font-semibold whitespace-nowrap",
                  many && "hidden sm:block",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {total > 0 ? formatCompact(total, currency) : ""}
              </span>
              <span
                className={cn(
                  "flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-md border-2 border-b-0 border-foreground transition-opacity",
                  !active && "opacity-60 group-hover:opacity-90"
                )}
                style={{ height: `${(total / max) * 100}%` }}
              >
                {categories.map((category) => {
                  const value = Number(row[category]) || 0
                  if (value <= 0) return null
                  return (
                    <span
                      key={category}
                      className="w-full border-t-[1.5px] border-foreground first:border-t-0"
                      style={{ height: `${(value / total) * 100}%`, background: colorOf(category) }}
                    />
                  )
                })}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-3">
        {data.map((row) => (
          <span
            key={String(row.month)}
            className={cn(
              "min-w-0 flex-1 truncate text-center font-mono text-[10px]",
              String(row.month) === selected ? "rounded bg-lime font-semibold text-ink" : "text-muted-foreground"
            )}
          >
            {String(row.label).split(" ")[0]}
          </span>
        ))}
      </div>
      {categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {categories.map((category) => (
            <li key={category} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] border-[1.5px] border-foreground" style={{ background: colorOf(category) }} />
              {category}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
