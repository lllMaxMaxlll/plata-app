"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Upload, Check, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  type TransactionType,
  type Transaction,
} from "@/lib/finance-data"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const TABS: { value: TransactionType; label: string }[] = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
  { value: "transfer", label: "Transfer." },
]

export function TransactionSheet({
  open,
  onClose,
  transaction,
}: {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}) {
  const { accounts, addTransaction, updateTransaction, deleteTransaction, categories } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<TransactionType>("expense")
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [category, setCategory] = useState("")
  const [note, setNote] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [rate, setRate] = useState("")
  const [receipt, setReceipt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const fromAccount = accounts.find((a) => a.id === accountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const crossCurrency =
    type === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  const categoriesList = useMemo(() => {
    return categories.filter((c) => c.type === (type === "income" ? "income" : "expense"))
  }, [categories, type])

  const toAmountPreview = useMemo(() => {
    if (!crossCurrency) return null
    const amt = parseFloat(amount) || 0
    const r = parseFloat(rate) || 0
    if (!r) return null
    const calculated = fromAccount?.currency === "USD" ? amt * r : amt / r
    return Math.round(calculated * 100) / 100
  }, [crossCurrency, amount, rate, fromAccount])

  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type)
        setAmount(String(transaction.amount))
        setAccountId(transaction.accountId)
        setToAccountId(transaction.toAccountId ?? "")
        setCategory(transaction.category)
        setNote(transaction.note ?? "")
        setRate(transaction.exchangeRate ? String(transaction.exchangeRate) : "")
        setReceipt(transaction.receiptName ?? null)
        setDate(new Date(transaction.date))
      } else {
        setAmount("")
        setNote("")
        setRate("")
        setReceipt(null)
        setType("expense")
        const defaultCat = categories.find((c) => c.type === "expense")?.name ?? ""
        setCategory(defaultCat)
        const defaultFrom = accounts[0]?.id ?? ""
        setAccountId(defaultFrom)
        const defaultTo = accounts.find((a) => a.id !== defaultFrom)?.id ?? ""
        setToAccountId(defaultTo)
        setDate(new Date())
      }
    }
  }, [open, transaction, categories, accounts])

  function handleTab(val: TransactionType) {
    setType(val)
    if (val === "income") {
      const first = categories.find((c) => c.type === "income")
      if (first) setCategory(first.name)
    } else if (val === "expense") {
      const first = categories.find((c) => c.type === "expense")
      if (first) setCategory(first.name)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Ingresá un monto mayor a 0.")
      return
    }
    if (!accountId) {
      toast.error("Seleccioná una cuenta de origen.")
      return
    }
    if (type === "transfer") {
      if (!toAccountId) {
        toast.error("Seleccioná una cuenta de destino.")
        return
      }
      if (accountId === toAccountId) {
        toast.error("La cuenta de origen y destino deben ser distintas.")
        return
      }
      if (crossCurrency) {
        const parsedRate = parseFloat(rate)
        if (isNaN(parsedRate) || parsedRate <= 0) {
          toast.error("Ingresá un tipo de cambio válido mayor a 0.")
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const input = {
        type,
        amount: Math.round(parsedAmount * 100) / 100,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : undefined,
        toAmount: crossCurrency && toAmountPreview ? toAmountPreview : undefined,
        exchangeRate: crossCurrency ? parseFloat(rate) : undefined,
        category: type === "transfer" ? "Transferencia" : category,
        note: note.trim() || undefined,
        receiptName: receipt || undefined,
        date: date ? date.toISOString() : new Date().toISOString(),
      }

      if (transaction) {
        await updateTransaction(transaction.id, input)
        toast.success("Movimiento modificado con éxito.")
      } else {
        await addTransaction(input)
        toast.success("Movimiento registrado con éxito.")
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar el movimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!transaction) return
    setSubmitting(true)
    try {
      await deleteTransaction(transaction.id)
      toast.success("Movimiento eliminado correctamente.")
      await new Promise((resolve) => setTimeout(resolve, 350))
      setDeleteConfirmOpen(false)
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar el movimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
        <DialogContent className="max-w-lg w-full rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader className="text-left pb-1">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              {transaction ? "Editar movimiento" : "Nuevo movimiento"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {transaction ? "Modificá o eliminá este movimiento." : "Registrá un ingreso, gasto o transferencia."}
            </DialogDescription>
          </DialogHeader>

          <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
            <Tabs value={type} onValueChange={(val) => handleTab(val as TransactionType)} className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} disabled={submitting} className="rounded-lg text-xs font-semibold">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            {/* Amount */}
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                Monto ({fromAccount?.currency ?? "ARS"})
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-medium text-muted-foreground">$</span>
                <Input
                  autoFocus
                  inputMode="decimal"
                  disabled={submitting}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="h-16 w-56 bg-transparent text-center text-xl md:text-5xl font-bold tracking-tight tabular-nums border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Account selectors */}
            <Field label={type === "transfer" ? "Desde" : type === "income" ? "Acreditar en" : "Pagar desde"}>
              <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} disabled={submitting} />
            </Field>

            {type === "transfer" && (
              <Field label="Hacia">
                <AccountSelect
                  value={toAccountId}
                  onChange={setToAccountId}
                  accounts={accounts.filter((a) => a.id !== accountId)}
                  disabled={submitting}
                />
              </Field>
            )}

            {/* Exchange rate for cross-currency transfers */}
            {crossCurrency && (
              <Field label={`Cotización (1 ${fromAccount?.currency === "USD" ? "USD → ARS" : "USD = ARS"})`}>
                <Input
                  inputMode="decimal"
                  disabled={submitting}
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Ej. 1050"
                  className="h-10 text-sm"
                />
                {toAmountPreview != null && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Recibís ≈{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {toAccount?.currency} ${toAmountPreview.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </Field>
            )}

            {/* Categories (not for transfer) */}
            {type !== "transfer" && (
              <Field label="Categoría">
                <div className="flex flex-wrap gap-2">
                  {categoriesList.map((c) => (
                    <Badge
                      key={c.id}
                      variant={category === c.name ? "default" : "outline"}
                      className="cursor-pointer px-3 py-1 text-xs font-medium"
                      onClick={() => !submitting && setCategory(c.name)}
                    >
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </Field>
            )}

            {/* Note */}
            <Field label="Nota (opcional)">
              <Input
                value={note}
                disabled={submitting}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Compra del super"
                className="h-10 text-sm"
              />
            </Field>

            {/* Date */}
            <Field label="Fecha">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      className="w-full justify-start rounded-xl border border-input bg-transparent px-3.5 py-2 text-sm font-normal text-left outline-none hover:bg-muted/10 h-10"
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
                  {date ? (
                    format(date, "PPP", { locale: es })
                  ) : (
                    <span className="text-muted-foreground/50">Seleccionar fecha</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border border-border bg-popover rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            {/* Receipt upload */}
            <Field label="Comprobante (opcional)">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => fileRef.current?.click()}
                className="flex h-11 w-full items-center justify-start gap-3 rounded-xl border-dashed px-3.5 text-left text-sm font-normal"
              >
                {receipt ? <Check className="size-4 text-primary" /> : <Upload className="size-4" />}
                <span className="truncate">{receipt ?? "Subir foto o PDF del comprobante"}</span>
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setReceipt(e.target.files?.[0]?.name ?? null)}
              />
            </Field>

            <div className="mt-2 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                variant={type === "expense" ? "destructive" : "default"}
                className="h-11 w-full rounded-xl text-sm font-semibold"
              >
                {submitting ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : transaction ? (
                  "Guardar cambios"
                ) : (
                  "Guardar movimiento"
                )}
              </Button>

              {transaction && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="h-11 w-full rounded-xl text-sm text-destructive hover:bg-destructive/10"
                >
                  {submitting ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                  ) : (
                    "Eliminar movimiento"
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar este movimiento? Se reajustará el saldo de las cuentas afectadas de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function AccountSelect({
  value,
  onChange,
  accounts,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  accounts: { id: string; name: string; currency: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ))}
    </select>
  )
}
