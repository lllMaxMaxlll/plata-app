"use client"

import type { ReactNode } from "react"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Paperclip } from "lucide-react"
import { accountLabel, formatShort, type Transaction, transactionCurrency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { cn, clickableRowProps, focusRing } from "@/lib/utils"
import { relativeDate } from "@/lib/relative-date"

function TransactionRow({
  tx,
  onEditTransaction,
}: {
  tx: Transaction
  onEditTransaction?: (tx: Transaction) => void
}) {
  const { getAccount, vehicles } = useFinance()
  const { mask } = useUI()
  const account = getAccount(tx.accountId)
  const toAccount = tx.toAccountId ? getAccount(tx.toAccountId) : undefined
  const vehicle = tx.vehicleId ? vehicles?.find((v) => v.id === tx.vehicleId) : undefined

  const config = {
    income: {
      Icon: ArrowDownLeft,
      tone: "text-success",
      bg: "bg-success/10 border-success/20",
      sign: "+",
      amountClass: "text-success font-mono font-bold",
    },
    expense: {
      Icon: ArrowUpRight,
      tone: "text-destructive",
      bg: "bg-destructive/10 border-destructive/20",
      sign: "-",
      amountClass: "text-destructive font-mono font-bold",
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
      ? `${accountLabel(account)} → ${accountLabel(toAccount)}`
      : vehicle
      ? `${tx.category} (${vehicle.name}) · ${accountLabel(account)}`
      : `${tx.category} · ${accountLabel(account)}`

  return (
    <li
      {...clickableRowProps(
        () => onEditTransaction?.(tx),
        `Editar movimiento ${tx.note || tx.category}`
      )}
      className={cn(
        "flex cursor-pointer items-center gap-3 py-2.5 px-3 transition-colors hover:bg-muted/40 rounded-md border border-transparent hover:border-border -mx-1",
        focusRing
      )}
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
          {mask(`${config.sign}${formatShort(tx.amount, transactionCurrency(tx, account) ?? "ARS")}`)}
        </p>
        <p className="text-[11px] text-muted-foreground">{relativeDate(tx.date)}</p>
      </div>
    </li>
  )
}

export function TransactionList({
  transactions,
  onEditTransaction,
  empty = "No hay movimientos.",
}: {
  transactions: Transaction[]
  onEditTransaction?: (tx: Transaction) => void
  /** Qué mostrar sin movimientos: depende de si hay un filtro aplicado o no. */
  empty?: ReactNode
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
        {empty}
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

