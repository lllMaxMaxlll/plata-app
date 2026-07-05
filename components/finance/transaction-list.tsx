"use client"

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Paperclip } from "lucide-react"
import { formatShort, type Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"

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
      tone: "text-primary",
      bg: "bg-primary/10",
      sign: "+",
      amountClass: "text-primary",
    },
    expense: {
      Icon: ArrowUpRight,
      tone: "text-destructive",
      bg: "bg-destructive/10",
      sign: "-",
      amountClass: "text-destructive",
    },
    transfer: {
      Icon: ArrowLeftRight,
      tone: "text-muted-foreground",
      bg: "bg-muted",
      sign: "",
      amountClass: "text-foreground",
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
      className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-muted/10 rounded-xl px-2.5 -mx-2.5"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${config.bg} ${config.tone}`}>
        <config.Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {tx.note || tx.category}
          {tx.receiptName && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold tabular-nums ${config.amountClass}`}>
          {config.sign}
          {formatShort(tx.amount, account?.currency ?? "ARS")}
        </p>
        <p className="text-xs text-muted-foreground">{relativeDate(tx.date)}</p>
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
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay movimientos para este filtro.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-border">
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} onEditTransaction={onEditTransaction} />
      ))}
    </ul>
  )
}
