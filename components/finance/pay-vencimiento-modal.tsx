"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useFinance } from "./finance-provider"
import { formatCurrency, type DueItem } from "@/lib/finance-data"
import { toast } from "sonner"
import { CheckCircle2, Wallet, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PayVencimientoModalProps {
  open: boolean
  onClose: () => void
  item: DueItem | null
}

export function PayVencimientoModal({ open, onClose, item }: PayVencimientoModalProps) {
  const { markDueItemAsPaid, accounts } = useFinance()

  const [registerExpense, setRegisterExpense] = useState(true)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && item) {
      setRegisterExpense(true)
      setPayAmount(String(item.amount))
      setNote(`Pago de servicio: ${item.title}`)

      // Auto select preferred account or first account matching currency
      if (item.accountId && accounts.some((a) => a.id === item.accountId)) {
        setSelectedAccountId(item.accountId)
      } else {
        const matchingCurrency = accounts.find((a) => a.currency === item.currency)
        setSelectedAccountId(matchingCurrency ? matchingCurrency.id : accounts[0]?.id || "")
      }
    }
  }, [open, item, accounts])

  if (!item) return null

  async function handleConfirm() {
    if (!item) return
    setSubmitting(true)

    try {
      if (registerExpense) {
        if (!selectedAccountId) {
          toast.error("Seleccioná una cuenta para registrar el gasto.")
          setSubmitting(false)
          return
        }
        const parsedAmt = parseFloat(payAmount)
        if (isNaN(parsedAmt) || parsedAmt <= 0) {
          toast.error("Ingresá un monto válido.")
          setSubmitting(false)
          return
        }

        await markDueItemAsPaid(item.id, {
          accountId: selectedAccountId,
          amount: Math.round(parsedAmt * 100) / 100,
          category: item.category || "Servicios",
          note: note.trim() || `Pago: ${item.title}`,
        })
        toast.success(`Vencimiento "${item.title}" marcado como pagado y gasto registrado en tu cuenta.`)
      } else {
        await markDueItemAsPaid(item.id)
        toast.success(`Vencimiento "${item.title}" marcado como pagado.`)
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el pago.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <DialogContent className="max-w-lg w-full rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Marcar como Pagado
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Confirmar el pago de &ldquo;{item.title}&rdquo; ({formatCurrency(item.amount, item.currency)}).
          </DialogDescription>
        </DialogHeader>

        <div className={cn("flex flex-col gap-4 pt-1 transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          {/* Detail Box */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Factura / Servicio</p>
              <p className="text-base font-bold text-foreground mt-0.5">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vencimiento: {item.dueDate}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto</p>
              <p className="text-lg font-extrabold text-primary tabular-nums">
                {formatCurrency(item.amount, item.currency)}
              </p>
            </div>
          </div>

          {/* Register Expense Toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="size-4.5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">Registrar movimiento en PLATA</p>
                <p className="text-[11px] text-muted-foreground">
                  Descuenta automáticamente el saldo de tu cuenta.
                </p>
              </div>
            </div>
            <Switch checked={registerExpense} onCheckedChange={setRegisterExpense} />
          </div>

          {/* Account & Amount details if toggle active */}
          {registerExpense && (
            <FieldGroup className="gap-3.5 rounded-2xl border border-border/40 bg-card/40 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <Field>
                <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cuenta de Origen
                </FieldLabel>
                <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
                  <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                    <SelectValue>
                      {selectedAccount
                        ? `${selectedAccount.name} (${formatCurrency(selectedAccount.balance, selectedAccount.currency)})`
                        : "Seleccionar cuenta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Monto Real Pagado
                  </FieldLabel>
                  <Input
                    type="number"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="rounded-xl border-border bg-card/60 font-semibold"
                  />
                </Field>

                <Field>
                  <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nota / Detalle
                  </FieldLabel>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="rounded-xl border-border bg-card/60 text-xs"
                  />
                </Field>
              </div>
            </FieldGroup>
          )}

          {item.autoRenew && item.frequency !== "one_time" && (
            <p className="text-[11px] text-emerald-500/90 font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-center">
              💡 Al confirmar, este servicio auto-renovará su vencimiento para el próximo ciclo.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl flex-1 border-border cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/20 py-5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4.5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4.5 mr-2" />
                  Confirmar Pago
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
