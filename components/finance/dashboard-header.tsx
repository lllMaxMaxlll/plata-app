"use client"

import { useState } from "react"
import { Eye, EyeOff, LogOut, ArrowLeftRight } from "lucide-react"
import { formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Mostrar saldos" : "Ocultar saldos"}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Cerrar sesión"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <Card className="mt-5 rounded-xl p-5 shadow-sm">
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

        <Button
          variant="secondary"
          onClick={onOpenExchange}
          className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer"
        >
          <ArrowLeftRight className="size-4" />
          Cambio de moneda
        </Button>
      </Card>
    </header>
  )
}
