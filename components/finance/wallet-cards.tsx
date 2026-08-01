"use client"

import { Plus } from "lucide-react"
import { ACCENT_BY_KIND, formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export function WalletCards({ onAddAccount }: { onAddAccount: () => void }) {
  const { accounts } = useFinance()

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-5">
        <h2 className="text-sm font-semibold tracking-tight">Mis cuentas</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddAccount}
          className="flex items-center gap-1 text-xs font-medium text-primary h-7 px-2"
        >
          <Plus className="size-3.5" />
          Agregar
        </Button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {accounts.map((acc) => (
          <Card
            key={acc.id}
            className="relative flex w-44 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-4 isolate shadow-sm"
          >
            <span
              aria-hidden
              className="absolute -right-6 -top-6 size-20 rounded-full opacity-20 blur-xl"
              style={{ background: ACCENT_BY_KIND[acc.kind] }}
            />
            <div className="flex items-center justify-between">
              <span
                className="flex size-9 items-center justify-center rounded-xl"
                style={{ background: ACCENT_BY_KIND[acc.kind], color: "oklch(0.18 0.02 264)" }}
              >
                <AccountIcon kind={acc.kind} className="size-4.5" />
              </span>
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-semibold">
                {acc.currency}
              </Badge>
            </div>
            <div className="mt-6">
              <p className="truncate text-xs text-muted-foreground">{acc.name}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
                {formatShort(acc.balance, acc.currency)}
              </p>
            </div>
          </Card>
        ))}

        <Button
          variant="outline"
          onClick={onAddAccount}
          className="flex h-auto min-h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-dashed text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="size-5" />
          <span className="text-xs font-medium">Nueva cuenta</span>
        </Button>
      </div>
    </section>
  )
}
