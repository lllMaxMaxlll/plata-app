"use client"

import { useState } from "react"
import { useUI } from "./ui-context"
import { Eye, EyeOff, RefreshCw, ArrowLeftRight, Wallet } from "lucide-react"
import { formatCurrency, formatShort, type Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Segmented } from "./segmented"

export function DashboardHeader({ onOpenExchange }: { onOpenExchange: () => void }) {
  const { totalsByCurrency, portfolioTotalValue, macroSettings, settingsLoaded, syncMacroFromApi } = useFinance()
  const { balancesHidden, toggleBalancesHidden, mask } = useUI()
  const [consolidationCurrency, setConsolidationCurrency] = useState<Currency>("USD")
  const [syncingFx, setSyncingFx] = useState(false)

  // Sin fila guardada, el tipo de cambio es el valor por defecto del código:
  // se avisa en vez de consolidar el patrimonio con un número inventado.
  const fxConfigured = Boolean(macroSettings.lastUpdated)
  const fxKind = Object.entries(macroSettings.rates ?? {}).find(
    ([, value]) => value === macroSettings.exchangeRate
  )?.[0]

  async function handleSyncFx() {
    setSyncingFx(true)
    try {
      await syncMacroFromApi()
    } finally {
      setSyncingFx(false)
    }
  }

  const fxRate = macroSettings.exchangeRate || 1250
  const usdTotal = (totalsByCurrency.USD || 0) + (portfolioTotalValue || 0)
  const arsTotal = totalsByCurrency.ARS || 0

  const netWorthInUSD = usdTotal + arsTotal / fxRate
  const netWorthInARS = arsTotal + usdTotal * fxRate

  const totalNetWorth = consolidationCurrency === "USD" ? netWorthInUSD : netWorthInARS

  return (
    <header className="space-y-4">
      {/* Hero Net Worth Card */}
      <Card className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-sm">
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="size-3.5 text-primary" /> Patrimonio neto
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleBalancesHidden}
              aria-label={balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
              title={balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
              className="text-muted-foreground hover:text-foreground"
            >
              {balancesHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>

          {/* Consolidation Currency Switch */}
          <Segmented
            ariaLabel="Moneda del patrimonio"
            size="sm"
            value={consolidationCurrency}
            onValueChange={setConsolidationCurrency}
            options={[
              { value: "USD", label: "USD" },
              { value: "ARS", label: "ARS" },
            ]}
          />
        </div>

        {/* Hero Amount Display */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-3xl font-bold font-mono tracking-tight tabular-nums text-foreground">
              {mask(formatCurrency(totalNetWorth, consolidationCurrency))}
            </h2>
            {settingsLoaded && !fxConfigured ? (
              <Button variant="outline" size="xs" onClick={handleSyncFx} disabled={syncingFx}>
                <RefreshCw className={syncingFx ? "size-3 animate-spin" : "size-3"} />
                Tipo de cambio sin cargar · actualizar
              </Button>
            ) : (
              <Badge
                variant="secondary"
                className="text-[11px] font-mono text-muted-foreground bg-muted/40 border border-border/40"
                title={
                  fxConfigured
                    ? `Actualizado el ${new Date(macroSettings.lastUpdated).toLocaleDateString("es-AR")}`
                    : undefined
                }
              >
                TC{fxKind ? ` ${fxKind}` : ""}: {formatCurrency(fxRate, "ARS")}
              </Badge>
            )}
          </div>
        </div>

        {/* Currency Sub-breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border/40 font-mono text-xs">
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
            <span className="text-[11px] uppercase text-muted-foreground font-semibold">Pesos (ARS)</span>
            <p className="mt-0.5 font-bold text-foreground tabular-nums">
              {mask(formatShort(arsTotal, "ARS"))}
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
            <span className="text-[11px] uppercase text-muted-foreground font-semibold">Dólares (USD)</span>
            <p className="mt-0.5 font-bold text-primary tabular-nums">
              {mask(formatShort(usdTotal, "USD"))}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={onOpenExchange} className="mt-4 w-full">
          <ArrowLeftRight className="size-4" />
          Cambio / Transferir
        </Button>
      </Card>
    </header>
  )
}
