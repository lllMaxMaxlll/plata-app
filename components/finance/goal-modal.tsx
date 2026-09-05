"use client"

import React, { useState, useEffect } from "react"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import {
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Trash2, Check, Loader2, ShieldCheck, ShoppingBag } from "lucide-react"
import { type Currency, type Goal, type GoalKind } from "@/lib/finance-data"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface GoalDraft {
  name: string
  amount: number
  currency: Currency
  kind: GoalKind
}

export interface GoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentGoal?: Goal | null
  onSaveGoal: (goal: GoalDraft) => Promise<void>
  onRemoveGoal: () => Promise<void>
}

export function GoalModal({
  open,
  onOpenChange,
  currentGoal,
  onSaveGoal,
  onRemoveGoal,
}: GoalModalProps) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [currency, setCurrency] = useState<Currency>("USD")
  const [kind, setKind] = useState<GoalKind>("reserve")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (currentGoal) {
      setName(currentGoal.name)
      setAmount(currentGoal.amount)
      setCurrency(currentGoal.currency)
      setKind(currentGoal.kind)
    } else {
      setName("")
      setAmount(0)
      setCurrency("USD")
      setKind("reserve")
    }
  }, [currentGoal, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || amount <= 0) return

    setSubmitting(true)
    try {
      // Esperamos de verdad a que la meta se guarde. Antes el modal mostraba
      // "meta agregada" tras un setTimeout de 300 ms y nada llegaba a la base.
      await onSaveGoal({ name: name.trim(), amount, currency, kind })
      toast.success(currentGoal ? "Meta actualizada." : "Nueva meta agregada a la secuencia.")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la meta.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setSubmitting(true)
    try {
      await onRemoveGoal()
      toast.success("Meta eliminada.")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la meta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onOpenChange(false)}>
      <ResponsiveDialogContent className="sm:max-w-[440px] border-border/50 bg-card/95 backdrop-blur-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4.5 text-purple-400" />
            {currentGoal ? "Editar Meta Secuencial" : "Nueva Meta en la Secuencia"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs">
            Define tu objetivo. La aplicación calculará en qué fecha proyectada llegarás en base a tu capacidad de ahorro libre.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            {/* Goal Name */}
            <div className="space-y-1.5">
              <Label htmlFor="goal-name" className="text-xs font-medium">
                Nombre del Objetivo
              </Label>
              <Input
                id="goal-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Fondo de Reserva, Compra Moto, Vacaciones..."
                className="h-9 text-xs"
              />
            </div>

            {/* Amount and Currency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="goal-amount" className="text-xs font-medium">
                  Monto Objetivo
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

            {/* Goal Type (Reserve vs Purchase) */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-medium">Propósito de la Meta</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("reserve")}
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    kind === "reserve"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    Reserva de Capital
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Fondo de ahorro o colchón. Permanece en tu patrimonio.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setKind("purchase")}
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    kind === "purchase"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShoppingBag className="size-3.5 text-purple-400" />
                    Compra / Gasto
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Compra importante. Se descuenta del capital acumulado.
                  </p>
                </button>
              </div>
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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

