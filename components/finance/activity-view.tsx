"use client"

import { useMemo, useState } from "react"
import { Download, Search, X } from "lucide-react"
import { differenceInCalendarDays, format } from "date-fns"
import { es } from "date-fns/locale"
import type { TransactionType, Transaction } from "@/lib/finance-data"
import { formatShort, transactionCurrency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { TransactionList } from "./transaction-list"
import { useUI } from "./ui-context"
import { Button } from "@/components/ui/button"
import { OptionSelect } from "./option-select"
import { Segmented } from "./segmented"
import { pageClass } from "./lucas-ui"
import { cn } from "@/lib/utils"

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

  // Lo que entró y salió de lo filtrado, por moneda. Las transferencias no son
  // ni ingreso ni gasto: mueven plata entre cuentas propias.
  const totals = useMemo(() => {
    const sum = { ARS: { in: 0, out: 0 }, USD: { in: 0, out: 0 } }
    for (const t of filtered) {
      const currency = transactionCurrency(t, getAccount(t.accountId)) ?? "ARS"
      if (t.type === "income") sum[currency].in += t.amount
      else if (t.type === "expense") sum[currency].out += t.amount
    }
    return sum
  }, [filtered, getAccount])

  // Agrupado por día calendario local, en el orden en que ya vienen.
  const days = useMemo(() => {
    const groups: { key: string; date: Date; items: Transaction[]; net: number }[] = []
    for (const t of filtered) {
      const date = new Date(t.date)
      const key = format(date, "yyyy-MM-dd")
      let group = groups[groups.length - 1]
      if (!group || group.key !== key) {
        group = { key, date, items: [], net: 0 }
        groups.push(group)
      }
      group.items.push(t)
      const currency = transactionCurrency(t, getAccount(t.accountId)) ?? "ARS"
      if (currency === "ARS") group.net += t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0
    }
    return groups
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
    <div className={pageClass}>
      <PageHeader
        route="activity"
        description="Buscá, filtrá y revisá todo lo que entró y salió."
        actions={
          onOpenExport && (
            <Button variant="outline" onClick={onOpenExport}>
              <Download className="size-4" />
              Exportar
            </Button>
          )
        }
      />

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="space-y-4 lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nota, categoría o cuenta"
              aria-label="Buscar movimientos"
              className="h-12 w-full rounded-2xl border-2 border-foreground bg-card pr-10 pl-10 text-sm font-semibold shadow-sm outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-lime"
            />
            {search.trim() !== "" && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
            <Segmented
              ariaLabel="Tipo de movimiento"
              value={type}
              onValueChange={setType}
              options={[
                { value: "all", label: "Todos" },
                { value: "income", label: "Ingresos" },
                { value: "expense", label: "Gastos" },
                { value: "transfer", label: "Transf." },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <OptionSelect
              ariaLabel="Filtrar por fecha"
              value={dateRange}
              onValueChange={setDateRange}
              options={(Object.keys(DATE_LABELS) as DateFilter[]).map((dKey) => ({ value: dKey, label: DATE_LABELS[dKey] }))}
            />
            <OptionSelect
              ariaLabel="Filtrar por cuenta"
              value={accountId}
              onValueChange={setAccountId}
              options={[
                { value: "all", label: "Todas las cuentas" },
                ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
              ]}
            />
            <div className="col-span-2 lg:col-span-1">
              <OptionSelect
                ariaLabel="Filtrar por categoría"
                value={categoryName}
                onValueChange={setCategoryName}
                options={[
                  { value: "all", label: "Todas las categorías" },
                  ...categories.map((c) => ({ value: c.name, label: `${c.name} · ${c.type === "income" ? "ingreso" : "gasto"}` })),
                ]}
              />
            </div>
          </div>

          <section className="rounded-2xl border-2 border-foreground bg-lime p-4 text-ink shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="cursor-pointer font-mono text-[11px] font-semibold underline underline-offset-2"
                >
                  limpiar filtros
                </button>
              )}
            </div>
            {(["ARS", "USD"] as const)
              .filter((c) => totals[c].in > 0 || totals[c].out > 0 || c === "ARS")
              .map((c) => (
                <div key={c} className="mt-3 grid grid-cols-3 gap-2 border-t-2 border-ink/15 pt-3">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase">Entró</p>
                    <p className="truncate text-sm font-extrabold">{mask(formatShort(totals[c].in, c))}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase">Salió</p>
                    <p className="truncate text-sm font-extrabold">{mask(formatShort(totals[c].out, c))}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase">Neto</p>
                    <p className="truncate text-sm font-extrabold">{mask(formatShort(totals[c].in - totals[c].out, c))}</p>
                  </div>
                </div>
              ))}
          </section>
        </aside>

        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          {days.length === 0 ? (
            <TransactionList
              transactions={[]}
              empty={hasActiveFilters ? "No hay movimientos para este filtro." : "Todavía no registraste movimientos."}
            />
          ) : (
            days.map((group) => (
              <section key={group.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {dayLabel(group.date)}
                  </h2>
                  {group.net !== 0 && (
                    <span className={cn("font-mono text-[11px] font-semibold", group.net > 0 ? "text-success" : "text-muted-foreground")}>
                      {mask(`${group.net > 0 ? "+" : "−"}${formatShort(Math.abs(group.net), "ARS")}`)}
                    </span>
                  )}
                </div>
                <div className="rounded-2xl border-2 border-foreground bg-card px-3.5">
                  <TransactionList transactions={group.items} onEditTransaction={onEditTransaction} showDate={false} />
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** "Hoy", "Ayer" y después "lunes 12 de octubre" (con año si no es el actual). */
function dayLabel(date: Date): string {
  const today = new Date()
  const diff = differenceInCalendarDays(today, date)
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Ayer"
  return format(date, date.getFullYear() === today.getFullYear() ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM yyyy", { locale: es })
}
