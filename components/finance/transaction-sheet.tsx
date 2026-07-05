"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Upload, Check, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { BottomSheet } from "./bottom-sheet"
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
        setToAccountId(accounts.find((a) => a.id !== defaultFrom)?.id ?? "")
        setDate(new Date())
      }
    }
  }, [transaction, open, accounts, categories])

  function handleTab(next: TransactionType) {
    setType(next)
    if (next === "income") {
      const defaultCat = categories.find((c) => c.type === "income")?.name ?? ""
      setCategory(defaultCat)
    } else if (next === "expense") {
      const defaultCat = categories.find((c) => c.type === "expense")?.name ?? ""
      setCategory(defaultCat)
    } else {
      setCategory("Transferencia")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (!amt || amt <= 0 || !accountId) return
    if (type === "transfer" && accountId === toAccountId) return

    setSubmitting(true)
    try {
      let isoDate = new Date().toISOString()
      if (date) {
        const d = transaction ? new Date(transaction.date) : new Date()
        d.setFullYear(date.getFullYear())
        d.setMonth(date.getMonth())
        d.setDate(date.getDate())
        isoDate = d.toISOString()
      }

      const payload = {
        type,
        amount: amt,
        accountId,
        category,
        note: note.trim() || undefined,
        receiptName: receipt ?? undefined,
        date: isoDate,
        ...(type === "transfer"
          ? {
              toAccountId,
              exchangeRate: crossCurrency ? Math.round((parseFloat(rate) || 0) * 100) / 100 || undefined : undefined,
              toAmount: crossCurrency ? toAmountPreview ?? undefined : amt,
            }
          : {}),
      }

      if (transaction) {
        await updateTransaction(transaction.id, payload)
        toast.success("Movimiento modificado con éxito.")
      } else {
        await addTransaction(payload)
        toast.success("Movimiento registrado con éxito.")
      }
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al registrar el movimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  async function executeDelete() {
    if (!transaction) return
    setSubmitting(true)
    try {
      await deleteTransaction(transaction.id)
      toast.success("Movimiento eliminado con éxito.")
      setDeleteConfirmOpen(false)
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar el movimiento.")
    } finally {
      setSubmitting(false)
    }
  }

  const accentBg =
    type === "income" ? "bg-primary" : type === "expense" ? "bg-destructive" : "bg-secondary"
  const accentText =
    type === "income"
      ? "text-primary-foreground"
      : type === "expense"
        ? "text-background"
        : "text-secondary-foreground"

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={transaction ? "Editar movimiento" : "Nuevo movimiento"}
        description={transaction ? "Modificá o eliminá este movimiento." : "Registrá un ingreso, gasto o transferencia."}
      >
        <div className="flex rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={submitting}
              onClick={() => handleTab(t.value)}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                type === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              } disabled:opacity-50`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {/* Amount */}
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Monto ({fromAccount?.currency ?? "ARS"})
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-medium text-muted-foreground">$</span>
              <input
                autoFocus
                inputMode="decimal"
                disabled={submitting}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-40 bg-transparent text-center text-4xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
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
              <input
                inputMode="decimal"
                disabled={submitting}
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="Ej. 1050"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
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
                  <button
                    key={c.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => setCategory(c.name)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      category === c.name
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    } disabled:opacity-50`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Note */}
          <Field label="Nota (opcional)">
            <input
              value={note}
              disabled={submitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Compra del super"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
            />
          </Field>

          {/* Date */}
          <Field label="Fecha">
            <Popover>
              <PopoverTrigger>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  className="w-full justify-start rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-normal text-left outline-none hover:bg-muted/10 focus:border-ring disabled:opacity-50 h-auto"
                >
                  <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
                  {date ? (
                    format(date, "PPP", { locale: es })
                  ) : (
                    <span className="text-muted-foreground/50">Seleccionar fecha</span>
                  )}
                </Button>
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
            <button
              type="button"
              disabled={submitting}
              onClick={() => fileRef.current?.click()}
              className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left text-sm transition-colors ${
                receipt
                  ? "border-primary/50 text-foreground"
                  : "border-border text-muted-foreground hover:border-ring"
              } disabled:opacity-50`}
            >
              {receipt ? <Check className="size-4 text-primary" /> : <Upload className="size-4" />}
              <span className="truncate">{receipt ?? "Subir foto o PDF del comprobante"}</span>
            </button>
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
              className={`h-12 w-full rounded-xl text-sm ${accentBg} ${accentText}`}
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : transaction ? (
                "Guardar cambios"
              ) : (
                "Guardar movimiento"
              )}
            </Button>

            {transaction && (
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={() => setDeleteConfirmOpen(true)}
                className="h-12 w-full rounded-xl text-sm cursor-pointer"
              >
                {submitting ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  "Eliminar movimiento"
                )}
              </Button>
            )}
          </div>
        </form>
      </BottomSheet>

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
              onClick={executeDelete}
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
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
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
      className="w-full appearance-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ))}
    </select>
  )
}
