"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Bike,
  Car,
  Truck
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { formatShort, formatCurrency, type Transaction, type Currency } from "@/lib/finance-data"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BarChart3, LineChart as LineChartIcon } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface AnalyticsViewProps {
  isDesktop?: boolean
  onBack: () => void
  onEditTransaction: (tx: Transaction) => void
}

export function AnalyticsView({ isDesktop = false, onBack, onEditTransaction }: AnalyticsViewProps) {
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
      const currency = t.currency ?? getAccount(t.accountId)?.currency
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
        const currency = transaction.currency ?? getAccount(transaction.accountId)?.currency
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
  const [chartMode, setChartMode] = useState<"stacked_bar" | "area">("stacked_bar")
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
      const currency = t.currency ?? getAccount(t.accountId)?.currency
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
        const currency = t.currency ?? getAccount(t.accountId)?.currency
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

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {
      total: {
        label: "Gasto Total",
        color: "var(--primary)",
      },
    }
    categories.forEach((c) => {
      cfg[c.name] = {
        label: c.name,
        color: c.color || "var(--chart-1)",
      }
    })
    return cfg
  }, [categories])

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

  const pieChartData = useMemo(() => {
    if (!analyticsData.rows || analyticsData.rows.length === 0) return []
    return analyticsData.rows.map((r) => ({
      name: r.category,
      amount: r.amount,
      fill: getCategoryColor(r.category),
    }))
  }, [analyticsData.rows])

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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-6 text-foreground">
      {/* Header */}
      {!isDesktop && (
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onBack}
            className="rounded-full shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Análisis de Gastos</h1>
            <p className="text-xs text-muted-foreground">Distribución y comparación de tus consumos</p>
          </div>
        </div>
      )}

      {/* Selectors and Currency Controls */}
      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1">Mes a Analizar</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value)
                  if (e.target.value === comparisonMonth) {
                    const idx = availableMonths.indexOf(e.target.value)
                    setComparisonMonth(availableMonths[idx + 1] || "none")
                  }
                }}
                className="w-48 appearance-none bg-transparent border border-input text-sm font-semibold rounded-xl pl-3.5 pr-8 py-2 transition-colors cursor-pointer text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1">Comparar Con</span>
            <div className="relative">
              <select
                value={comparisonMonth}
                onChange={(e) => setComparisonMonth(e.target.value)}
                className="w-48 appearance-none bg-transparent border border-input text-sm font-semibold rounded-xl pl-3.5 pr-8 py-2 transition-colors cursor-pointer text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="flex flex-col gap-1 self-end md:self-auto">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1 self-end md:self-auto">Moneda</span>
          <ToggleGroup
            value={[selectedCurrency]}
            onValueChange={(values) => {
              const currency = values[0] as Currency | undefined
              if (currency) handleCurrencyChange(currency)
            }}
            multiple={false}
            variant="outline"
            spacing={0}
            aria-label="Moneda de los movimientos"
          >
            <ToggleGroupItem value="ARS" className="gap-2 px-3 text-xs font-bold">
              ARS ($)
              <Badge variant="secondary" className="px-1.5 text-[9px] tabular-nums">
                {currencyActivity.ARS}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem value="USD" className="gap-2 px-3 text-xs font-bold">
              USD (US$)
              <Badge variant="secondary" className="px-1.5 text-[9px] tabular-nums">
                {currencyActivity.USD}
              </Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Card>

      {/* Main KPI MoM Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <Card className="p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Gastado
              </span>
              <Badge variant="secondary" className="px-2 py-0.5 text-[9px] font-bold uppercase">
                {selectedCurrency}
              </Badge>
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
        </Card>

        {comparisonMonth !== "none" && (
          <>
            <Card className="p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Total Referencia
                  </span>
                  <Badge variant="secondary" className="px-2 py-0.5 text-[9px] font-bold uppercase">
                    {selectedCurrency}
                  </Badge>
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
            </Card>

            <Card className="p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Variación Mensual
                  </span>
                  <Badge
                    variant={analyticsData.totalDiff > 0 ? "destructive" : "default"}
                    className="flex items-center gap-0.5 text-[10px] font-extrabold"
                  >
                    {analyticsData.totalDiff > 0 ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {analyticsData.totalPercentChange !== null 
                      ? `${analyticsData.totalDiff > 0 ? "+" : ""}${analyticsData.totalPercentChange.toFixed(1)}%`
                      : "Nuevo"
                    }
                  </Badge>
                </div>
                <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  analyticsData.totalDiff > 0 ? "text-destructive" : "text-emerald-500"
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
            </Card>
          </>
        )}
      </div>

      {/* Historical Trend Chart (Shadcn UI / Recharts) */}
      <Card className="p-6 shadow-sm mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4.5 text-primary" />
              <h2 className="text-base font-bold tracking-tight">Tendencia Histórica de Gastos</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evolución del consumo en {selectedCurrency} ({trendMonths} meses)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Range Selector */}
            <div className="inline-flex rounded-md bg-muted/60 p-0.5 text-xs font-mono">
              {( [3, 6, 12] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTrendMonths(m)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    trendMonths === m
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}M
                </button>
              ))}
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex rounded-md bg-muted/60 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setChartMode("stacked_bar")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  chartMode === "stacked_bar"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Barras Apiladas"
              >
                <BarChart3 className="size-3.5" />
                <span className="hidden sm:inline">Barras</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("area")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  chartMode === "area"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Área de Tendencia"
              >
                <LineChartIcon className="size-3.5" />
                <span className="hidden sm:inline">Tendencia</span>
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Average Banner */}
        <div className="mb-4 flex items-center justify-between bg-muted/30 border border-border/40 rounded-lg px-4 py-2 text-xs font-mono">
          <span className="text-muted-foreground">Promedio mensual del período:</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatCurrency(trendData.avgTotal, selectedCurrency)}
          </span>
        </div>

        {trendData.chartData.length === 0 || trendData.maxTotal === 1 ? (
          <div className="h-48 flex items-center justify-center border border-dashed border-border rounded-2xl bg-muted/20">
            <p className="text-xs text-muted-foreground">No hay datos suficientes para graficar la tendencia en {selectedCurrency}.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 sm:h-80 w-full">
            {chartMode === "stacked_bar" ? (
              <BarChart data={trendData.chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs font-mono" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => formatShort(val, selectedCurrency)}
                  className="text-xs font-mono"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(lbl) => `Mes: ${lbl}`}
                      formatter={(val, name) => (
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="text-muted-foreground font-sans">{name}</span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {formatCurrency(Number(val), selectedCurrency)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {trendData.categories.map((cat, idx) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    name={cat}
                    stackId="a"
                    fill={getCategoryColor(cat)}
                    radius={idx === trendData.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <AreaChart data={trendData.chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs font-mono" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => formatShort(val, selectedCurrency)}
                  className="text-xs font-mono"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(lbl) => `Mes: ${lbl}`}
                      formatter={(val) => (
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="text-muted-foreground font-sans">Total consumido</span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {formatCurrency(Number(val), selectedCurrency)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Gasto Total"
                  stroke="var(--primary)"
                  fill="url(#areaTrendGradient)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--primary)" }}
                  activeDot={{ r: 6, stroke: "var(--background)", strokeWidth: 2 }}
                />
              </AreaChart>
            )}
          </ChartContainer>
        )}
      </Card>

      {/* Gastos por Vehículo */}
      {vehicleSpendData.length > 0 && (
        <Card className="p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold tracking-tight">Gastos por Vehículo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Control de gastos individuales de mantenimiento y combustible en {formatMonthName(selectedMonth)}</p>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
              {selectedCurrency}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vehicleSpendData.map((v) => {
              const maxVehicleSpent = Math.max(...vehicleSpendData.map(d => d.amount), 1)
              const percent = (v.amount / maxVehicleSpent) * 100
              
              const getVehicleIcon = (typeStr: string) => {
                switch (typeStr) {
                  case "motorcycle":
                    return Bike
                  case "car":
                    return Car
                  case "truck":
                    return Truck
                  default:
                    return Car
                }
              }
              const VehicleIcon = getVehicleIcon(v.type)

              return (
                <div key={v.id} className="border border-border bg-card p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                        <VehicleIcon className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-foreground truncate">{v.name}</h3>
                        {v.plate && <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase mt-0.5">{v.plate}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold tabular-nums text-foreground/90 shrink-0">
                      {formatCurrency(v.amount, selectedCurrency)}
                    </span>
                  </div>

                  <Progress value={percent} className="h-2" />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Category Breakdown & MoM Comparative Table */}
      <Card className="p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">Distribución por Categorías</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Análisis del mes seleccionado • Hacé clic para auditar movimientos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Selector */}
            <div className="inline-flex rounded-md bg-muted/60 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCategorySortMode("amount_desc")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  categorySortMode === "amount_desc"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monto
              </button>
              {comparisonMonth !== "none" && (
                <button
                  type="button"
                  onClick={() => setCategorySortMode("diff_desc")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                    categorySortMode === "diff_desc"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Variación
                </button>
              )}
              <button
                type="button"
                onClick={() => setCategorySortMode("name_asc")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  categorySortMode === "name_asc"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Nombre
              </button>
            </div>

            <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
              {selectedCurrency}
            </Badge>
          </div>
        </div>

        {analyticsData.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center bg-muted/10 border border-dashed border-border rounded-2xl">
            No se encontraron gastos registrados en esta moneda para el mes seleccionado.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Donut Distribution Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border border-border/40 bg-muted/20 rounded-xl p-4">
              <div className="md:col-span-1 flex justify-center">
                <ChartContainer config={chartConfig} className="h-44 w-44">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(val, name) => (
                            <div className="flex items-center justify-between w-full gap-3">
                              <span className="text-muted-foreground font-sans">{name}</span>
                              <span className="font-mono font-bold text-foreground tabular-nums">
                                {formatCurrency(Number(val), selectedCurrency)}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={pieChartData}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>

              <div className="md:col-span-2 flex flex-col justify-center gap-1.5">
                <div className="flex items-baseline justify-between border-b border-border/40 pb-2">
                  <span className="text-xs text-muted-foreground font-mono">Gasto total del mes:</span>
                  <span className="text-lg font-mono font-bold text-foreground tabular-nums">
                    {formatCurrency(analyticsData.total, selectedCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1">
                  <span>Categorías activas:</span>
                  <span className="font-bold text-foreground">{analyticsData.rows.length}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/80 mt-1 italic">
                  * Toca cualquier categoría abajo para ver sus movimientos registrados.
                </p>
              </div>
            </div>

            {/* List of Categories with Shadcn UI Progress & Badges */}
            <ul className="flex flex-col gap-4">
              {sortedCategoryRows.map((r) => {
                const color = getCategoryColor(r.category)
                const percentOfTotal = analyticsData.total > 0 ? (r.amount / analyticsData.total) * 100 : 0
                const isExpanded = expandedCategory === r.category

                const categoryTxs = analyticsData.transactions
                  .filter((t) => t.category === r.category)
                  .sort((a, b) => b.date.localeCompare(a.date))

                return (
                  <li
                    key={r.category}
                    className="border-b border-border/50 last:border-b-0 pb-4 last:pb-0"
                  >
                    <div
                      onClick={() => setExpandedCategory(isExpanded ? null : r.category)}
                      className="flex flex-col gap-2 cursor-pointer group hover:bg-muted/30 p-2 rounded-lg transition-all"
                    >
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="size-3 rounded-full shrink-0 shadow-xs" style={{ background: color }} />
                          <span className="font-bold truncate group-hover:text-primary transition-colors">
                            {r.category}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-mono font-semibold px-1.5 py-0.2 shrink-0">
                            {percentOfTotal.toFixed(1)}%
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 tabular-nums">
                          <div className="text-right">
                            <span className="font-mono font-bold block text-foreground">
                              {formatCurrency(r.amount, selectedCurrency)}
                            </span>

                            {comparisonMonth !== "none" && (
                              <div className="flex justify-end mt-0.5">
                                {r.compAmount === 0 ? (
                                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 border-primary/30 text-primary">
                                    Nueva
                                  </Badge>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                      r.diff > 0
                                        ? "bg-destructive/10 text-destructive"
                                        : r.diff < 0
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {r.diff > 0 ? (
                                      <TrendingUp className="size-3" />
                                    ) : r.diff < 0 ? (
                                      <TrendingDown className="size-3" />
                                    ) : null}
                                    {r.diff > 0 ? `+${Math.abs(r.percentChange ?? 0).toFixed(0)}%` : `${r.percentChange?.toFixed(0)}%`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Native Shadcn UI Progress Bar */}
                      <Progress value={Math.max((r.amount / maxRowVal) * 100, 2)} className="h-1.5" />
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-3 pl-4 border-l-2 border-primary/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2">
                          <span className="text-[10px] text-muted-foreground font-mono font-semibold uppercase tracking-wider">
                            Movimientos del Mes
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {categoryTxs.length} registros
                          </span>
                        </div>

                        {categoryTxs.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 font-mono">No hay transacciones registradas.</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {categoryTxs.map((tx) => {
                              const acc = getAccount(tx.accountId)
                              const dateLabel = new Date(tx.date).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "short",
                              })
                              return (
                                <li
                                  key={tx.id}
                                  onClick={() => onEditTransaction(tx)}
                                  className="flex items-center justify-between hover:bg-accent/40 p-2 rounded-lg transition-all cursor-pointer group/item text-xs"
                                >
                                  <div className="min-w-0 flex-1 pr-4">
                                    <p className="font-semibold truncate group-hover/item:text-primary transition-colors">
                                      {tx.note || "Sin descripción"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate font-mono">
                                      {dateLabel} · Cuenta: <span className="font-medium text-foreground/80">{acc?.name ?? "Desconocida"}</span>
                                    </p>
                                  </div>
                                  <span className="font-mono font-bold tabular-nums text-foreground shrink-0">
                                    {formatCurrency(tx.amount, selectedCurrency)}
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
          </div>
        )}
      </Card>
    </div>
  )
}
