"use client"

import { useState } from "react"
import { Eye, EyeOff, LogOut, ArrowLeftRight } from "lucide-react"
import { formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"

export function DashboardHeader({ onOpenExchange }: { onOpenExchange: () => void }) {
  const { user, totalsByCurrency, logout } = useFinance()
  const [hidden, setHidden] = useState(false)

  const mask = (value: string) => (hidden ? "••••••" : value)

  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola,</p>
          <p className="text-base font-semibold tracking-tight">{user?.name ?? "Usuario"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Mostrar saldos" : "Ocultar saldos"}
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            onClick={logout}
            aria-label="Cerrar sesión"
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Saldo consolidado
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/60 p-3.5">
            <p className="text-xs text-muted-foreground">Pesos (ARS)</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {mask(formatShort(totalsByCurrency.ARS, "ARS"))}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3.5">
            <p className="text-xs text-muted-foreground">Dólares (USD)</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-primary">
              {mask(formatShort(totalsByCurrency.USD, "USD"))}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenExchange}
          className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary/10 py-3 text-xs font-semibold text-primary hover:bg-primary/20 active:scale-[0.99] transition-all cursor-pointer"
        >
          <ArrowLeftRight className="size-4" />
          Cambio de moneda
        </button>
      </div>
    </header>
  )
}
