"use client"

import { useState, useEffect } from "react"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

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
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al registrar la transacción.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={type === "buy" ? "Comprar Acción" : "Vender Acción"}
      description="Registrá una operación y actualizá tu portafolio"
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* Toggle Buy / Sell */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <Button
            type="button"
            variant={type === "buy" ? "default" : "ghost"}
            size="sm"
            onClick={() => setType("buy")}
            className="w-full text-xs font-semibold"
          >
            Compra
          </Button>
          <Button
            type="button"
            variant={type === "sell" ? "default" : "ghost"}
            size="sm"
            disabled={sharesOwned <= 0}
            onClick={() => setType("sell")}
            className="w-full text-xs font-semibold"
          >
            Venta {sharesOwned > 0 && `(${sharesOwned} disp.)`}
          </Button>
        </div>

        {/* Ticker Input */}
        <div className="space-y-1.5">
          <Label htmlFor="symbol" className="text-xs font-semibold text-muted-foreground">
            Símbolo / Ticker
          </Label>
          {prefilledSymbol !== "" ? (
            <Input
              id="symbol"
              type="text"
              value={symbol}
              disabled
              required
              className="h-10 text-sm uppercase font-medium"
            />
          ) : type === "buy" ? (
            watchlist.length === 0 ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
                Tu lista de seguimiento está vacía. Agregá acciones a tu portafolio de seguimiento primero.
              </div>
            ) : (
              <select
                id="symbol"
                value={symbol}
                onChange={(e) => {
                  const val = e.target.value
                  setSymbol(val)
                  const clean = val.trim().toUpperCase()
                  if (clean && stockPrices[clean]) {
                    setPrice(stockPrices[clean].price)
                  }
                }}
                required
                className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar del seguimiento...</option>
                {watchlist.map((w) => (
                  <option key={w.symbol} value={w.symbol}>
                    {w.symbol} - {w.name}
                  </option>
                ))}
              </select>
            )
          ) : holdings.length === 0 ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              No tenés acciones en tu cartera para vender.
            </div>
          ) : (
            <select
              id="symbol"
              value={symbol}
              onChange={(e) => {
                const val = e.target.value
                setSymbol(val)
                const clean = val.trim().toUpperCase()
                if (clean && stockPrices[clean]) {
                  setPrice(stockPrices[clean].price)
                }
              }}
              required
              className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar de tus tenencias...</option>
              {holdings.map((h) => (
                <option key={h.symbol} value={h.symbol}>
                  {h.symbol} - {h.name} ({h.shares} disponibles)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Shares Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="shares" className="text-xs font-semibold text-muted-foreground">
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
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Price per Share Input */}
          <div className="space-y-1.5">
            <Label htmlFor="price" className="text-xs font-semibold text-muted-foreground">
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
              className="h-10 text-sm font-medium"
            />
          </div>
        </div>

        {/* Link to USD account */}
        <div className="space-y-1.5">
          <Label htmlFor="accountId" className="text-xs font-semibold text-muted-foreground">
            Cuenta de fondos (USD)
          </Label>
          {usdAccounts.length === 0 ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              No tenés ninguna cuenta en Dólares (USD). Primero debés crear una cuenta en USD desde la sección Cuentas.
            </div>
          ) : (
            <select
              id="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {usdAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (Saldo: {formatShort(acc.balance, "USD")})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date Input */}
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-semibold text-muted-foreground">
            Fecha de operación
          </Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="h-10 text-sm font-medium"
          />
        </div>

        {/* Preview / Warning Box */}
        {shares > 0 && price > 0 && (
          <div className="rounded-xl bg-muted/60 p-4">
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
              <p className="mt-2 text-xs font-semibold text-destructive">
                ⚠️ Saldo insuficiente en la cuenta. Falta {formatShort(totalCost - accountBalance, "USD")}.
              </p>
            )}
            {isSellInvalid && (
              <p className="mt-2 text-xs font-semibold text-destructive">
                ⚠️ No podés vender más acciones de las que poseés. Tenés {sharesOwned} acciones.
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={!canSubmit}
          size="lg"
          className="mt-2 w-full font-semibold"
        >
          {loading ? "Registrando..." : type === "buy" ? "Registrar Compra" : "Registrar Venta"}
        </Button>
      </form>
    </BottomSheet>
  )
}
