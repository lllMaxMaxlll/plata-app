"use client"

import { useMemo, useState } from "react"
import { Download, ArrowLeft, Search, Filter, X, Calendar, ChevronDown, Check, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react"
import type { TransactionType, Transaction, Currency } from "@/lib/finance-data"
import { formatCurrency, formatShort, transactionCurrency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { TransactionList } from "./transaction-list"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

type TypeFilter = "all" | TransactionType
type DateFilter = "all" | "today" | "week" | "this_month" | "last_month"

const DATE_LABELS: Record<DateFilter, string> = {
  all: "Todo el historial",
  today: "Hoy",
  week: "Últimos 7 días",
  this_month: "Este mes",
  last_month: "Mes anterior",
}

export function ActivityView({
  onEditTransaction,
  onOpenExport,
  onBack,
}: {
  onEditTransaction: (tx: Transaction) => void
  onOpenExport?: () => void
  onBack?: () => void
}) {
  const { transactions, accounts, categories, getAccount } = useFinance()

  // Filter States
  const [search, setSearch] = useState("")
  const [type, setType] = useState<TypeFilter>("all")
  const [accountId, setAccountId] = useState<string>("all")
  const [categoryName, setCategoryName] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateFilter>("all")

  // Filter Logic
  const filtered = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    return transactions.filter((t) => {
      // 1. Text Search Filter (note, category, account name)
      if (search.trim() !== "") {
        const queryText = search.toLowerCase().trim()
        const noteMatch = t.note?.toLowerCase().includes(queryText) ?? false
        const categoryMatch = t.category.toLowerCase().includes(queryText)
        const acc = getAccount(t.accountId)
        const accMatch = acc?.name.toLowerCase().includes(queryText) ?? false

        if (!noteMatch && !categoryMatch && !accMatch) return false
      }

      // 2. Transaction Type Filter
      if (type !== "all" && t.type !== type) return false

      // 3. Account Filter
      if (accountId !== "all" && t.accountId !== accountId && t.toAccountId !== accountId)
        return false

      // 4. Category Filter
      if (categoryName !== "all" && t.category !== categoryName) return false

      // 5. Date Range Filter
      if (dateRange !== "all") {
        const tDate = new Date(t.date)
        if (isNaN(tDate.getTime())) return false

        if (dateRange === "today") {
          const isToday =
            tDate.getDate() === now.getDate() &&
            tDate.getMonth() === now.getMonth() &&
            tDate.getFullYear() === now.getFullYear()
          if (!isToday) return false
        } else if (dateRange === "week") {
          const ageDays = (now.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24)
          if (ageDays > 7) return false
        } else if (dateRange === "this_month") {
          const inThisMonth =
            tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear
          if (!inThisMonth) return false
        } else if (dateRange === "last_month") {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
          const inLastMonth =
            tDate.getMonth() === prevMonth && tDate.getFullYear() === prevYear
          if (!inLastMonth) return false
        }
      }

      return true
    })
  }, [transactions, search, type, accountId, categoryName, dateRange, getAccount])

  // Calculate Totals for Filtered Transactions
  const { totalARS, totalUSD } = useMemo(() => {
    let ars = 0
    let usd = 0

    filtered.forEach((t) => {
      const currency = transactionCurrency(t, getAccount(t.accountId)) ?? "ARS"
      const sign = t.type === "income" ? 1 : t.type === "expense" ? -1 : 0

      if (currency === "ARS") {
        ars += t.amount * sign
      } else {
        usd += t.amount * sign
      }
    })

    return { totalARS: ars, totalUSD: usd }
  }, [filtered, getAccount])

  const hasActiveFilters =
    search.trim() !== "" ||
    type !== "all" ||
    accountId !== "all" ||
    categoryName !== "all" ||
    dateRange !== "all"

  const handleResetFilters = () => {
    setSearch("")
    setType("all")
    setAccountId("all")
    setCategoryName("all")
    setDateRange("all")
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="size-8 rounded-lg shrink-0 border-border bg-card hover:bg-accent cursor-pointer"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Historial de Movimientos
            </h1>
            <p className="text-xs text-muted-foreground">
              Filtra, busca y audita tus ingresos, gastos y transferencias.
            </p>
          </div>
        </div>

        {onOpenExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExport}
            className="h-8 text-xs font-medium gap-1.5 border-border bg-card hover:bg-accent cursor-pointer"
          >
            <Download className="size-3.5 text-primary" />
            Exportar
          </Button>
        )}
      </div>

      {/* Filter Section Card */}
      <Card className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3.5">
        {/* 1. Search Bar */}
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nota, categoría o cuenta..."
            className="pl-9 pr-9 h-9 text-xs font-sans bg-muted/30 border-border/60 focus:bg-background"
          />
          {search.trim() !== "" && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 size-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* 2. Type Tabs (Todos / Ingresos / Gastos / Transferencias) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono">
          <button
            type="button"
            onClick={() => setType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              type === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
            }`}
          >
            Todos ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              type === "income"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            }`}
          >
            <ArrowDownLeft className="size-3.5" />
            Ingresos
          </button>
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              type === "expense"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
            }`}
          >
            <ArrowUpRight className="size-3.5" />
            Gastos
          </button>
          <button
            type="button"
            onClick={() => setType("transfer")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              type === "transfer"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
            }`}
          >
            <ArrowLeftRight className="size-3.5" />
            Transferencias
          </button>
        </div>

        {/* 3. Secondary Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/40 font-mono text-xs">
          {/* Account Filter Select */}
          <div className="relative">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 pr-8 py-2 text-xs outline-none focus:border-primary cursor-pointer hover:bg-muted/50 text-foreground truncate"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none text-muted-foreground" />
          </div>

          {/* Category Filter Select */}
          <div className="relative">
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 pr-8 py-2 text-xs outline-none focus:border-primary cursor-pointer hover:bg-muted/50 text-foreground truncate"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.type === "income" ? "🟢" : "🔴"} {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none text-muted-foreground" />
          </div>

          {/* Date Range Select */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateFilter)}
                className="w-full appearance-none rounded-lg border border-border/60 bg-muted/30 px-3 pr-8 py-2 text-xs outline-none focus:border-primary cursor-pointer hover:bg-muted/50 text-foreground"
              >
                {(Object.keys(DATE_LABELS) as DateFilter[]).map((dKey) => (
                  <option key={dKey} value={dKey}>
                    {DATE_LABELS[dKey]}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none text-muted-foreground" />
            </div>

            {hasActiveFilters && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs font-semibold cursor-pointer shrink-0"
                title="Limpiar todos los filtros"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Results KPI Bar Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">
            {filtered.length} {filtered.length === 1 ? "movimiento encontrado" : "movimientos encontrados"}
          </span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Filtrado
            </Badge>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-3">
            {totalARS !== 0 && (
              <span className={`font-bold tabular-nums ${totalARS > 0 ? "text-emerald-400" : "text-foreground"}`}>
                ARS: {totalARS > 0 ? "+" : ""}{formatShort(totalARS, "ARS")}
              </span>
            )}
            {totalUSD !== 0 && (
              <span className={`font-bold tabular-nums ${totalUSD > 0 ? "text-emerald-400" : "text-primary"}`}>
                USD: {totalUSD > 0 ? "+" : ""}{formatShort(totalUSD, "USD")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 5. Transaction List Output */}
      <div>
        <TransactionList transactions={filtered} onEditTransaction={onEditTransaction} />
      </div>
    </div>
  )
}
