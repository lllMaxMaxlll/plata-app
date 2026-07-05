"use client"

import { useState, useEffect } from "react"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Briefcase,
  History,
  Eye,
  LineChart
} from "lucide-react"
import { StockTradeModal } from "./stock-trade-modal"
import { toast } from "sonner"

export function StocksView() {
  const {
    watchlist,
    stockTransactions,
    stockPrices,
    holdings,
    portfolioTotalValue,
    portfolioTotalProfitLoss,
    portfolioTotalProfitLossPercent,
    addWatchlistStock,
    removeWatchlistStock,
    accounts,
  } = useFinance()

  const [activeTab, setActiveTab] = useState<"holdings" | "watchlist" | "history">("holdings")
  const [searchSymbol, setSearchSymbol] = useState("")
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeSymbol, setTradeSymbol] = useState("")
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy")
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false)
  const [recommendations, setRecommendations] = useState<{ symbol: string; name: string }[]>([])

  // Fetch symbol recommendations with 200ms debounce
  useEffect(() => {
    const query = searchSymbol.trim()
    if (query.length < 1) {
      setRecommendations([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const list = await res.json()
          setRecommendations(list)
        }
      } catch (err) {
        console.error("Error searching stock symbols:", err)
      }
    }, 200)

    return () => clearTimeout(delayDebounce)
  }, [searchSymbol])

  // Handle adding ticker to watchlist
  async function handleAddWatchlist(e: React.FormEvent) {
    e.preventDefault()
    const sym = searchSymbol.trim().toUpperCase()
    if (!sym) return

    setIsAddingWatchlist(true)
    try {
      await addWatchlistStock(sym)
      toast.success(`${sym} agregado a la lista de seguimiento.`)
      setSearchSymbol("")
    } catch (err: any) {
      toast.error(err.message || "Error al buscar el ticker.")
    } finally {
      setIsAddingWatchlist(false)
    }
  }

  // Handle removing ticker from watchlist
  async function handleRemoveWatchlist(sym: string) {
    try {
      await removeWatchlistStock(sym)
      toast.success(`${sym} removido de la lista de seguimiento.`)
    } catch (err: any) {
      toast.error("Error al remover de la lista.")
    }
  }

  function handleOpenTrade(sym: string, type: "buy" | "sell") {
    setTradeSymbol(sym)
    setTradeType(type)
    setTradeOpen(true)
  }

  const hasUSDAccount = accounts.some((a) => a.currency === "USD")

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      {/* Title */}
      <div className="flex items-center justify-between px-5">
        <h1 className="text-xl font-semibold tracking-tight">Portafolio</h1>
        <button
          onClick={() => handleOpenTrade("", "buy")}
          disabled={!hasUSDAccount}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Operar
        </button>
      </div>

      {/* Portfolio Balance Card */}
      <div className="mt-5 px-5">
        <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card to-card/70 p-5 shadow-lg isolate">
          {/* Light glow */}
          <div aria-hidden className="absolute -right-16 -top-16 size-36 rounded-full bg-primary/10 blur-3xl" />
          
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valor del Portafolio
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
            {formatShort(portfolioTotalValue, "USD")}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold leading-none ${
                portfolioTotalProfitLoss >= 0
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {portfolioTotalProfitLoss >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {portfolioTotalProfitLoss >= 0 ? "+" : ""}
              {formatShort(portfolioTotalProfitLoss, "USD")} ({portfolioTotalProfitLossPercent}%)
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Rendimiento Histórico
            </span>
          </div>
        </div>
      </div>

      {/* Warning if no USD accounts */}
      {!hasUSDAccount && (
        <div className="mx-5 mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-500">
          ⚠️ <strong>Atención:</strong> Para comprar o vender acciones necesitás tener al menos una cuenta en Dólares (USD) registrada en la pestaña Cuentas.
        </div>
      )}

      {/* Tab Selector */}
      <div className="mt-6 flex border-b border-border px-5">
        {[
          { id: "holdings", label: "Tenencias", Icon: Briefcase },
          { id: "watchlist", label: "Seguimiento", Icon: Eye },
          { id: "history", label: "Historial", Icon: History },
        ].map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-5 px-5 pb-6">
        {/* HOLDINGS TAB */}
        {activeTab === "holdings" && (
          <div>
            {holdings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Briefcase className="size-6" />
                </div>
                <p className="text-sm font-medium">No tenés acciones en cartera</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[240px]">
                  Registrá una compra de acciones para empezar a seguir tus ganancias.
                </p>
                <button
                  onClick={() => handleOpenTrade("", "buy")}
                  disabled={!hasUSDAccount}
                  className="mt-4 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground disabled:opacity-50"
                >
                  Comprar Acciones
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {holdings.map((h) => (
                  <li
                    key={h.symbol}
                    className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/10"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{h.symbol}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {h.shares} {h.shares === 1 ? "acción" : "acciones"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                          {h.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">
                          {formatShort(h.currentValue, "USD")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          P. Promedio: {formatShort(h.avgBuyPrice, "USD")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Rendimiento:</span>
                        <span
                          className={`flex items-center gap-0.5 text-xs font-bold ${
                            h.profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {h.profitLoss >= 0 ? "+" : ""}
                          {formatShort(h.profitLoss, "USD")} ({h.profitLossPercent}%)
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenTrade(h.symbol, "sell")}
                          className="rounded-lg bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-500 transition-colors"
                        >
                          Vender
                        </button>
                        <button
                          onClick={() => handleOpenTrade(h.symbol, "buy")}
                          disabled={!hasUSDAccount}
                          className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-500 transition-colors disabled:opacity-50"
                        >
                          Comprar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === "watchlist" && (
          <div>
            {/* Add symbol search */}
            <div className="relative mb-4">
              <form onSubmit={handleAddWatchlist} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Buscar símbolo (Ej. AMZN, NVDA)..."
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card pl-10 pr-20 py-2.5 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Search className="absolute left-3.5 size-4 text-muted-foreground" />
                <button
                  type="submit"
                  disabled={searchSymbol.trim().length === 0 || isAddingWatchlist}
                  className="absolute right-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  {isAddingWatchlist ? "..." : "Agregar"}
                </button>
              </form>

              {/* Recommendations Dropdown */}
              {recommendations.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-lg animate-in fade-in duration-150">
                  {recommendations.map((item) => (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        onClick={async () => {
                          setSearchSymbol("")
                          setRecommendations([])
                          setIsAddingWatchlist(true)
                          try {
                            await addWatchlistStock(item.symbol)
                            toast.success(`${item.symbol} (${item.name}) agregado.`)
                          } catch (e: any) {
                            toast.error(e.message || "Error al agregar stock.")
                          } finally {
                            setIsAddingWatchlist(false)
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left text-xs hover:bg-primary/10 transition-colors"
                      >
                        <span className="font-bold text-foreground">{item.symbol}</span>
                        <span className="truncate text-[10px] text-muted-foreground ml-3 max-w-[180px]">
                          {item.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {watchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <LineChart className="size-6" />
                </div>
                <p className="text-sm font-medium">Lista de seguimiento vacía</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[240px]">
                  Buscá y agregá tus acciones preferidas para seguir sus precios en tiempo real.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {watchlist.map((w) => {
                  const priceInfo = stockPrices[w.symbol] || { price: 0, change: 0, name: w.name }
                  const currentPrice = priceInfo.price
                  const dailyChange = priceInfo.change
                  const isPositive = dailyChange >= 0

                  return (
                    <li
                      key={w.symbol}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/10"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleOpenTrade(w.symbol, "buy")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{w.symbol}</span>
                          <span className="truncate text-xs text-muted-foreground max-w-[120px]">
                            {w.name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">
                          {currentPrice > 0 ? formatShort(currentPrice, "USD") : "Cargando..."}
                        </p>
                        {currentPrice > 0 && (
                          <p
                            className={`text-[10px] font-bold mt-0.5 ${
                              isPositive ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {dailyChange.toFixed(2)}%
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 pl-2 border-l border-border/60">
                        <button
                          onClick={() => handleOpenTrade(w.symbol, "buy")}
                          disabled={!hasUSDAccount}
                          className="rounded-lg bg-primary/10 hover:bg-primary/20 px-2 py-1 text-[11px] font-bold text-primary transition-colors disabled:opacity-50"
                          title="Comprar"
                        >
                          Comprar
                        </button>
                        <button
                          onClick={() => handleRemoveWatchlist(w.symbol)}
                          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Eliminar de watchlist"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            {stockTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <History className="size-6" />
                </div>
                <p className="text-sm font-medium">No hay operaciones registradas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tus transacciones de Compra y Venta aparecerán acá.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {stockTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${
                            tx.type === "buy"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-rose-500/10 text-rose-500"
                          }`}
                        >
                          {tx.type === "buy" ? "Compra" : "Venta"}
                        </span>
                        <span className="text-sm font-bold">{tx.symbol}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(tx.date).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {tx.shares} acc @ {formatShort(tx.price, "USD")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">
                        {tx.type === "buy" ? "-" : "+"}
                        {formatShort(tx.shares * tx.price, "USD")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Trade Modal */}
      <StockTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        prefilledSymbol={tradeSymbol}
        prefilledType={tradeType}
      />
    </div>
  )
}
