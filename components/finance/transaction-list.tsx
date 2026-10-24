"use client"

import type { ReactNode } from "react"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Paperclip } from "lucide-react"
import { accountLabel, formatShort, type Transaction, transactionCurrency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { cn, clickableRowProps, focusRing } from "@/lib/utils"
import { relativeDate } from "@/lib/relative-date"
import { IconTile } from "./lucas-ui"

function TransactionRow({
  tx,
  onEditTransaction,
  showDate,
}: {
  tx: Transaction
  onEditTransaction?: (tx: Transaction) => void
  showDate: boolean
}) {
  const { getAccount, vehicles } = useFinance()
  const { mask } = useUI()
  const account = getAccount(tx.accountId)
  const toAccount = tx.toAccountId ? getAccount(tx.toAccountId) : undefined
  const vehicle = tx.vehicleId ? vehicles?.find((v) => v.id === tx.vehicleId) : undefined

  const config = {
    income: { Icon: ArrowDownLeft, tile: "bg-lime", sign: "+", amountClass: "text-success" },
    expense: { Icon: ArrowUpRight, tile: "bg-coral", sign: "−", amountClass: "text-foreground" },
    transfer: { Icon: ArrowLeftRight, tile: "bg-sky", sign: "", amountClass: "text-muted-foreground" },
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
        "-mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-lime/20",
        focusRing
      )}
    >
      <IconTile Icon={config.Icon} className={config.tile} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {tx.note || tx.category}
          {tx.receiptName && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("font-mono text-sm font-semibold", config.amountClass)}>
          {mask(`${config.sign}${formatShort(tx.amount, transactionCurrency(tx, account) ?? "ARS")}`)}
        </p>
        {showDate && <p className="font-mono text-[11px] text-muted-foreground">{relativeDate(tx.date)}</p>}
      </div>
    </li>
  )
}

export function TransactionList({
  transactions,
  onEditTransaction,
  empty = "No hay movimientos.",
  showDate = true,
}: {
  transactions: Transaction[]
  onEditTransaction?: (tx: Transaction) => void
  /** Qué mostrar sin movimientos: depende de si hay un filtro aplicado o no. */
  empty?: ReactNode
  /** false cuando la lista ya viene agrupada por día y la fecha sobra. */
  showDate?: boolean
}) {
  if (transactions.length === 0) {
    return (
      <div className="my-2 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }
  return (
    <ul className="divide-y-[1.5px] divide-dashed divide-foreground/15">
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} onEditTransaction={onEditTransaction} showDate={showDate} />
      ))}
    </ul>
  )
}

