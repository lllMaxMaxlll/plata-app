"use client"

import { useState, useEffect } from "react"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import { toast } from "sonner"

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
        date: new Date(date + "T12:00:00Z").toISOString(), // timezone safe
        accountId,
      })

      // If they bought a stock, automatically add it to the watchlist so they can track it
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
          <button
            type="button"
            onClick={() => setType("buy")}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              type === "buy"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Compra
          </button>
          <button
            type="button"
            disabled={sharesOwned <= 0}
            onClick={() => setType("sell")}
            className={`rounded-lg py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
              type === "sell"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Venta {sharesOwned > 0 && `(${sharesOwned} disp.)`}
          </button>
        </div>

        {/* Ticker Input */}
        <div>
          <label htmlFor="symbol" className="text-xs font-semibold text-muted-foreground">
            Símbolo / Ticker
          </label>
          {prefilledSymbol !== "" ? (
            <input
              id="symbol"
              type="text"
              value={symbol}
              disabled
              required
              className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium uppercase focus:outline-none disabled:opacity-60"
            />
          ) : type === "buy" ? (
            watchlist.length === 0 ? (
              <div className="mt-1 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-500">
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
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
            <div className="mt-1 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
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
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
          <div>
            <div className="flex justify-between items-center">
              <label htmlFor="shares" className="text-xs font-semibold text-muted-foreground">
                Cantidad
              </label>
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
            <input
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
              className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Price per Share Input */}
          <div>
            <label htmlFor="price" className="text-xs font-semibold text-muted-foreground">
              Precio unitario (USD)
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={price || ""}
              onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              required
              className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Link to USD account */}
        <div>
          <label htmlFor="accountId" className="text-xs font-semibold text-muted-foreground">
            Cuenta de fondos (USD)
          </label>
          {usdAccounts.length === 0 ? (
            <div className="mt-1 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              No tenés ninguna cuenta en Dólares (USD). Primero debés crear una cuenta en USD desde la sección Cuentas.
            </div>
          ) : (
            <select
              id="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
        <div>
          <label htmlFor="date" className="text-xs font-semibold text-muted-foreground">
            Fecha de operación
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Preview / Warning Box */}
        {shares > 0 && price > 0 && (
          <div className="rounded-2xl bg-muted/60 p-4">
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
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? "Registrando..." : type === "buy" ? "Registrar Compra" : "Registrar Venta"}
        </button>
      </form>
    </BottomSheet>
  )
}
