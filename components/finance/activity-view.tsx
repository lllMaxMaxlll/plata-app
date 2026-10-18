"use client"

import { useMemo, useState } from "react"
import { Download, Search, X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react"
import type { TransactionType, Transaction } from "@/lib/finance-data"
import { formatShort, transactionCurrency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { TransactionList } from "./transaction-list"
import { useUI } from "./ui-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { OptionSelect } from "./option-select"
import { Segmented } from "./segmented"

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
}: {
  onEditTransaction: (tx: Transaction) => void
  onOpenExport?: () => void
}) {
  const { transactions, accounts, categories, getAccount } = useFinance()
  const { mask } = useUI()

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
      <PageHeader
        route="activity"
        description="Filtrá, buscá y auditá tus ingresos, gastos y transferencias."
        actions={
          onOpenExport && (
            <Button variant="outline" onClick={onOpenExport}>
              <Download className="size-4" />
              Exportar
            </Button>
          )
        }
      />

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
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 size-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* 2. Type Tabs (Todos / Ingresos / Gastos / Transferencias) */}
        <div className="overflow-x-auto pb-1 no-scrollbar">
          <Segmented
            ariaLabel="Tipo de movimiento"
            value={type}
            onValueChange={setType}
            options={[
              { value: "all", label: `Todos (${transactions.length})` },
              { value: "income", label: <><ArrowDownLeft className="size-3.5 text-success" />Ingresos</> },
              { value: "expense", label: <><ArrowUpRight className="size-3.5 text-destructive" />Gastos</> },
              { value: "transfer", label: <><ArrowLeftRight className="size-3.5 text-chart-1" />Transferencias</> },
            ]}
          />
        </div>

        {/* 3. Secondary Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/40 font-mono text-xs">
          {/* Account Filter Select */}
          <div className="relative">
            <OptionSelect
              ariaLabel="Filtrar por cuenta"
              value={accountId}
              onValueChange={setAccountId}
              options={[
                { value: "all", label: "Todas las cuentas" },
                ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
              ]}
            />
          </div>

          {/* Category Filter Select */}
          <div className="relative">
            <OptionSelect
              ariaLabel="Filtrar por categoría"
              value={categoryName}
              onValueChange={setCategoryName}
              options={[
                { value: "all", label: "Todas las categorías" },
                ...categories.map((c) => ({
                  value: c.name,
                  label: `${c.name} · ${c.type === "income" ? "ingreso" : "gasto"}`,
                })),
              ]}
            />
          </div>

          {/* Date Range Select */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <OptionSelect
                ariaLabel="Filtrar por fecha"
                value={dateRange}
                onValueChange={setDateRange}
                options={(Object.keys(DATE_LABELS) as DateFilter[]).map((dKey) => ({
                  value: dKey,
                  label: DATE_LABELS[dKey],
                }))}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs font-semibold shrink-0"
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
            <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border-primary/20">
              Filtrado
            </Badge>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-3">
            {totalARS !== 0 && (
              <span className={`font-bold tabular-nums ${totalARS > 0 ? "text-success" : "text-foreground"}`}>
                ARS: {mask(`${totalARS > 0 ? "+" : ""}${formatShort(totalARS, "ARS")}`)}
              </span>
            )}
            {totalUSD !== 0 && (
              <span className={`font-bold tabular-nums ${totalUSD > 0 ? "text-success" : "text-primary"}`}>
                USD: {mask(`${totalUSD > 0 ? "+" : ""}${formatShort(totalUSD, "USD")}`)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 5. Transaction List Output */}
      <div>
        <TransactionList
          transactions={filtered}
          onEditTransaction={onEditTransaction}
          empty={hasActiveFilters ? "No hay movimientos para este filtro." : "Todavía no registraste movimientos."}
        />
      </div>
    </div>
  )
}
