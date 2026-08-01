"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Calendar as CalendarIcon, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFinance } from "./finance-provider"
import { BottomSheet } from "./bottom-sheet"
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

  // Filter accounts by currency
  const arsAccounts = useMemo(() => accounts.filter((a) => a.currency === "ARS"), [accounts])
  const usdAccounts = useMemo(() => accounts.filter((a) => a.currency === "USD"), [accounts])

  const sourceAccounts = direction === "ARS_TO_USD" ? arsAccounts : usdAccounts
  const targetAccounts = direction === "ARS_TO_USD" ? usdAccounts : arsAccounts

  const selectedSourceAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId),
    [accounts, fromAccountId]
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
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Cambio de Moneda"
      description={
        isBuy
          ? "Registrá una compra de dólares (ARS → USD) indicando la cotización."
          : "Registrá una venta de dólares (USD → ARS) indicando la cotización."
      }
    >
      <Tabs value={direction} onValueChange={(val) => handleDirectionChange(val as ExchangeDirection)} className="w-full mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ARS_TO_USD" disabled={submitting}>Comprar USD (ARS → USD)</TabsTrigger>
          <TabsTrigger value="USD_TO_ARS" disabled={submitting}>Vender USD (USD → ARS)</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Entregar desde ({sourceCurrency})
                </Label>
                <select
                  value={fromAccountId}
                  disabled={submitting}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {sourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: {formatShort(a.balance, sourceCurrency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Recibir en ({targetCurrency})
                </Label>
                <select
                  value={toAccountId}
                  disabled={submitting}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {targetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Saldo: {formatShort(a.balance, targetCurrency)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
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
                  className="h-10 pl-7 text-sm font-medium tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="relative flex flex-col gap-3 rounded-xl bg-muted/40 p-4 border border-border">
              <div className="flex items-center justify-between gap-4">
                {isBuy ? (
                  <>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">
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
                          className="h-10 pl-6 text-sm font-semibold tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary self-end mb-1">
                      <ArrowLeftRight className="size-4" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">
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
                          className="h-10 pl-9 text-sm font-semibold tabular-nums"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">
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
                          className="h-10 pl-9 text-sm font-semibold tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary self-end mb-1">
                      <ArrowLeftRight className="size-4" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">
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
                          className="h-10 pl-6 text-sm font-semibold tabular-nums"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {numArs > 0 && numUsd > 0 && parsedRate > 0 && (
                <div className="mt-2 border-t border-border pt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Nota (opcional)
              </Label>
              <Input
                type="text"
                disabled={submitting}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isBuy ? "Ej. Compra de dólar MEP" : "Ej. Venta de dólares por gastos"}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Fecha
              </Label>
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
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              size="lg"
              className="mt-2 w-full font-semibold h-11"
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
    </BottomSheet>
  )
}
