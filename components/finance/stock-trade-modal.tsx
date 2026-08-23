"use client"

import { useState, useEffect } from "react"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { DateStringPicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StockTradeModalProps {
  open: boolean
  onClose: () => void
  prefilledSymbol?: string
  prefilledType?: "buy" | "sell"
}

export function StockTradeModal({
  open,
  onClose,
  prefilledSymbol = "",
  prefilledType = "buy",
}: StockTradeModalProps) {
  const {
    accounts,
    stockPrices,
    holdings,
    executeStockTransaction,
    addWatchlistStock,
    watchlist,
  } = useFinance()

  const [symbol, setSymbol] = useState(prefilledSymbol)
  const [type, setType] = useState<"buy" | "sell">(prefilledType)
  const [shares, setShares] = useState<number>(0)
  const [price, setPrice] = useState<number>(0)
  const [date, setDate] = useState("")
  const [accountId, setAccountId] = useState("")
  const [loading, setLoading] = useState(false)

  // Filter accounts to only USD
  const usdAccounts = accounts.filter((a) => a.currency === "USD")

  // Reset inputs when opened
  useEffect(() => {
    if (open) {
      setSymbol(prefilledSymbol)
      setType(prefilledType)
      setShares(0)
      setDate(new Date().toISOString().split("T")[0])

      // Prefill price if symbol is known
      const cleanSym = prefilledSymbol.trim().toUpperCase()
      if (cleanSym && stockPrices[cleanSym]) {
        setPrice(stockPrices[cleanSym].price)
      } else {
        setPrice(0)
      }

      // Prefill USD account if available
      if (usdAccounts.length > 0) {
        setAccountId(usdAccounts[0].id)
      } else {
        setAccountId("")
      }
    }
  }, [open, prefilledSymbol, prefilledType])

  const currentHolding = holdings.find((h) => h.symbol === symbol.toUpperCase().trim())
  const sharesOwned = currentHolding ? currentHolding.shares : 0

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const accountBalance = selectedAccount ? Number(selectedAccount.balance) : 0

  const totalCost = shares * price

  // Validations
  const isSellInvalid = type === "sell" && shares > sharesOwned
  const isBuyInvalid = type === "buy" && totalCost > accountBalance

  const canSubmit =
    symbol.trim().length > 0 &&
    shares > 0 &&
    price > 0 &&
    accountId &&
    !isSellInvalid &&
    !isBuyInvalid &&
    !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    try {
      const targetSymbol = symbol.trim().toUpperCase()

      // Execute the buy/sell
      await executeStockTransaction({
        symbol: targetSymbol,
        type,
        shares,
        price: Math.round(price * 100) / 100,
        date: new Date(date + "T12:00:00Z").toISOString(),
        accountId,
      })

      if (type === "buy") {
        await addWatchlistStock(targetSymbol)
      }

      toast.success(
        `${type === "buy" ? "Compra" : "Venta"} de ${shares} acciones de ${targetSymbol} registrada exitosamente.`
      )
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al registrar la transacción.")
    } finally {
      setLoading(false)
    }
  }

  const selectedStockWatchItem = watchlist.find((w) => w.symbol === symbol)
  const selectedHoldingItem = holdings.find((h) => h.symbol === symbol)

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onClose()}>
      <ResponsiveDialogContent className="w-full sm:max-w-xl max-w-[calc(100vw-2rem)] h-auto max-h-[90vh] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-200">
        <ResponsiveDialogHeader className="text-left pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                {type === "buy" ? "Comprar Acción" : "Vender Acción"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-xs text-muted-foreground">
                Registrá una operación y actualizá tu portafolio de inversión.
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>

        <div className={cn("transition-all duration-200", loading && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <form onSubmit={handleSubmit} className="mt-2 flex min-w-0 flex-col gap-4">
          {/* Toggle Buy / Sell */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1 border border-border/50">
            <Button
              type="button"
              variant={type === "buy" ? "default" : "ghost"}
              size="sm"
              onClick={() => setType("buy")}
              className="w-full text-xs font-semibold rounded-lg cursor-pointer"
            >
              Compra
            </Button>
            <Button
              type="button"
              variant={type === "sell" ? "default" : "ghost"}
              size="sm"
              disabled={sharesOwned <= 0}
              onClick={() => setType("sell")}
              className="w-full text-xs font-semibold rounded-lg cursor-pointer"
            >
              Venta {sharesOwned > 0 && `(${sharesOwned} disp.)`}
            </Button>
          </div>

          {/* Ticker Input / Select */}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="symbol" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Símbolo / Ticker
            </Label>
            {prefilledSymbol !== "" ? (
              <Input
                id="symbol"
                type="text"
                value={symbol}
                disabled
                required
                className="h-10 text-sm uppercase font-semibold rounded-xl border-border bg-card/60"
              />
            ) : type === "buy" ? (
              watchlist.length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Tu lista de seguimiento está vacía. Agregá acciones a tu seguimiento primero.</span>
                </div>
              ) : (
                <Select
                  value={symbol}
                  onValueChange={(val) => {
                    if (val) {
                      setSymbol(val)
                      const clean = val.trim().toUpperCase()
                      if (clean && stockPrices[clean]) {
                        setPrice(stockPrices[clean].price)
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                    <SelectValue>
                      {selectedStockWatchItem
                        ? `${selectedStockWatchItem.symbol} - ${selectedStockWatchItem.name}`
                        : "Seleccionar del seguimiento..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {watchlist.map((w) => (
                      <SelectItem key={w.symbol} value={w.symbol}>
                        {w.symbol} - {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : holdings.length === 0 ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>No tenés acciones en tu cartera para vender.</span>
              </div>
            ) : (
              <Select
                value={symbol}
                onValueChange={(val) => {
                  if (val) {
                    setSymbol(val)
                    const clean = val.trim().toUpperCase()
                    if (clean && stockPrices[clean]) {
                      setPrice(stockPrices[clean].price)
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>
                    {selectedHoldingItem
                      ? `${selectedHoldingItem.symbol} - ${selectedHoldingItem.name} (${selectedHoldingItem.shares} disp.)`
                      : "Seleccionar de tus tenencias..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {holdings.map((h) => (
                    <SelectItem key={h.symbol} value={h.symbol}>
                      {h.symbol} - {h.name} ({h.shares} disponibles)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-0">
            {/* Shares Input */}
            <div className="min-w-0 space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="shares" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cantidad
                </Label>
                {type === "sell" && sharesOwned > 0 && (
                  <button
                    type="button"
                    onClick={() => setShares(sharesOwned)}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Usar máx ({sharesOwned})
                  </button>
                )}
              </div>
              <Input
                id="shares"
                type="number"
                min="0"
                max={type === "sell" ? sharesOwned : undefined}
                step="any"
                placeholder="0.00"
                value={shares || ""}
                onChange={(e) => {
                  let val = Math.max(0, parseFloat(e.target.value) || 0)
                  if (type === "sell") {
                    val = Math.min(sharesOwned, val)
                  }
                  setShares(val)
                }}
                required
                className="h-10 text-sm font-semibold rounded-xl border-border bg-card/60"
              />
            </div>

            {/* Price per Share Input */}
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="price" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Precio unitario (USD)
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price || ""}
                onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                required
                className="h-10 text-sm font-semibold rounded-xl border-border bg-card/60"
              />
            </div>
          </div>

          {/* Link to USD account */}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="accountId" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cuenta de fondos (USD)
            </Label>
            {usdAccounts.length === 0 ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>No tenés ninguna cuenta en Dólares (USD). Primero debés crear una cuenta en USD desde Cuentas.</span>
              </div>
            ) : (
              <Select value={accountId} onValueChange={(val) => val && setAccountId(val)}>
                <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                  <SelectValue>
                    {selectedAccount
                      ? `${selectedAccount.name} (${formatShort(selectedAccount.balance, "USD")})`
                      : "Seleccionar cuenta en USD..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {usdAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatShort(acc.balance, "USD")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date Input */}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fecha de operación
            </Label>
            <DateStringPicker
              id="date"
              value={date}
              onChange={setDate}
              required
              displayFormat="dd MMM yyyy"
              endMonth={new Date()}
              disabledDates={{ after: new Date() }}
              className="font-semibold"
            />
          </div>

          {/* Preview / Warning Box */}
          {shares > 0 && price > 0 && (
            <div className="rounded-2xl bg-muted/40 p-4 border border-border/50 min-w-0">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {type === "buy" ? "Total a Debitar:" : "Total a Acreditar:"}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatShort(totalCost, "USD")}
                </span>
              </div>

              {/* Error alerts */}
              {isBuyInvalid && (
                <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>Saldo insuficiente en la cuenta. Falta {formatShort(totalCost - accountBalance, "USD")}.</span>
                </p>
              )}
              {isSellInvalid && (
                <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span>No podés vender más acciones de las que poseés. Tenés {sharesOwned} acciones.</span>
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit || loading}
            size="lg"
            className="mt-2 w-full font-semibold h-11 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Registrando...
              </>
            ) : type === "buy" ? (
              "Registrar Compra"
            ) : (
              "Registrar Venta"
            )}
          </Button>
        </form>
      </div>
    </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
