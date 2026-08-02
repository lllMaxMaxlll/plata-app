"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Calendar as CalendarIcon, AlertCircle, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { formatShort } from "@/lib/finance-data"

type ExchangeDirection = "ARS_TO_USD" | "USD_TO_ARS"

interface CurrencyExchangeSheetProps {
  open: boolean
  onClose: () => void
}

export function CurrencyExchangeSheet({ open, onClose }: CurrencyExchangeSheetProps) {
  const { accounts, addTransaction } = useFinance()

  const [direction, setDirection] = useState<ExchangeDirection>("ARS_TO_USD")
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [arsAmount, setArsAmount] = useState("")
  const [usdAmount, setUsdAmount] = useState("")
  const [rate, setRate] = useState("")
  const [lastEdited, setLastEdited] = useState<"ars" | "usd">("ars")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Filter accounts by currency
  const arsAccounts = useMemo(() => accounts.filter((a) => a.currency === "ARS"), [accounts])
  const usdAccounts = useMemo(() => accounts.filter((a) => a.currency === "USD"), [accounts])

  const sourceAccounts = direction === "ARS_TO_USD" ? arsAccounts : usdAccounts
  const targetAccounts = direction === "ARS_TO_USD" ? usdAccounts : arsAccounts

  const selectedSourceAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId),
    [accounts, fromAccountId]
  )

  const selectedTargetAccount = useMemo(
    () => accounts.find((a) => a.id === toAccountId),
    [accounts, toAccountId]
  )

  useEffect(() => {
    if (open) {
      setDirection("ARS_TO_USD")
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

  const handleDirectionChange = (nextDir: ExchangeDirection) => {
    setDirection(nextDir)

    if (nextDir === "ARS_TO_USD") {
      setFromAccountId(arsAccounts[0]?.id ?? "")
      setToAccountId(usdAccounts[0]?.id ?? "")
    } else {
      setFromAccountId(usdAccounts[0]?.id ?? "")
      setToAccountId(arsAccounts[0]?.id ?? "")
    }
  }

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

  const numArs = parseFloat(arsAmount) || 0
  const numUsd = parseFloat(usdAmount) || 0
  const sourceBalance = selectedSourceAccount ? Number(selectedSourceAccount.balance) : 0
  const requiredSourceAmount = direction === "ARS_TO_USD" ? numArs : numUsd
  const isBalanceInsufficient = requiredSourceAmount > sourceBalance

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
      const isBuy = direction === "ARS_TO_USD"
      const defaultNote = isBuy ? "Compra de dólares (ARS → USD)" : "Venta de dólares (USD → ARS)"

      const payload = {
        type: "transfer" as const,
        amount: isBuy ? Math.round(numArs * 100) / 100 : Math.round(numUsd * 100) / 100,
        accountId: fromAccountId,
        toAccountId: toAccountId,
        toAmount: isBuy ? Math.round(numUsd * 100) / 100 : Math.round(numArs * 100) / 100,
        exchangeRate: Math.round(parsedRate * 100) / 100,
        category: "Transferencia",
        note: note.trim() || defaultNote,
        date: isoDate,
      }

      await addTransaction(payload)
      toast.success("Operación de cambio registrada con éxito.")
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al registrar el cambio de moneda.")
    } finally {
      setSubmitting(false)
    }
  }

  const isBuy = direction === "ARS_TO_USD"
  const sourceCurrency = isBuy ? "ARS" : "USD"
  const targetCurrency = isBuy ? "USD" : "ARS"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <DialogContent className="w-full sm:max-w-xl max-w-[calc(100vw-2rem)] h-auto max-h-[90vh] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-200">
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Cambio de Moneda
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isBuy
              ? "Registrá una compra de dólares (ARS → USD) indicando la cotización."
              : "Registrá una venta de dólares (USD → ARS) indicando la cotización."}
          </DialogDescription>
        </DialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <Tabs
            value={direction}
            onValueChange={(val) => handleDirectionChange(val as ExchangeDirection)}
            className="w-full min-w-0 mt-2"
          >
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40 border border-border/50">
            <TabsTrigger
              value="ARS_TO_USD"
              disabled={submitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Comprar USD (ARS → USD)
            </TabsTrigger>
            <TabsTrigger
              value="USD_TO_ARS"
              disabled={submitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Vender USD (USD → ARS)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="mt-2 flex min-w-0 flex-col gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                {/* Entregar desde */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Entregar desde ({sourceCurrency})
                  </Label>
                  <Select value={fromAccountId} onValueChange={(val) => val && setFromAccountId(val)} disabled={submitting}>
                    <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                      <SelectValue>
                        {selectedSourceAccount
                          ? `${selectedSourceAccount.name} (${formatShort(selectedSourceAccount.balance, sourceCurrency)})`
                          : "Seleccionar cuenta"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {sourceAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} (Saldo: {formatShort(a.balance, sourceCurrency)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recibir en */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recibir en ({targetCurrency})
                  </Label>
                  <Select value={toAccountId} onValueChange={(val) => val && setToAccountId(val)} disabled={submitting}>
                    <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                      <SelectValue>
                        {selectedTargetAccount
                          ? `${selectedTargetAccount.name} (${formatShort(selectedTargetAccount.balance, targetCurrency)})`
                          : "Seleccionar cuenta"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {targetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} (Saldo: {formatShort(a.balance, targetCurrency)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cotización */}
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cotización (1 USD = ARS)
                </Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm text-muted-foreground font-medium">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    disabled={submitting}
                    value={rate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    placeholder="Ej. 1350 o 1050"
                    className="h-10 pl-7 text-sm font-semibold tabular-nums rounded-xl border-border bg-card/60"
                    required
                  />
                </div>
              </div>

              {/* Preview de conversión */}
              <div className="relative flex min-w-0 flex-col gap-3 rounded-2xl bg-muted/40 p-4 border border-border/50">
                <div className="flex items-center justify-between gap-3 min-w-0">
                  {isBuy ? (
                    <>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Entregás (ARS)
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm text-muted-foreground font-medium">$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            disabled={submitting}
                            value={arsAmount}
                            onChange={(e) => handleArsChange(e.target.value)}
                            placeholder="0"
                            className="h-10 pl-6 text-sm font-semibold tabular-nums rounded-xl border-border bg-card/60"
                          />
                        </div>
                      </div>

                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary self-end mb-1">
                        <ArrowLeftRight className="size-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Recibís (USD)
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm text-muted-foreground font-medium">US$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            disabled={submitting}
                            value={usdAmount}
                            onChange={(e) => handleUsdChange(e.target.value)}
                            placeholder="0.00"
                            className="h-10 pl-9 text-sm font-semibold tabular-nums rounded-xl border-border bg-card/60"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Entregás (USD)
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm text-muted-foreground font-medium">US$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            disabled={submitting}
                            value={usdAmount}
                            onChange={(e) => handleUsdChange(e.target.value)}
                            placeholder="0.00"
                            className="h-10 pl-9 text-sm font-semibold tabular-nums rounded-xl border-border bg-card/60"
                          />
                        </div>
                      </div>

                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary self-end mb-1">
                        <ArrowLeftRight className="size-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Recibís (ARS)
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm text-muted-foreground font-medium">$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            disabled={submitting}
                            value={arsAmount}
                            onChange={(e) => handleArsChange(e.target.value)}
                            placeholder="0"
                            className="h-10 pl-6 text-sm font-semibold tabular-nums rounded-xl border-border bg-card/60"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {numArs > 0 && numUsd > 0 && parsedRate > 0 && (
                  <div className="mt-1 border-t border-border/40 pt-2 flex flex-col gap-1 text-xs text-muted-foreground min-w-0">
                    <div className="flex justify-between items-center">
                      <span>Detalle de la operación:</span>
                      <span className="font-semibold text-foreground">
                        {isBuy
                          ? `${formatShort(numArs, "ARS")} → ${formatShort(numUsd, "USD")}`
                          : `${formatShort(numUsd, "USD")} → ${formatShort(numArs, "ARS")}`}
                      </span>
                    </div>
                    {isBalanceInsufficient && (
                      <div className="flex items-center gap-1 text-destructive font-semibold mt-1">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span>
                          Saldo insuficiente en la cuenta {sourceCurrency} (Falta{" "}
                          {formatShort(requiredSourceAmount - sourceBalance, sourceCurrency)}).
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nota */}
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Nota (opcional)
                </Label>
                <Input
                  type="text"
                  disabled={submitting}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={isBuy ? "Ej. Compra de dólar MEP" : "Ej. Venta de dólares por gastos"}
                  className="h-10 text-sm rounded-xl border-border bg-card/60"
                />
              </div>

              {/* Fecha */}
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Fecha
                </Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        className="w-full justify-start rounded-xl border-border bg-card/60 px-3.5 py-2 text-xs font-normal text-left h-10 cursor-pointer"
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
                    {date ? (
                      format(date, "PPP", { locale: es })
                    ) : (
                      <span className="text-muted-foreground/50">Seleccionar fecha</span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border border-border bg-popover rounded-2xl shadow-xl z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d)
                          setCalendarOpen(false)
                        }
                      }}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                size="lg"
                className="mt-2 w-full font-semibold h-11 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2 font-semibold">
                    <RefreshCw className="size-4 animate-spin" />
                    Registrando cambio...
                  </span>
                ) : isBuy ? (
                  "Confirmar Compra (ARS → USD)"
                ) : (
                  "Confirmar Venta (USD → ARS)"
                )}
              </Button>
            </>
          )}
        </form>
      </div>
    </DialogContent>
    </Dialog>
  )
}
