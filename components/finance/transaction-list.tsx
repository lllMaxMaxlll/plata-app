"use client"

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Paperclip } from "lucide-react"
import { formatShort, type Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { Badge } from "@/components/ui/badge"

function relativeDate(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays <= 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  if (diffDays < 7) return `Hace ${diffDays} días`
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

function TransactionRow({
  tx,
  onEditTransaction,
}: {
  tx: Transaction
  onEditTransaction?: (tx: Transaction) => void
}) {
  const { getAccount, vehicles } = useFinance()
  const account = getAccount(tx.accountId)
  const toAccount = tx.toAccountId ? getAccount(tx.toAccountId) : undefined
  const vehicle = tx.vehicleId ? vehicles?.find((v) => v.id === tx.vehicleId) : undefined

  const config = {
    income: {
      Icon: ArrowDownLeft,
      tone: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      sign: "+",
      amountClass: "text-emerald-400 font-mono font-bold",
    },
    expense: {
      Icon: ArrowUpRight,
      tone: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
      sign: "-",
      amountClass: "text-red-400 font-mono font-bold",
    },
    transfer: {
      Icon: ArrowLeftRight,
      tone: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      sign: "",
      amountClass: "text-foreground font-mono font-bold",
    },
  }[tx.type]

  const subtitle =
    tx.type === "transfer"
      ? `${account?.name} → ${toAccount?.name}`
      : vehicle
      ? `${tx.category} (${vehicle.name}) · ${account?.name}`
      : `${tx.category} · ${account?.name}`

  return (
    <li
      onClick={() => onEditTransaction?.(tx)}
      className="flex cursor-pointer items-center gap-3 py-2.5 px-3 transition-colors hover:bg-muted/40 rounded-md border border-transparent hover:border-border -mx-1"
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-md border ${config.bg} ${config.tone}`}>
        <config.Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
          {tx.note || tx.category}
          {tx.receiptName && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
        </p>
        <p className="truncate text-[11px] font-mono text-muted-foreground">{subtitle}</p>
      </div>
      <div className="text-right font-mono">
        <p className={`text-xs ${config.amountClass}`}>
          {config.sign}
          {formatShort(tx.amount, account?.currency ?? "ARS")}
        </p>
        <p className="text-[10px] text-muted-foreground">{relativeDate(tx.date)}</p>
      </div>
    </li>
  )
}

export function TransactionList({
  transactions,
  onEditTransaction,
}: {
  transactions: Transaction[]
  onEditTransaction?: (tx: Transaction) => void
}) {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-muted-foreground border border-dashed border-border rounded-md">
        No hay eventos para este filtro.
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-1 mt-1">
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} onEditTransaction={onEditTransaction} />
      ))}
    </ul>
  )
}

