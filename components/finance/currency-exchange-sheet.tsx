"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Check, Calendar as CalendarIcon, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "./finance-provider"
import { BottomSheet } from "./bottom-sheet"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatShort } from "@/lib/finance-data"

interface CurrencyExchangeSheetProps {
  open: boolean
  onClose: () => void
}

export function CurrencyExchangeSheet({ open, onClose }: CurrencyExchangeSheetProps) {
  const { accounts, addTransaction } = useFinance()

  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [arsAmount, setArsAmount] = useState("")
  const [usdAmount, setUsdAmount] = useState("")
  const [rate, setRate] = useState("")
  const [lastEdited, setLastEdited] = useState<"ars" | "usd">("ars")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Filter accounts by currency
  const arsAccounts = useMemo(() => accounts.filter((a) => a.currency === "ARS"), [accounts])
  const usdAccounts = useMemo(() => accounts.filter((a) => a.currency === "USD"), [accounts])

  const selectedArsAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId),
    [accounts, fromAccountId]
  )
  const selectedUsdAccount = useMemo(
    () => accounts.find((a) => a.id === toAccountId),
    [accounts, toAccountId]
  )

  // Reset/Prefill form when opened
  useEffect(() => {
    if (open) {
      setArsAmount("")
      setUsdAmount("")
      setRate("")
      setLastEdited("ars")
      setNote("")
      setDate(new Date())

      if (arsAccounts.length > 0) {
        setFromAccountId(arsAccounts[0].id)
      } else {
        setFromAccountId("")
      }

      if (usdAccounts.length > 0) {
        setToAccountId(usdAccounts[0].id)
      } else {
        setToAccountId("")
      }
    }
  }, [open, arsAccounts, usdAccounts])

  // Bidirectional calculations
  const parsedRate = parseFloat(rate) || 0

  const handleArsChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, "")
    setArsAmount(cleanVal)
    setLastEdited("ars")

    const numArs = parseFloat(cleanVal) || 0
    if (parsedRate > 0 && numArs > 0) {
      const calculatedUsd = numArs / parsedRate
      setUsdAmount(String(Math.round(calculatedUsd * 100) / 100))
    } else {
      setUsdAmount("")
    }
  }

  const handleUsdChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, "")
    setUsdAmount(cleanVal)
    setLastEdited("usd")

    const numUsd = parseFloat(cleanVal) || 0
    if (parsedRate > 0 && numUsd > 0) {
      const calculatedArs = numUsd * parsedRate
      setArsAmount(String(Math.round(calculatedArs * 100) / 100))
    } else {
      setArsAmount("")
    }
  }

  const handleRateChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, "")
    setRate(cleanVal)

    const newRate = parseFloat(cleanVal) || 0
    if (newRate <= 0) {
      if (lastEdited === "ars") setUsdAmount("")
      else setArsAmount("")
      return
    }

    if (lastEdited === "ars") {
      const numArs = parseFloat(arsAmount) || 0
      if (numArs > 0) {
        const calculatedUsd = numArs / newRate
        setUsdAmount(String(Math.round(calculatedUsd * 100) / 100))
      }
    } else {
      const numUsd = parseFloat(usdAmount) || 0
      if (numUsd > 0) {
        const calculatedArs = numUsd * newRate
        setArsAmount(String(Math.round(calculatedArs * 100) / 100))
      }
    }
  }

  // Validations
  const numArs = parseFloat(arsAmount) || 0
  const numUsd = parseFloat(usdAmount) || 0
  const balance = selectedArsAccount ? Number(selectedArsAccount.balance) : 0
  const isBalanceInsufficient = numArs > balance

  const canSubmit =
    fromAccountId !== "" &&
    toAccountId !== "" &&
    numArs > 0 &&
    numUsd > 0 &&
    parsedRate > 0 &&
    !isBalanceInsufficient &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const isoDate = date ? date.toISOString() : new Date().toISOString()

      const payload = {
        type: "transfer" as const,
        amount: Math.round(numArs * 100) / 100,
        accountId: fromAccountId,
        toAccountId: toAccountId,
        toAmount: Math.round(numUsd * 100) / 100,
        exchangeRate: Math.round(parsedRate * 100) / 100,
        category: "Transferencia",
        note: note.trim() || "Cambio de moneda (ARS → USD)",
        date: isoDate,
      }

      await addTransaction(payload)
      toast.success("Operación de cambio registrada con éxito.")
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al registrar el cambio de moneda.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Cambio de Moneda"
      description="Registrá una compra de dólares (ARS → USD) indicando la cotización."
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {arsAccounts.length === 0 || usdAccounts.length === 0 ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cuentas incompletas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Necesitás tener al menos una cuenta en Pesos (ARS) y otra en Dólares (USD) para realizar un cambio de moneda.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Account selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Entregar desde (ARS)
                </label>
                <select
                  value={fromAccountId}
                  disabled={submitting}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="mt-1.5 w-full appearance-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
                >
                  {arsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: {formatShort(a.balance, "ARS")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Recibir en (USD)
                </label>
                <select
                  value={toAccountId}
                  disabled={submitting}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1.5 w-full appearance-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
                >
                  {usdAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: {formatShort(a.balance, "USD")})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Exchange Rate (Cotización) */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Cotización (1 USD = ARS)
              </label>
              <div className="relative mt-1.5 flex items-center">
                <span className="absolute left-3.5 text-sm text-muted-foreground font-medium">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={submitting}
                  value={rate}
                  onChange={(e) => handleRateChange(e.target.value)}
                  placeholder="Ej. 1350 o 1050"
                  className="w-full rounded-xl border border-border bg-background pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50 font-medium tabular-nums"
                  required
                />
              </div>
            </div>

            {/* ARS & USD Amounts with beautiful arrows */}
            <div className="relative flex flex-col gap-3 rounded-2xl bg-muted/30 p-4 border border-border/40">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Entregás (ARS)
                  </label>
                  <div className="relative mt-1 flex items-center">
                    <span className="absolute left-3 text-sm text-muted-foreground font-medium">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={submitting}
                      value={arsAmount}
                      onChange={(e) => handleArsChange(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-border bg-background pl-6 pr-3.5 py-2 text-sm outline-none focus:border-ring disabled:opacity-50 font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary self-end mb-1">
                  <ArrowLeftRight className="size-4" />
                </div>

                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Recibís (USD)
                  </label>
                  <div className="relative mt-1 flex items-center">
                    <span className="absolute left-3 text-sm text-muted-foreground font-medium">US$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={submitting}
                      value={usdAmount}
                      onChange={(e) => handleUsdChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-sm outline-none focus:border-ring disabled:opacity-50 font-semibold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Warnings and Calculations summary */}
              {numArs > 0 && parsedRate > 0 && (
                <div className="mt-2 border-t border-border/40 pt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>Detalle de la operación:</span>
                    <span className="font-semibold text-foreground">
                      {formatShort(numArs, "ARS")} → {formatShort(numUsd, "USD")}
                    </span>
                  </div>
                  {isBalanceInsufficient && (
                    <div className="flex items-center gap-1 text-destructive font-semibold mt-1">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>Saldo insuficiente en la cuenta ARS (Falta {formatShort(numArs - balance, "ARS")}).</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Nota (opcional)
              </label>
              <input
                type="text"
                disabled={submitting}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Compra de dólar MEP"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Fecha
              </label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      className="mt-1.5 w-full justify-start rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-normal text-left outline-none hover:bg-muted/10 focus:border-ring disabled:opacity-50 h-auto"
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
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2 font-semibold">
                  <RefreshCw className="size-4 animate-spin" />
                  Registrando cambio...
                </span>
              ) : (
                "Confirmar Cambio"
              )}
            </button>
          </>
        )}
      </form>
    </BottomSheet>
  )
}
