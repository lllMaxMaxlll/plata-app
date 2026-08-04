"use client"

import { useState } from "react"
import { Eye, EyeOff, ArrowLeftRight, Plus, Sparkles, Wallet, Globe } from "lucide-react"
import { formatCurrency, formatShort, type Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function DashboardHeader({
  onOpenExchange,
  onAddAccount,
  onAddTransaction,
}: {
  onOpenExchange: () => void
  onAddAccount?: () => void
  onAddTransaction?: () => void
}) {
  const { user, totalsByCurrency, portfolioTotalValue, macroSettings } = useFinance()
  const [hidden, setHidden] = useState(false)
  const [consolidationCurrency, setConsolidationCurrency] = useState<Currency>("USD")

  const fxRate = macroSettings.exchangeRate || 1250
  const usdTotal = (totalsByCurrency.USD || 0) + (portfolioTotalValue || 0)
  const arsTotal = totalsByCurrency.ARS || 0

  const netWorthInUSD = usdTotal + arsTotal / fxRate
  const netWorthInARS = arsTotal + usdTotal * fxRate

  const totalNetWorth = consolidationCurrency === "USD" ? netWorthInUSD : netWorthInARS

  const mask = (value: string) => (hidden ? "••••••••" : value)

  return (
    <header className="space-y-4">
      {/* Hero Net Worth Card */}
      <Card className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-sm">
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary" /> Patrimonio Neto Consolidado
            </span>
          </div>

          {/* Consolidation Currency Switch */}
          <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setConsolidationCurrency("USD")}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${consolidationCurrency === "USD"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setConsolidationCurrency("ARS")}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${consolidationCurrency === "ARS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              ARS
            </button>
          </div>
        </div>

        {/* Hero Amount Display */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-3xl font-bold font-mono tracking-tight tabular-nums text-foreground">
              {mask(formatCurrency(totalNetWorth, consolidationCurrency))}
            </h2>
            <Badge variant="secondary" className="text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border/40">
              TC: ${fxRate} ARS/USD
            </Badge>
          </div>
        </div>

        {/* Currency Sub-breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border/40 font-mono text-xs">
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Pesos (ARS)</span>
            <p className="mt-0.5 font-bold text-foreground tabular-nums">
              {mask(formatShort(arsTotal, "ARS"))}
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Dólares (USD)</span>
            <p className="mt-0.5 font-bold text-primary tabular-nums">
              {mask(formatShort(usdTotal, "USD"))}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons Bar */}
        <div className="mt-4 flex items-center gap-2 pt-1">
          {onAddTransaction && (
            <Button
              size="sm"
              onClick={onAddTransaction}
              className="flex-1 h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <Plus className="size-3.5" />
              Movimiento
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExchange}
            className="flex-1 h-9 text-xs font-medium gap-1.5 border-border bg-card hover:bg-accent cursor-pointer"
          >
            <ArrowLeftRight className="size-3.5 text-primary" />
            Cambio / Transferir
          </Button>

          {onAddAccount && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAccount}
              className="h-9 text-xs font-medium gap-1.5 border-border bg-card hover:bg-accent cursor-pointer px-3"
              title="Agregar nueva cuenta"
            >
              <Plus className="size-3.5" />
              Cuenta
            </Button>
          )}
        </div>
      </Card>
    </header>
  )
}
