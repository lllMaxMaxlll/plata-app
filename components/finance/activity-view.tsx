"use client"

import { useMemo, useState } from "react"
import { Download, ArrowLeft } from "lucide-react"
import type { TransactionType, Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { TransactionList } from "./transaction-list"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type TypeFilter = "all" | TransactionType
type DateFilter = "all" | "today" | "week" | "month"

export function ActivityView({
  onEditTransaction,
  onOpenExport,
  onBack,
}: {
  onEditTransaction: (tx: Transaction) => void
  onOpenExport?: () => void
  onBack?: () => void
}) {
  const { transactions, accounts } = useFinance()
  const [accountId, setAccountId] = useState<string>("all")
  const [type, setType] = useState<TypeFilter>("all")
  const [dateRange, setDateRange] = useState<DateFilter>("all")

  const filtered = useMemo(() => {
    const now = Date.now()
    return transactions.filter((t) => {
      if (accountId !== "all" && t.accountId !== accountId && t.toAccountId !== accountId)
        return false
      if (type !== "all" && t.type !== type) return false
      if (dateRange !== "all") {
        const ageDays = (now - new Date(t.date).getTime()) / 86400000
        if (dateRange === "today" && ageDays > 1) return false
        if (dateRange === "week" && ageDays > 7) return false
        if (dateRange === "month" && ageDays > 31) return false
      }
      return true
    })
  }, [transactions, accountId, type, dateRange])

  return (
    <section className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onBack}
              className="rounded-xl shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <h1 className="text-xl font-semibold tracking-tight">Movimientos</h1>
        </div>
        {onOpenExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExport}
            className="flex items-center gap-1.5 rounded-xl text-xs font-semibold h-8"
          >
            <Download className="size-3.5 text-primary" />
            Exportar
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <FilterRow label="Tipo">
          <Chip active={type === "all"} onClick={() => setType("all")}>Todos</Chip>
          <Chip active={type === "income"} onClick={() => setType("income")}>Ingresos</Chip>
          <Chip active={type === "expense"} onClick={() => setType("expense")}>Gastos</Chip>
          <Chip active={type === "transfer"} onClick={() => setType("transfer")}>Transfer.</Chip>
        </FilterRow>

        <FilterRow label="Cuenta">
          <Chip active={accountId === "all"} onClick={() => setAccountId("all")}>Todas</Chip>
          {accounts.map((a) => (
            <Chip key={a.id} active={accountId === a.id} onClick={() => setAccountId(a.id)}>
              {a.name}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Fecha">
          <Chip active={dateRange === "all"} onClick={() => setDateRange("all")}>Siempre</Chip>
          <Chip active={dateRange === "today"} onClick={() => setDateRange("today")}>Hoy</Chip>
          <Chip active={dateRange === "week"} onClick={() => setDateRange("week")}>7 días</Chip>
          <Chip active={dateRange === "month"} onClick={() => setDateRange("month")}>30 días</Chip>
        </FilterRow>
      </div>

      <div className="mt-4">
        <TransactionList transactions={filtered} onEditTransaction={onEditTransaction} />
      </div>
    </section>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="cursor-pointer shrink-0 whitespace-nowrap px-3.5 py-1 text-xs font-medium"
    >
      {children}
    </Badge>
  )
}
