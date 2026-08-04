"use client"

import { Plus, Wallet } from "lucide-react"
import { ACCENT_BY_KIND, formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export function WalletCards({ onAddAccount }: { onAddAccount: () => void }) {
  const { accounts } = useFinance()

  return (
    <Card className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm font-sans">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <CardTitle className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          Mis Cuentas ({accounts.length})
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddAccount}
          className="flex items-center gap-1 text-xs font-medium text-primary h-7 px-2 cursor-pointer hover:bg-primary/10"
        >
          <Plus data-icon="inline-start" className="size-3.5" />
          Agregar
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="mt-4 text-center py-6 border border-dashed border-border/60 rounded-lg bg-muted/10 font-mono">
          <p className="text-xs text-muted-foreground mb-2">No tenés cuentas registradas.</p>
          <Button
            size="sm"
            onClick={onAddAccount}
            className="h-7 text-xs font-semibold bg-primary text-primary-foreground cursor-pointer"
          >
            + Crear Cuenta
          </Button>
        </div>
      ) : (
        <div className="mt-3.5 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 scrollbar-none">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex w-44 lg:w-full shrink-0 flex-col lg:flex-row lg:items-center justify-between gap-2 overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-3 hover:bg-muted/50 hover:border-primary/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition-transform group-hover:scale-105"
                  style={{ background: ACCENT_BY_KIND[acc.kind] + "22", color: ACCENT_BY_KIND[acc.kind] }}
                >
                  <AccountIcon kind={acc.kind} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">{acc.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">{acc.kind}</p>
                </div>
              </div>

              <div className="text-right font-mono">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {formatShort(acc.balance, acc.currency)}
                </p>
                <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono border-border text-muted-foreground mt-0.5">
                  {acc.currency}
                </Badge>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={onAddAccount}
            className="flex h-auto lg:h-9 w-32 lg:w-full shrink-0 flex-col lg:flex-row items-center justify-center gap-1.5 rounded-lg border-dashed border-border/80 bg-card/40 py-2.5 text-muted-foreground hover:border-primary hover:text-primary cursor-pointer text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>Nueva Cuenta</span>
          </Button>
        </div>
      )}
    </Card>
  )
}
