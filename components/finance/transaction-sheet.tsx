"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Upload, Check, AlertCircle, Sparkles } from "lucide-react"
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
  type Account,
  formatCurrency,
} from "@/lib/finance-data"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { DatePicker } from "@/components/ui/date-picker"
import { useCategorySuggestion } from "./use-category-suggestion"

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
  // Una vez que el usuario elige categoría a mano, dejamos de sugerir: su
  // decisión no se pisa con la del modelo.
  const [categoryTouched, setCategoryTouched] = useState(false)

  const fromAccount = accounts.find((a) => a.id === accountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const crossCurrency =
    type === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  const categoriesList = useMemo(() => {
    return categories.filter((c) => c.type === (type === "income" ? "income" : "expense"))
  }, [categories, type])

  const categoryNames = useMemo(() => categoriesList.map((c) => c.name), [categoriesList])

  const { suggestion, loading: suggestionLoading } = useCategorySuggestion({
    note,
    type,
    categories: categoryNames,
    enabled: open && !categoryTouched,
  })

  // Se aplica sola para que el caso habitual sea cero taps; cualquier click en
  // un chip la desactiva para el resto de la carga.
  // Depende de `category` a propósito: el efecto que resetea el formulario
  // corre de nuevo cuando cambian las cuentas (realtime) y pisaría la
  // sugerencia. Mientras el usuario no elija a mano, la sugerencia se reimpone.
  useEffect(() => {
    if (!suggestion || categoryTouched) return
    if (category === suggestion.category) return
    setCategory(suggestion.category)
  }, [suggestion, categoryTouched, category])

  const isSuggested =
    !categoryTouched && suggestion !== null && category === suggestion.category

  const toAmountPreview = useMemo(() => {
    if (!crossCurrency) return null
    const amt = parseFloat(amount) || 0
    const r = parseFloat(rate) || 0
    if (!r) return null
    const calculated = fromAccount?.currency === "USD" ? amt * r : amt / r
    return Math.round(calculated * 100) / 100
  }, [crossCurrency, amount, rate, fromAccount])

  // Calculate available balance per account, restoring original transaction impact if editing
  const getAvailableBalance = useMemo(() => {
    return (acc: Account) => {
      let bal = Number(acc.balance) || 0
      if (transaction) {
        if (transaction.accountId === acc.id) {
          if (transaction.type === "expense" || transaction.type === "transfer") {
            bal += Number(transaction.amount) || 0
          } else if (transaction.type === "income") {
            bal -= Number(transaction.amount) || 0
          }
        }
        if (transaction.type === "transfer" && transaction.toAccountId === acc.id) {
          bal -= Number(transaction.toAmount ?? transaction.amount) || 0
        }
      }
      return Math.round(bal * 100) / 100
    }
  }, [transaction])

  const isDebit = type === "expense" || type === "transfer"
  const fromAvailable = fromAccount ? getAvailableBalance(fromAccount) : 0
  const parsedAmount = parseFloat(amount) || 0
  const isFromAccountEmpty = isDebit && Boolean(fromAccount && fromAvailable <= 0)
  const isAmountExceeding =
    isDebit && Boolean(fromAccount && parsedAmount > 0 && fromAvailable > 0 && parsedAmount > fromAvailable)

  useEffect(() => {
    if (open) {
      if (transaction) {
        // Editar: la categoría guardada ya es una decisión tomada.
        setCategoryTouched(true)
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
        setCategoryTouched(false)
        setAmount("")
        setNote("")
        setRate("")
        setReceipt(null)
        setType("expense")
        const defaultCat = categories.find((c) => c.type === "expense")?.name ?? ""
        setCategory(defaultCat)

        // Select first account with positive balance for expense default
        const validFrom = accounts.find((a) => getAvailableBalance(a) > 0)?.id ?? accounts[0]?.id ?? ""
        setAccountId(validFrom)

        const defaultTo = accounts.find((a) => a.id !== validFrom)?.id ?? ""
        setToAccountId(defaultTo)
        setDate(new Date())
      }
    }
  }, [open, transaction, categories, accounts, getAvailableBalance])

  function handleTab(val: TransactionType) {
    setType(val)
    // Las categorías de ingreso y de gasto son listas distintas: lo elegido
    // para una no dice nada sobre la otra.
    if (!transaction) setCategoryTouched(false)
    if (val === "income") {
      const first = categories.find((c) => c.type === "income")
      if (first) setCategory(first.name)
    } else if (val === "expense") {
      const first = categories.find((c) => c.type === "expense")
      if (first) setCategory(first.name)
      const current = accounts.find((a) => a.id === accountId)
      if (!current || getAvailableBalance(current) <= 0) {
        const valid = accounts.find((a) => getAvailableBalance(a) > 0)
        if (valid) setAccountId(valid.id)
      }
    } else if (val === "transfer") {
      const current = accounts.find((a) => a.id === accountId)
      if (!current || getAvailableBalance(current) <= 0) {
        const valid = accounts.find((a) => getAvailableBalance(a) > 0)
        if (valid) setAccountId(valid.id)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pAmt = parseFloat(amount)
    if (isNaN(pAmt) || pAmt <= 0) {
      toast.error("Ingresá un monto mayor a 0.")
      return
    }
    if (!accountId) {
      toast.error("Seleccioná una cuenta de origen.")
      return
    }

    if (isDebit && fromAccount) {
      const avail = getAvailableBalance(fromAccount)
      if (avail <= 0) {
        toast.error("La cuenta seleccionada no tiene saldo disponible.")
        return
      }
      if (pAmt > avail) {
        toast.error(`El monto ingresado supera el saldo disponible (${formatCurrency(avail, fromAccount.currency)}).`)
        return
      }
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
        amount: Math.round(pAmt * 100) / 100,
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

  // El monto es el elemento principal del formulario: se muestra grande, pero
  // baja de escalón tipográfico a medida que suma dígitos para no desbordar.
  const amountSize = useMemo(() => {
    const len = amount.length
    if (len > 12) return { value: "text-xl md:text-2xl", symbol: "text-lg" }
    if (len > 9) return { value: "text-2xl md:text-3xl", symbol: "text-xl" }
    if (len > 6) return { value: "text-3xl md:text-4xl", symbol: "text-2xl" }
    return { value: "text-4xl md:text-5xl", symbol: "text-3xl" }
  }, [amount])

  const isSubmitDisabled =
    submitting || (isDebit && Boolean(fromAccount && (fromAvailable <= 0 || isAmountExceeding)))

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
        <ResponsiveDialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <ResponsiveDialogHeader className="text-left pb-1">
            <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              {transaction ? "Editar movimiento" : "Nuevo movimiento"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-xs text-muted-foreground">
              {transaction ? "Modificá o eliminá este movimiento." : "Registrá un ingreso, gasto o transferencia."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

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
              <div className="flex w-full max-w-full items-center justify-center gap-1.5">
                <span className={cn("font-medium text-muted-foreground", amountSize.symbol)}>
                  $
                </span>
                <Input
                  autoFocus
                  inputMode="decimal"
                  disabled={submitting}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className={cn(
                    "h-16 w-auto min-w-[2ch] max-w-full border-none bg-transparent text-center font-bold tracking-tight tabular-nums field-sizing-content shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40",
                    amountSize.value
                  )}
                />
              </div>
              {isAmountExceeding && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in">
                  <AlertCircle className="size-3.5 shrink-0" />
                  El monto supera el saldo disponible ({formatCurrency(fromAvailable, fromAccount?.currency ?? "ARS")})
                </p>
              )}
            </div>

            {/* Account selectors */}
            <Field label={type === "transfer" ? "Desde" : type === "income" ? "Acreditar en" : "Pagar desde"}>
              <AccountSelect
                value={accountId}
                onChange={setAccountId}
                accounts={accounts}
                getAvailableBalance={getAvailableBalance}
                isDebit={isDebit}
                disabled={submitting}
              />
              {isFromAccountEmpty && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Esta cuenta no tiene saldo disponible.
                </p>
              )}
            </Field>

            {type === "transfer" && (
              <Field label="Hacia">
                <AccountSelect
                  value={toAccountId}
                  onChange={setToAccountId}
                  accounts={accounts.filter((a) => a.id !== accountId)}
                  getAvailableBalance={getAvailableBalance}
                  isDebit={false}
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
              <Field
                label={
                  <span className="flex items-center gap-2">
                    Categoría
                    {suggestionLoading && (
                      <span className="flex items-center gap-1 font-normal text-muted-foreground">
                        <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                        Analizando…
                      </span>
                    )}
                    {isSuggested && (
                      <span className="flex items-center gap-1 text-primary animate-in fade-in">
                        <Sparkles className="size-3 shrink-0" />
                        Sugerido
                      </span>
                    )}
                  </span>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {categoriesList.map((c) => (
                    <Badge
                      key={c.id}
                      variant={category === c.name ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-3 py-1 text-xs font-medium transition-all",
                        isSuggested && category === c.name && "ring-2 ring-primary/30"
                      )}
                      onClick={() => {
                        if (submitting) return
                        setCategoryTouched(true)
                        setCategory(c.name)
                      }}
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
              <DatePicker
                value={date}
                onChange={setDate}
                disabled={submitting}
                className="bg-transparent"
              />
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
                disabled={isSubmitDisabled}
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
      </ResponsiveDialogContent>
      </ResponsiveDialog>

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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
  getAvailableBalance,
  isDebit,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  accounts: Account[]
  getAvailableBalance?: (acc: Account) => number
  isDebit?: boolean
  disabled?: boolean
}) {
  const selectedAcc = accounts.find((a) => a.id === value)
  const selectedAvailBal = selectedAcc
    ? getAvailableBalance
      ? getAvailableBalance(selectedAcc)
      : selectedAcc.balance
    : 0

  return (
    <Select value={value} onValueChange={(val) => val && onChange(val)} disabled={disabled}>
      <SelectTrigger className="w-full h-10 rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <SelectValue>
          {selectedAcc ? (
            <span className="flex items-center justify-between w-full gap-2 pr-2">
              <span className="font-medium truncate">{selectedAcc.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums shrink-0">
                {formatCurrency(selectedAvailBal, selectedAcc.currency)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground/50">Seleccionar cuenta</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-y-auto">
        <SelectGroup>
          {accounts.map((a) => {
            const availBal = getAvailableBalance ? getAvailableBalance(a) : a.balance
            const isDisabled = Boolean(isDebit && availBal <= 0)
            return (
              <SelectItem
                key={a.id}
                value={a.id}
                disabled={isDisabled}
                className="flex items-center justify-between py-2 cursor-pointer"
              >
                <div className="flex items-center justify-between w-full gap-3 pr-2">
                  <span className={cn("font-medium truncate", isDisabled && "text-muted-foreground/60")}>
                    {a.name}
                  </span>
                  <span
                    className={cn(
                      "text-xs tabular-nums shrink-0 ml-auto",
                      isDisabled ? "text-destructive/80 font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {formatCurrency(availBal, a.currency)}
                    {isDisabled ? " (Sin saldo)" : ""}
                  </span>
                </div>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

