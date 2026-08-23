"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { useFinance } from "./finance-provider"
import { DUE_CATEGORIES, type DueItem, type DueFrequency, type Currency } from "@/lib/finance-data"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

interface VencimientoSheetProps {
  open: boolean
  onClose: () => void
  item?: DueItem | null
}

const FREQUENCY_OPTIONS: { value: DueFrequency; label: string }[] = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "yearly", label: "Anual" },
  { value: "one_time", label: "Pago Único" },
]

const REMINDER_OPTIONS = [
  { value: 1, label: "1 día antes" },
  { value: 2, label: "2 días antes" },
  { value: 3, label: "3 días antes" },
  { value: 5, label: "5 días antes" },
  { value: 7, label: "7 días antes" },
  { value: 10, label: "10 días antes" },
]

export function VencimientoSheet({ open, onClose, item }: VencimientoSheetProps) {
  const { addDueItem, updateDueItem, deleteDueItem, accounts } = useFinance()

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Servicios")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [frequency, setFrequency] = useState<DueFrequency>("monthly")
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3)
  const [autoRenew, setAutoRenew] = useState(true)
  const [accountId, setAccountId] = useState<string>("none")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (item) {
        setTitle(item.title)
        setCategory(item.category)
        setAmount(String(item.amount))
        setCurrency(item.currency)
        try {
          setDueDate(parseISO(item.dueDate))
        } catch {
          setDueDate(new Date())
        }
        setFrequency(item.frequency)
        setReminderDaysBefore(item.reminderDaysBefore || 3)
        setAutoRenew(item.autoRenew ?? true)
        setAccountId(item.accountId || "none")
      } else {
        setTitle("")
        setCategory("Servicios")
        setAmount("")
        setCurrency("ARS")
        const target = new Date()
        target.setDate(target.getDate() + 7)
        setDueDate(target)
        setFrequency("monthly")
        setReminderDaysBefore(3)
        setAutoRenew(true)
        setAccountId(accounts.length > 0 ? accounts[0].id : "none")
      }
    }
  }, [open, item, accounts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Por favor ingresa un título para el servicio.")
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Ingresa un monto válido mayor a 0.")
      return
    }
    if (!dueDate) {
      toast.error("Selecciona la fecha de vencimiento.")
      return
    }

    setSubmitting(true)
    try {
      const selectedAccId = accountId !== "none" ? accountId : undefined
      const formattedDueDate = format(dueDate, "yyyy-MM-dd")

      if (item) {
        await updateDueItem(item.id, {
          title: title.trim(),
          category,
          amount: Math.round(parsedAmount * 100) / 100,
          currency,
          dueDate: formattedDueDate,
          frequency,
          reminderDaysBefore,
          autoRenew,
          accountId: selectedAccId,
        })
        toast.success(`Vencimiento "${title.trim()}" actualizado.`)
      } else {
        await addDueItem({
          title: title.trim(),
          category,
          amount: Math.round(parsedAmount * 100) / 100,
          currency,
          dueDate: formattedDueDate,
          frequency,
          reminderDaysBefore,
          status: "pending",
          autoRenew,
          accountId: selectedAccId,
        })
        toast.success(`Vencimiento "${title.trim()}" creado correctamente.`)
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar el vencimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    setSubmitting(true)
    try {
      await deleteDueItem(item.id)
      toast.success(`Vencimiento "${item.title}" eliminado.`)
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      toast.error("Error al eliminar vencimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <ResponsiveDialogContent className="w-full sm:max-w-xl max-w-[calc(100%-2rem)] h-auto rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh] transition-all duration-200">
        <ResponsiveDialogHeader className="text-left pb-2">
          <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            {item ? "Editar Vencimiento" : "Nuevo Vencimiento o Servicio"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs text-muted-foreground">
            Registra tus servicios periódicos (luz, agua, alquiler, etc.) para recibir alertas antes de que queden en mora.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="due-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Servicio / Título
            </Label>
            <Input
              id="due-title"
              placeholder="Ej: Luz (Edenor), Internet (Fibertel), Alquiler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-xl border-border bg-card/60"
            />
          </div>

          {/* Categoría & Moneda Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Categoría
              </Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>{category || "Seleccionar"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DUE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Moneda
              </Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>{currency === "ARS" ? "ARS ($)" : "USD (US$)"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS ($)</SelectItem>
                  <SelectItem value="USD">USD (US$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Monto & Fecha con Calendar de Shadcn UI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due-amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Monto Estimado
              </Label>
              <Input
                id="due-amount"
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="rounded-xl border-border bg-card/60 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Fecha Vencimiento
              </Label>
              <DatePicker
                value={dueDate}
                onChange={(d) => d && setDueDate(d)}
                placeholder="Seleccionar"
                displayFormat="dd/MM/yyyy"
              />
            </div>
          </div>

          {/* Frecuencia & Alerta Previa Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Frecuencia
              </Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as DueFrequency)}>
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>
                    {FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label || "Seleccionar"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Alerta Previa
              </Label>
              <Select
                value={String(reminderDaysBefore)}
                onValueChange={(v) => setReminderDaysBefore(Number(v))}
              >
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>
                    {REMINDER_OPTIONS.find((r) => r.value === reminderDaysBefore)?.label || `${reminderDaysBefore} días antes`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cuenta Preferida de Pago */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cuenta Sugerida para Débito
            </Label>
            <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
              <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                <SelectValue>
                  {accountId === "none" || !accountId
                    ? "Sin cuenta preferida"
                    : accounts.find((a) => a.id === accountId)
                      ? `${accounts.find((a) => a.id === accountId)?.name} (${accounts.find((a) => a.id === accountId)?.currency})`
                      : "Seleccionar cuenta"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuenta preferida</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto Renovación Switch */}
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3.5 mt-2">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Auto-Renovar Fecha al Pagar</p>
              <p className="text-[11px] text-muted-foreground">
                Al marcar como pagado, avanza la fecha automáticamente al siguiente periodo.
              </p>
            </div>
            <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-3">
            {item && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={submitting}
                className="size-11 rounded-xl shrink-0 cursor-pointer"
                title="Eliminar vencimiento"
                aria-label="Eliminar vencimiento"
              >
                <Trash2 className="size-4" />
              </Button>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-primary text-primary-foreground font-semibold py-5 shadow-lg shadow-primary/20 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando...
                </>
              ) : item ? (
                "Actualizar Vencimiento"
              ) : (
                "Guardar Vencimiento"
              )}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
