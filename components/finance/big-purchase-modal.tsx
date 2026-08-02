"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, Sparkles, Trash2, Check, Loader2 } from "lucide-react"
import { type BigPurchaseGoal, type Currency } from "@/lib/simulation-engine"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface BigPurchaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentGoal?: BigPurchaseGoal | null
  onSaveGoal: (goal: BigPurchaseGoal) => void
  onRemoveGoal: () => void
  horizonMonths: number
}

export function BigPurchaseModal({
  open,
  onOpenChange,
  currentGoal,
  onSaveGoal,
  onRemoveGoal,
  horizonMonths,
}: BigPurchaseModalProps) {
  const [name, setName] = useState("Compra de Auto")
  const [amount, setAmount] = useState<number>(15000)
  const [currency, setCurrency] = useState<Currency>("USD")
  const [targetMonth, setTargetMonth] = useState<number>(24)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentGoal) {
      setName(currentGoal.name)
      setAmount(currentGoal.amount)
      setCurrency(currentGoal.currency)
      setTargetMonth(Math.min(currentGoal.targetMonth, horizonMonths))
    } else {
      setName("Compra de Auto")
      setAmount(currency === "USD" ? 15000 : 15000000)
      setTargetMonth(Math.min(24, horizonMonths))
    }
  }, [currentGoal, open, horizonMonths])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || amount <= 0) return

    setSubmitting(true)
    try {
      onSaveGoal({
        id: currentGoal?.id || String(Date.now()),
        name: name.trim(),
        amount,
        currency,
        targetMonth,
      })
      toast.success(currentGoal ? "Meta de compra actualizada." : "Nueva meta de compra agregada.")
      await new Promise((resolve) => setTimeout(resolve, 350))
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error al guardar la meta.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setSubmitting(true)
    try {
      onRemoveGoal()
      toast.success("Meta de compra eliminada.")
      await new Promise((resolve) => setTimeout(resolve, 350))
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error al eliminar la meta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onOpenChange(false)}>
      <DialogContent className="sm:max-w-[440px] border-border/50 bg-card/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4.5 text-purple-400" />
            {currentGoal ? "Editar Meta de Compra" : "Nueva Meta de Compra Grande"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define una compra importante (auto, viaje, inmueble) para visualizar si tu patrimonio proyectado podrá cubrirla.
          </DialogDescription>
        </DialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Goal Name */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-name" className="text-xs font-medium">
              Nombre de la Meta / Compra
            </Label>
            <Input
              id="goal-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Compra de Auto, Viaje a Europa..."
              className="h-9 text-xs"
            />
          </div>

          {/* Amount and Currency */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-amount" className="text-xs font-medium">
                Monto Estimado
              </Label>
              <Tabs
                value={currency}
                onValueChange={(val) => setCurrency(val as Currency)}
                className="h-7"
              >
                <TabsList className="h-7 bg-muted/60 p-0.5">
                  <TabsTrigger value="USD" className="h-6 px-2.5 text-[11px] font-semibold">
                    USD
                  </TabsTrigger>
                  <TabsTrigger value="ARS" className="h-6 px-2.5 text-[11px] font-semibold">
                    ARS
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Input
              id="goal-amount"
              type="number"
              required
              min={1}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0"
              className="h-9 text-xs font-semibold tabular-nums"
            />
          </div>

          {/* Target Month Slider */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                Horizonte Deseado (Mes proyectado)
              </Label>
              <span className="text-xs font-bold text-primary tabular-nums">
                Mes {targetMonth} ({Math.round(targetMonth / 12 * 10) / 10} años)
              </span>
            </div>
            <Slider
              value={targetMonth}
              onValueChange={setTargetMonth}
              min={1}
              max={horizonMonths}
              step={1}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              Máximo para este horizonte: Mes {horizonMonths}
            </p>
          </div>

          <DialogFooter className="pt-4 flex items-center justify-between gap-2">
            {currentGoal ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={submitting}
                onClick={handleRemove}
                className="h-9 text-xs gap-1.5 cursor-pointer"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Quitar Meta
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-9 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Guardar Meta
              </Button>
            </div>
          </DialogFooter>
        </form>
      </div>
    </DialogContent>
    </Dialog>
  )
}
