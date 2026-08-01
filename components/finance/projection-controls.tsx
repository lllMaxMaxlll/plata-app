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
  PlusCircle,
  Pencil,
  RefreshCw,
  Sparkles,
  ArrowRightLeft
} from "lucide-react"
import { type Currency, type BigPurchaseGoal } from "@/lib/simulation-engine"
import { formatCurrency, formatShort } from "@/lib/finance-data"

export interface ProjectionControlsProps {
  // Horizon & General
  horizonMonths: number
  onHorizonChange: (months: number) => void
  displayCurrency: Currency
  onCurrencyChange: (currency: Currency) => void
  isRealTerms: boolean
  onRealTermsChange: (real: boolean) => void

  // Auto-sync with Firestore accounts
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
  annualReturn: number
  onAnnualReturnChange: (val: number) => void
  exchangeRate: number
  onExchangeRateChange: (val: number) => void

  // Big Purchase Goal
  bigPurchaseGoal?: BigPurchaseGoal | null
  onOpenGoalModal: () => void
  onRemoveGoal: () => void
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
  annualReturn,
  onAnnualReturnChange,
  exchangeRate,
  onExchangeRateChange,
  bigPurchaseGoal,
  onOpenGoalModal,
  onRemoveGoal,
}: ProjectionControlsProps) {
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
              Patrimonio Actual {useRealAccounts && "(Calculado desde Firestore)"}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">Saldo ARS</span>
                <Input
                  type="number"
                  disabled={useRealAccounts}
                  value={initialARS || ""}
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
                  value={initialUSD || ""}
                  onChange={(e) => onInitialUSDChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Monthly Savings Inputs */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Ahorro Mensual Estimado
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">+ ARS / mes</span>
                <Input
                  type="number"
                  value={savingsARS || ""}
                  onChange={(e) => onSavingsARSChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">+ USD / mes</span>
                <Input
                  type="number"
                  value={savingsUSD || ""}
                  onChange={(e) => onSavingsUSDChange(Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-xs font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Initial Exchange Rate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="size-3 text-muted-foreground" /> Tipo de Cambio Inicial (USD/ARS)
              </Label>
            </div>
            <Input
              type="number"
              value={exchangeRate || ""}
              onChange={(e) => onExchangeRateChange(Number(e.target.value))}
              className="h-9 text-xs font-semibold tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Economic Indicators (Inflation, Devaluation, Return Sliders) */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Percent className="size-4 text-cyan-400" />
            Variables Económicas Locales & Rendimientos
          </CardTitle>
          <CardDescription className="text-[11px]">
            Ajusta los porcentajes anuales para el escenario Neutro. El motor calculará automáticamente los del escenario Pesimista y Optimista.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
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

          {/* Investment Return Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-emerald-400" /> Rendimiento de Inversiones Anual
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={annualReturn}
                  onChange={(e) => onAnnualReturnChange(Number(e.target.value))}
                  className="h-7 w-16 text-right text-xs font-bold tabular-nums px-2"
                />
                <span className="text-xs font-bold text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={annualReturn}
              onValueChange={onAnnualReturnChange}
              min={-20}
              max={100}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. Big Purchase Target Goal Card */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-purple-400" />
              Meta de Compra Grande
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenGoalModal}
              className="h-7 text-xs gap-1 border-primary/40 hover:bg-primary/10 cursor-pointer"
            >
              {bigPurchaseGoal ? (
                <>
                  <Pencil className="size-3" /> Editar Meta
                </>
              ) : (
                <>
                  <PlusCircle className="size-3" /> Añadir Meta
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {bigPurchaseGoal ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">
                  {bigPurchaseGoal.name}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                  Mes {bigPurchaseGoal.targetMonth}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Costo estimado:</span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatShort(bigPurchaseGoal.amount, bigPurchaseGoal.currency)}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onRemoveGoal}
                  className="text-[11px] font-medium text-destructive hover:underline cursor-pointer"
                >
                  Quitar meta
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
              <p className="text-xs text-muted-foreground mb-2">
                Simula el impacto de comprar un auto, un viaje o un inmueble en una fecha proyectada.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenGoalModal}
                className="h-8 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
              >
                + Configurar objetivo de compra
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
