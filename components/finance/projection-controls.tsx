"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SlidersHorizontal,
  TrendingUp,
  Percent,
  Calendar,
  DollarSign,
  Flame,
  Sparkles,
  ArrowRightLeft
} from "lucide-react"
import { type Currency } from "@/lib/simulation-engine"

export interface ProjectionControlsProps {
  // Horizon & General
  horizonMonths: number
  onHorizonChange: (months: number) => void
  displayCurrency: Currency
  onCurrencyChange: (currency: Currency) => void
  isRealTerms: boolean
  onRealTermsChange: (real: boolean) => void

  // Auto-sync with the accounts stored in Supabase
  useRealAccounts: boolean
  onUseRealAccountsChange: (useReal: boolean) => void

  // Initial Net Worth
  initialARS: number
  onInitialARSChange: (val: number) => void
  initialUSD: number
  onInitialUSDChange: (val: number) => void

  // Monthly Savings
  savingsARS: number
  onSavingsARSChange: (val: number) => void
  savingsUSD: number
  onSavingsUSDChange: (val: number) => void

  // Macro Economic Variables
  annualInflation: number
  onAnnualInflationChange: (val: number) => void
  annualDevaluation: number
  onAnnualDevaluationChange: (val: number) => void
  annualReturnARS: number
  onAnnualReturnARSChange: (val: number) => void
  annualReturnUSD: number
  onAnnualReturnUSDChange: (val: number) => void
  /** Cartera de acciones: suma al patrimonio pero no financia metas. */
  portfolioUSD?: number
  /** Deuda ya vencida, ya descontada del patrimonio inicial. */
  overdueARS?: number
  overdueUSD?: number
  /** Ahorro mensual deducido de los movimientos reales del usuario. */
  savingsEstimate?: { ARS: number; USD: number; monthsUsed: number }
  /** true si el ahorro que se está usando sale del historial y no de una edición. */
  usesEstimatedSavings?: boolean
  onUseEstimatedSavings?: () => void
  /** Saldos reales, para avisar cuando el patrimonio manual no los refleja. */
  realARSBalance?: number
  realLiquidUSD?: number
  onUseRealBalances?: () => void
  exchangeRate: number
  onExchangeRateChange: (val: number) => void

  // Cotización en vivo
  onSyncMacro?: () => void
  isSyncingMacro?: boolean
  lastMacroSyncDate?: string
  dollarRates?: { blue: number; oficial: number; mep: number; ccl: number }
}

export function ProjectionControls({
  horizonMonths,
  onHorizonChange,
  displayCurrency,
  onCurrencyChange,
  isRealTerms,
  onRealTermsChange,
  useRealAccounts,
  onUseRealAccountsChange,
  initialARS,
  onInitialARSChange,
  initialUSD,
  onInitialUSDChange,
  savingsARS,
  onSavingsARSChange,
  savingsUSD,
  onSavingsUSDChange,
  annualInflation,
  onAnnualInflationChange,
  annualDevaluation,
  onAnnualDevaluationChange,
  annualReturnARS,
  onAnnualReturnARSChange,
  annualReturnUSD,
  onAnnualReturnUSDChange,
  portfolioUSD = 0,
  overdueARS = 0,
  overdueUSD = 0,
  savingsEstimate,
  usesEstimatedSavings = false,
  onUseEstimatedSavings,
  realARSBalance = 0,
  realLiquidUSD = 0,
  onUseRealBalances,
  exchangeRate,
  onExchangeRateChange,
  onSyncMacro,
  isSyncingMacro,
  lastMacroSyncDate,
  dollarRates,
}: ProjectionControlsProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Global View Options: Currency, Horizon, Real vs Nominal */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              Parámetros de Simulación
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Visualización:</span>
              <Tabs
                value={displayCurrency}
                onValueChange={(val) => onCurrencyChange(val as Currency)}
                className="h-8"
              >
                <TabsList className="h-8 bg-muted/60 p-0.5">
                  <TabsTrigger value="ARS" className="h-7 px-3 text-xs font-semibold">
                    $ ARS
                  </TabsTrigger>
                  <TabsTrigger value="USD" className="h-7 px-3 text-xs font-semibold">
                    US$ USD
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Horizon Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Horizonte Temporal
              </Label>
              <span className="text-xs font-semibold text-primary">
                {horizonMonths / 12} {horizonMonths / 12 === 1 ? "Año" : "Años"} ({horizonMonths} meses)
              </span>
            </div>
            <Tabs
              value={String(horizonMonths)}
              onValueChange={(val) => onHorizonChange(Number(val))}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-9 bg-muted/60 p-1">
                <TabsTrigger value="12" className="text-xs font-medium">1 Año</TabsTrigger>
                <TabsTrigger value="24" className="text-xs font-medium">2 Años</TabsTrigger>
                <TabsTrigger value="36" className="text-xs font-medium">3 Años</TabsTrigger>
                <TabsTrigger value="60" className="text-xs font-medium">5 Años</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Real vs Nominal Terms Switch */}
          <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-orange-400" />
                <span className="text-xs font-semibold">Ajustar por Inflación Real</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Descuentar la pérdida del poder adquisitivo mes a mes
              </p>
            </div>
            <Switch
              checked={isRealTerms}
              onCheckedChange={onRealTermsChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Initial Capital & Savings */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-400" />
              Patrimonio Inicial y Capacidad de Ahorro
            </CardTitle>

            <div className="flex items-center gap-2">
              <Label htmlFor="sync-accounts" className="text-[11px] text-muted-foreground cursor-pointer">
                Sincronizar cuentas
              </Label>
              <Switch
                id="sync-accounts"
                checked={useRealAccounts}
                onCheckedChange={onUseRealAccountsChange}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Initial Net Worth Inputs */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Patrimonio Actual {useRealAccounts && "(Calculado desde tus cuentas)"}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">Saldo ARS</span>
                <Input
                  type="number"
                  disabled={useRealAccounts}
                  value={Number.isFinite(initialARS) ? initialARS : ""}
                  onChange={(e) => onInitialARSChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">Saldo USD</span>
                <Input
                  type="number"
                  disabled={useRealAccounts}
                  value={Number.isFinite(initialUSD) ? initialUSD : ""}
                  onChange={(e) => onInitialUSDChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
            </div>
            {!useRealAccounts &&
              (initialARS < realARSBalance * 0.5 || initialUSD < realLiquidUSD * 0.5) &&
              (realARSBalance > 0 || realLiquidUSD > 0) && (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1.5">
                  <p className="text-[11px] text-amber-500">
                    Estás simulando con un patrimonio menor al que tienen tus cuentas hoy ($
                    {realARSBalance.toLocaleString("es-AR", { maximumFractionDigits: 0 })} y US$
                    {realLiquidUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}). Con menos
                    capital inicial, las metas se ven mucho más lejos de lo que están.
                  </p>
                  {onUseRealBalances && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onUseRealBalances}
                      className="h-6 px-2 text-[10px] font-semibold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                    >
                      Usar mis saldos reales
                    </Button>
                  )}
                </div>
              )}
            {(overdueARS > 0 || overdueUSD > 0) && (
              <p className="text-[10px] text-amber-500/90 mt-1.5">
                − {overdueARS > 0 && `$${overdueARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                {overdueARS > 0 && overdueUSD > 0 && " y "}
                {overdueUSD > 0 && `US$${overdueUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}{" "}
                de vencimientos impagos, ya descontados.
              </p>
            )}
            {portfolioUSD > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                + US${portfolioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })} en cartera
                de acciones. Suma al patrimonio proyectado, pero no financia metas: habría que
                venderla primero.
              </p>
            )}
          </div>

          {/* Monthly Savings Inputs */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <Label className="text-xs font-medium text-muted-foreground">
                Ahorro Mensual Estimado
              </Label>
              {savingsEstimate && savingsEstimate.monthsUsed > 0 && onUseEstimatedSavings && (
                usesEstimatedSavings ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20"
                  >
                    Calculado de tus movimientos
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onUseEstimatedSavings}
                    className="h-6 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                    title={`Mediana de ingresos menos gastos de tus últimos ${savingsEstimate.monthsUsed} meses cerrados`}
                  >
                    Volver a mi promedio real
                  </Button>
                )
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">+ ARS / mes</span>
                <Input
                  type="number"
                  value={Number.isFinite(savingsARS) ? savingsARS : ""}
                  onChange={(e) => onSavingsARSChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">+ USD / mes</span>
                <Input
                  type="number"
                  value={Number.isFinite(savingsUSD) ? savingsUSD : ""}
                  onChange={(e) => onSavingsUSDChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
            </div>
            {savingsARS === 0 && savingsUSD === 0 && (
              <p className="text-[11px] text-amber-500 mt-1.5">
                Con un ahorro de cero, el patrimonio no crece y ninguna meta se alcanza nunca.
                Cargá cuánto te queda por mes.
              </p>
            )}
            {savingsEstimate && savingsEstimate.monthsUsed > 0 && !usesEstimatedSavings && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Tus movimientos de los últimos {savingsEstimate.monthsUsed}{" "}
                {savingsEstimate.monthsUsed === 1 ? "mes cerrado" : "meses cerrados"} dan una
                mediana de ${savingsEstimate.ARS.toLocaleString("es-AR")} y US$
                {savingsEstimate.USD.toLocaleString("es-AR")} por mes.
              </p>
            )}
          </div>

          {/* Tipo de cambio y sincronización */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="size-3 text-muted-foreground" /> Tipo de Cambio (USD/ARS)
              </Label>

              {onSyncMacro && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSyncMacro}
                  disabled={isSyncingMacro}
                  className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer shadow-xs"
                >
                  <Sparkles className={`size-3 text-amber-400 ${isSyncingMacro ? "animate-spin" : ""}`} />
                  {isSyncingMacro ? "Actualizando..." : "Actualizar cotización"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={exchangeRate || ""}
                onChange={(e) => onExchangeRateChange(Number(e.target.value))}
                className="h-9 text-xs font-bold tabular-nums"
              />
            </div>

            {/* Live Dollar Badges */}
            {dollarRates && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Blue: ${dollarRates.blue}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold bg-primary/10 text-primary border-primary/20">
                  MEP: ${dollarRates.mep}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold bg-muted text-muted-foreground">
                  Oficial: ${dollarRates.oficial}
                </Badge>
              </div>
            )}

            {lastMacroSyncDate && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Última actualización guardada: {new Date(lastMacroSyncDate).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Advanced Economic Indicators (Collapsible) */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg overflow-hidden">
        {/* Es un botón de verdad: como div con onClick no había forma de abrirlo
            con el teclado ni de saber si estaba abierto con un lector. */}
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            aria-controls="ajustes-macro"
            className="w-full flex items-center justify-between gap-2 text-left select-none cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Percent className="size-4 text-cyan-400" />
              Ajustes Macroeconómicos Avanzados
            </CardTitle>
            <span className="h-7 px-2 inline-flex items-center text-xs font-mono text-muted-foreground">
              {showAdvanced ? "Ocultar" : "Personalizar"}
            </span>
          </button>
          <CardDescription className="text-[11px]">
            {showAdvanced
              ? "Ajusta inflación, devaluación y retorno de inversión para afinar escenarios."
              : "Inflación, devaluación y rendimiento esperados. Los escenarios se abren a partir de estos valores."}
          </CardDescription>
        </CardHeader>

        {showAdvanced && (
          <CardContent
            id="ajustes-macro"
            className="space-y-5 border-t border-border/40 pt-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Annual Inflation Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Flame className="size-3.5 text-rose-400" /> Inflación Anual Esperada
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={annualInflation}
                    onChange={(e) => onAnnualInflationChange(Number(e.target.value))}
                    className="h-7 w-16 text-right text-xs font-bold tabular-nums px-2"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={annualInflation}
                onValueChange={onAnnualInflationChange}
                min={0}
                max={200}
                step={1}
              />
            </div>

            {/* Annual Devaluation Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-amber-400" /> Devaluación Anual Esperada (Peso/USD)
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={annualDevaluation}
                    onChange={(e) => onAnnualDevaluationChange(Number(e.target.value))}
                    className="h-7 w-16 text-right text-xs font-bold tabular-nums px-2"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={annualDevaluation}
                onValueChange={onAnnualDevaluationChange}
                min={0}
                max={200}
                step={1}
              />
            </div>

            {/* Rendimiento en pesos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-emerald-400" /> Rendimiento Anual en Pesos
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={annualReturnARS}
                    onChange={(e) => onAnnualReturnARSChange(Number(e.target.value))}
                    className="h-7 w-16 text-right text-xs font-bold tabular-nums px-2"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={annualReturnARS}
                onValueChange={onAnnualReturnARSChange}
                min={-20}
                max={200}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Plazo fijo, cuenta remunerada o fondo money market.
              </p>
            </div>

            {/* Rendimiento en dólares */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-cyan-400" /> Rendimiento Anual en Dólares
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={annualReturnUSD}
                    onChange={(e) => onAnnualReturnUSDChange(Number(e.target.value))}
                    className="h-7 w-16 text-right text-xs font-bold tabular-nums px-2"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={annualReturnUSD}
                onValueChange={onAnnualReturnUSDChange}
                min={-20}
                max={60}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Acciones, ETFs o bonos en dólares.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

    </div>
  )
}
