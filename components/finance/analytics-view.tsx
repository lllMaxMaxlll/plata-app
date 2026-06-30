"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  Sparkles,
  Info,
  DollarSign
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { formatShort, formatCurrency, type Transaction, type Currency } from "@/lib/finance-data"

interface AnalyticsViewProps {
  isDesktop?: boolean
  onBack: () => void
  onEditTransaction: (tx: Transaction) => void
}

export function AnalyticsView({ isDesktop = false, onBack, onEditTransaction }: AnalyticsViewProps) {
  const { transactions, getAccount, categories, accounts } = useFinance()
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("ARS")
  
  // 1. Group transactions & extract available months (YYYY-MM)
  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.type === "expense")
  }, [transactions])

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>()
    for (const t of expenseTransactions) {
      if (!t.date) continue
      const dateObj = new Date(t.date)
      if (isNaN(dateObj.getTime())) continue
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, "0")
      monthsSet.add(`${year}-${month}`)
    }
    
    // Sort chronological descending
    const sorted = [...monthsSet].sort((a, b) => b.localeCompare(a))
    
    // If empty, default to current month
    if (sorted.length === 0) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      sorted.push(`${year}-${month}`)
    }
    return sorted
  }, [expenseTransactions])

  // Current selected month & comparison month states
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0])
  const [comparisonMonth, setComparisonMonth] = useState<string>(
    availableMonths[1] || "none"
  )
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Format YYYY-MM to readable Spanish month name (e.g. "Junio 2026")
  const formatMonthName = (monthStr: string) => {
    if (!monthStr || monthStr === "none") return "Ninguno"
    const [year, month] = monthStr.split("-")
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 15)
    const monthName = dateObj.toLocaleString("es-AR", { month: "long" })
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
  }

  // Get color for category
  const getCategoryColor = (catName: string) => {
    return categories.find((c) => c.name === catName)?.color ?? "oklch(0.66 0.18 350)"
  }

  // 2. Compute category statistics for the selected month and comparison month
  const analyticsData = useMemo(() => {
    const selectedMap = new Map<string, number>()
    const selectedTxs: Transaction[] = []
    
    const comparisonMap = new Map<string, number>()

    for (const t of expenseTransactions) {
      const acc = getAccount(t.accountId)
      if (!acc || acc.currency !== selectedCurrency) continue

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

  // 3. Compute last 6 months trend data (chronological ascending)
  const trendData = useMemo(() => {
    // Take up to 6 months
    const lastMonths = [...availableMonths].slice(0, 6).reverse()
    
    const monthlyCategoryMap = lastMonths.map((m) => {
      const map = new Map<string, number>()
      let monthTotal = 0
      
      for (const t of expenseTransactions) {
        const acc = getAccount(t.accountId)
        if (!acc || acc.currency !== selectedCurrency) continue
        
        const dateObj = new Date(t.date)
        const year = dateObj.getFullYear()
        const month = String(dateObj.getMonth() + 1).padStart(2, "0")
        const tMonth = `${year}-${month}`
        
        if (tMonth === m) {
          map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
          monthTotal += t.amount
        }
      }
      
      return {
        month: m,
        total: monthTotal,
        categories: map,
      }
    })
    
    const maxMonthTotal = Math.max(...monthlyCategoryMap.map((d) => d.total), 1)
    
    return {
      months: monthlyCategoryMap,
      maxTotal: maxMonthTotal,
    }
  }, [availableMonths, expenseTransactions, selectedCurrency, getAccount])

  const maxRowVal = analyticsData.rows[0]?.amount ?? 1

  return (
    <div className={`w-full text-foreground ${isDesktop ? "" : "pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] px-4"}`}>
      {/* Header */}
      {!isDesktop && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="flex size-10 items-center justify-center rounded-full bg-card border border-border/30 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Análisis de Gastos</h1>
            <p className="text-xs text-muted-foreground">Distribución y comparación de tus consumos</p>
          </div>
        </div>
      )}

      {/* Selectors and Currency Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 bg-card/30 border border-border/30 rounded-3xl p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Selected Month Dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1">Mes a Analizar</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value)
                  // If selected month is changed to the same as comparison, shift comparison
                  if (e.target.value === comparisonMonth) {
                    const idx = availableMonths.indexOf(e.target.value)
                    setComparisonMonth(availableMonths[idx + 1] || "none")
                  }
                }}
                className="w-48 appearance-none bg-card hover:bg-muted border border-border/40 text-sm font-semibold rounded-2xl pl-3.5 pr-8 py-2.5 transition-colors cursor-pointer text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none size-4 text-muted-foreground" />
            </div>
          </div>

          {/* Comparison Month Dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1">Comparar Con</span>
            <div className="relative">
              <select
                value={comparisonMonth}
                onChange={(e) => setComparisonMonth(e.target.value)}
                className="w-48 appearance-none bg-card hover:bg-muted border border-border/40 text-sm font-semibold rounded-2xl pl-3.5 pr-8 py-2.5 transition-colors cursor-pointer text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="none">Ninguno (Solo ver mes)</option>
                {availableMonths
                  .filter((m) => m !== selectedMonth)
                  .map((m) => (
                    <option key={m} value={m}>
                      {formatMonthName(m)}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none size-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Currency Toggle */}
        <div className="flex flex-col gap-1 self-end md:self-auto">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1 self-end md:self-auto">Moneda</span>
          <div className="flex bg-muted/80 border border-border/10 p-0.5 rounded-2xl shadow-inner">
            <button
              onClick={() => setSelectedCurrency("ARS")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                selectedCurrency === "ARS"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ARS ($)
            </button>
            <button
              onClick={() => setSelectedCurrency("USD")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                selectedCurrency === "USD"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              USD (US$)
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI MoM Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Selected Month KPI */}
        <div className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Gastado
              </span>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-muted text-muted-foreground uppercase">
                {selectedCurrency}
              </span>
            </div>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums">
              {formatCurrency(analyticsData.total, selectedCurrency)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-4 font-medium">
            En {formatMonthName(selectedMonth)}
          </p>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 pointer-events-none">
            <DollarSign className="size-32" />
          </div>
        </div>

        {/* Comparison Month KPI */}
        {comparisonMonth !== "none" && (
          <>
            <div className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Total Referencia
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-muted text-muted-foreground uppercase">
                    {selectedCurrency}
                  </span>
                </div>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums text-muted-foreground">
                  {formatCurrency(analyticsData.comparisonTotal, selectedCurrency)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 font-medium">
                En {formatMonthName(comparisonMonth)}
              </p>
              <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 pointer-events-none">
                <Calendar className="size-32" />
              </div>
            </div>

            {/* Variance / Performance KPI */}
            <div className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Variación Mensual
                  </span>
                  <span className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    analyticsData.totalDiff > 0 
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success/10 text-success"
                  }`}>
                    {analyticsData.totalDiff > 0 ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {analyticsData.totalPercentChange !== null 
                      ? `${analyticsData.totalDiff > 0 ? "+" : ""}${analyticsData.totalPercentChange.toFixed(1)}%`
                      : "Nuevo"
                    }
                  </span>
                </div>
                <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  analyticsData.totalDiff > 0 ? "text-destructive" : "text-success"
                }`}>
                  {analyticsData.totalDiff > 0 ? "+" : ""}{formatShort(analyticsData.totalDiff, selectedCurrency)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 font-medium">
                {analyticsData.totalDiff > 0 
                  ? "Gastaste más que el mes de comparación" 
                  : "¡Ahorraste respecto al mes de comparación!"
                }
              </p>
            </div>
          </>
        )}
      </div>

      {/* 6-Month Stacked Trend Chart (Responsive SVG) */}
      <section className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="size-4.5 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Tendencia Histórica de Gastos</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Distribución mensual apilada por categoría ({selectedCurrency})
        </p>

        {trendData.months.length === 0 || trendData.maxTotal === 1 ? (
          <div className="h-48 flex items-center justify-center border border-dashed border-border/40 rounded-2xl bg-muted/20">
            <p className="text-xs text-muted-foreground">No hay datos suficientes para graficar la tendencia.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* SVG Stacked Bar Chart */}
            <div className="w-full h-52">
              <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible">
                {/* Horizontal Grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = 170 - ratio * 140
                  return (
                    <g key={ratio} className="opacity-15">
                      <line x1="40" y1={y} x2="480" y2={y} stroke="var(--foreground)" strokeWidth="1" strokeDasharray="3,3" />
                      <text x="35" y={y + 3} fill="var(--foreground)" fontSize="8" fontWeight="bold" textAnchor="end" className="tabular-nums">
                        {formatShort(trendData.maxTotal * ratio, selectedCurrency)}
                      </text>
                    </g>
                  )
                })}
                <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border)" strokeWidth="1.5" />

                {/* Bars for each month */}
                {trendData.months.map((d, mIdx) => {
                  const barCount = trendData.months.length
                  const colWidth = 440 / barCount
                  const x = 40 + mIdx * colWidth + (colWidth - 32) / 2
                  
                  // Calculate heights and stack positions
                  let currentY = 170
                  const barItems: { y: number; height: number; color: string; catName: string; amt: number }[] = []
                  
                  // Extract all category keys registered
                  const catEntries = [...d.categories.entries()].sort((a, b) => b[1] - a[1])
                  
                  for (const [catName, amt] of catEntries) {
                    if (amt <= 0) continue
                    const h = (amt / trendData.maxTotal) * 140
                    currentY -= h
                    barItems.push({
                      y: currentY,
                      height: h,
                      color: getCategoryColor(catName),
                      catName,
                      amt,
                    })
                  }

                  const formattedMonthLabel = () => {
                    const [year, month] = d.month.split("-")
                    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 15)
                    const label = dateObj.toLocaleString("es-AR", { month: "short" })
                    return label.charAt(0).toUpperCase() + label.slice(1)
                  }

                  return (
                    <g key={d.month} className="group cursor-pointer">
                      {/* Stacked rects */}
                      {barItems.map((item, i) => (
                        <rect
                          key={i}
                          x={x}
                          y={item.y}
                          width="32"
                          height={item.height}
                          fill={item.color}
                          rx={item.height > 6 ? 2 : 0}
                          className="transition-all duration-300 hover:opacity-90"
                        >
                          <title>{`${item.catName}: ${formatShort(item.amt, selectedCurrency)}`}</title>
                        </rect>
                      ))}

                      {/* Transparent overlay for month total tooltip on hover */}
                      <rect
                        x={x - 5}
                        y="20"
                        width="42"
                        height="150"
                        fill="transparent"
                        className="peer pointer-events-auto"
                      />

                      {/* Total text overlay on hover */}
                      <g className="opacity-0 peer-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <rect
                          x={Math.max(x - 20, 10)}
                          y="5"
                          width="72"
                          height="18"
                          rx="6"
                          fill="var(--card)"
                          stroke="var(--border)"
                          strokeWidth="1"
                        />
                        <text
                          x={Math.max(x + 16, 46)}
                          y="17"
                          fill="var(--foreground)"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          className="tabular-nums"
                        >
                          {formatShort(d.total, selectedCurrency)}
                        </text>
                      </g>

                      {/* X Axis Month Label */}
                      <text
                        x={x + 16}
                        y="186"
                        fill="var(--muted-foreground)"
                        fontSize="9.5"
                        fontWeight="semibold"
                        textAnchor="middle"
                        className="transition-colors group-hover:fill-foreground"
                      >
                        {formattedMonthLabel()}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Colors Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border/20 pt-4.5">
              {categories.map((c) => {
                // Check if this category exists in any of the displayed months
                const hasData = trendData.months.some(m => (m.categories.get(c.name) ?? 0) > 0)
                if (!hasData) return null
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-[11.5px] font-semibold text-muted-foreground">{c.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Category Breakdown & MoM Comparative Table */}
      <section className="bg-card border border-border/40 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold tracking-tight">Distribución por Categorías</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Hacé clic en una categoría para auditar sus movimientos</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedCurrency}
          </span>
        </div>

        {analyticsData.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center bg-muted/10 border border-dashed border-border/40 rounded-2xl">
            No se encontraron gastos registrados en esta moneda para el mes seleccionado.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {analyticsData.rows.map((r) => {
              const color = getCategoryColor(r.category)
              const percentOfTotal = analyticsData.total > 0 ? (r.amount / analyticsData.total) * 100 : 0
              const isExpanded = expandedCategory === r.category

              // Filter transactions in selected category for detail list
              const categoryTxs = analyticsData.transactions
                .filter((t) => t.category === r.category)
                .sort((a, b) => b.date.localeCompare(a.date))

              return (
                <li
                  key={r.category}
                  className="border-b border-border/20 last:border-b-0 pb-5 last:pb-0"
                >
                  {/* Category main header row */}
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : r.category)}
                    className="flex flex-col gap-2 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="size-3 rounded-full shrink-0" style={{ background: color }} />
                        <span className="font-bold group-hover:text-primary transition-colors">
                          {r.category}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded">
                          {percentOfTotal.toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-extrabold tabular-nums block">
                            {formatShort(r.amount, selectedCurrency)}
                          </span>
                          
                          {/* Comparison indicator */}
                          {comparisonMonth !== "none" && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold ${
                              r.diff > 0 
                                ? "text-destructive" 
                                : r.diff < 0 
                                ? "text-success" 
                                : "text-muted-foreground"
                            }`}>
                              {r.diff > 0 ? "▲" : r.diff < 0 ? "▼" : "="}{" "}
                              {r.compAmount === 0 ? (
                                "Nueva"
                              ) : (
                                `${Math.abs(r.percentChange ?? 0).toFixed(0)}%`
                              )}
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 overflow-hidden rounded-full bg-muted/65 relative w-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((r.amount / maxRowVal) * 100, 4)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Expanded Transaction Details Accordion */}
                  {isExpanded && (
                    <div className="mt-4 pl-5 border-l-2 border-border/40 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
                      <div className="flex items-center justify-between border-b border-border/20 pb-2 mb-2">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Movimientos del Mes</span>
                        <span className="text-[10px] text-muted-foreground font-semibold">{categoryTxs.length} registros</span>
                      </div>
                      
                      {categoryTxs.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No hay transacciones registradas.</p>
                      ) : (
                        <ul className="flex flex-col gap-2.5">
                          {categoryTxs.map((tx) => {
                            const acc = getAccount(tx.accountId)
                            const dateLabel = new Date(tx.date).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short"
                            })
                            return (
                              <li
                                key={tx.id}
                                onClick={() => onEditTransaction(tx)}
                                className="flex items-center justify-between hover:bg-muted/30 p-2 rounded-xl transition-all cursor-pointer group/item active:scale-[0.99]"
                              >
                                <div className="min-w-0 flex-1 pr-4">
                                  <p className="text-xs font-semibold truncate group-item-hover:text-primary transition-colors">
                                    {tx.note || "Sin descripción"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {dateLabel} · Cuenta: <span className="font-medium text-foreground/80">{acc?.name ?? "Desconocida"}</span>
                                  </p>
                                </div>
                                <span className="text-xs font-bold tabular-nums text-foreground/90 shrink-0">
                                  {formatShort(tx.amount, selectedCurrency)}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
