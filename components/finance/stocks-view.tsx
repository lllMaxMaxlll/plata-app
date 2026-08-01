"use client"

import { useState, useEffect } from "react"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function StocksView({ onBack }: { onBack?: () => void }) {
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
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onBack}
              className="rounded-xl shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <h1 className="text-xl font-semibold tracking-tight">Portafolio</h1>
        </div>
        <Button
          size="sm"
          onClick={() => handleOpenTrade("", "buy")}
          disabled={!hasUSDAccount}
          className="flex items-center gap-1 rounded-full text-xs font-semibold h-8 px-3"
        >
          <Plus className="size-3.5" />
          Operar
        </Button>
      </div>

      {/* Portfolio Balance Card */}
      <div className="mt-5 px-5">
        <Card className="relative overflow-hidden rounded-xl p-5 shadow-lg isolate border-border">
          <div aria-hidden className="absolute -right-16 -top-16 size-36 rounded-full bg-primary/10 blur-3xl" />

          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valor del Portafolio
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
            {formatShort(portfolioTotalValue, "USD")}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Badge
              variant={portfolioTotalProfitLoss >= 0 ? "default" : "destructive"}
              className="flex items-center gap-1 text-xs font-bold"
            >
              {portfolioTotalProfitLoss >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {portfolioTotalProfitLoss >= 0 ? "+" : ""}
              {formatShort(portfolioTotalProfitLoss, "USD")} ({portfolioTotalProfitLossPercent}%)
            </Badge>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Rendimiento Histórico
            </span>
          </div>
        </Card>
      </div>

      {/* Warning if no USD accounts */}
      {!hasUSDAccount && (
        <div className="mx-5 mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-500">
          ⚠️ <strong>Atención:</strong> Para comprar o vender acciones necesitás tener al menos una cuenta en Dólares (USD) registrada en la pestaña Cuentas.
        </div>
      )}

      {/* Tab Selector */}
      <div className="mt-6 px-5">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="holdings" className="gap-1.5 text-xs">
              <Briefcase className="size-3.5" />
              Tenencias
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-1.5 text-xs">
              <Eye className="size-3.5" />
              Seguimiento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <History className="size-3.5" />
              Historial
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
                <Button
                  variant="secondary"
                  onClick={() => handleOpenTrade("", "buy")}
                  disabled={!hasUSDAccount}
                  className="mt-4 rounded-xl text-xs font-semibold"
                >
                  Comprar Acciones
                </Button>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {holdings.map((h) => (
                  <li key={h.symbol}>
                    <Card className="flex flex-col p-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{h.symbol}</span>
                            <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                              {h.shares} {h.shares === 1 ? "acción" : "acciones"}
                            </Badge>
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

                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rendimiento:</span>
                          <span
                            className={`flex items-center gap-0.5 text-xs font-bold ${h.profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                              }`}
                          >
                            {h.profitLoss >= 0 ? "+" : ""}
                            {formatShort(h.profitLoss, "USD")} ({h.profitLossPercent}%)
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() => handleOpenTrade(h.symbol, "sell")}
                            className="font-bold"
                          >
                            Vender
                          </Button>
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => handleOpenTrade(h.symbol, "buy")}
                            disabled={!hasUSDAccount}
                            className="font-bold"
                          >
                            Comprar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === "watchlist" && (
          <div>
            <div className="relative mb-4">
              <form onSubmit={handleAddWatchlist} className="relative flex items-center">
                <Search className="absolute left-3 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar símbolo (Ej. AMZN, NVDA)..."
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  className="h-10 pl-9 pr-20 text-xs font-medium"
                />
                <Button
                  type="submit"
                  size="xs"
                  disabled={searchSymbol.trim().length === 0 || isAddingWatchlist}
                  className="absolute right-1.5 font-bold"
                >
                  {isAddingWatchlist ? "..." : "Agregar"}
                </Button>
              </form>

              {/* Recommendations Dropdown */}
              {recommendations.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in duration-150">
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
                        className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left text-xs hover:bg-accent transition-colors"
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
                    <li key={w.symbol}>
                      <Card className="flex items-center gap-3 p-3.5 shadow-sm">
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
                              className={`text-[10px] font-bold mt-0.5 ${isPositive ? "text-emerald-500" : "text-rose-500"
                                }`}
                            >
                              {isPositive ? "+" : ""}
                              {dailyChange.toFixed(2)}%
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 pl-2 border-l border-border">
                          <Button
                            size="xs"
                            onClick={() => handleOpenTrade(w.symbol, "buy")}
                            disabled={!hasUSDAccount}
                            className="font-bold"
                          >
                            Comprar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveWatchlist(w.symbol)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Eliminar de watchlist"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </Card>
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
                  <li key={tx.id}>
                    <Card className="flex items-center justify-between p-3.5 shadow-sm">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={tx.type === "buy" ? "default" : "destructive"}
                            className="px-1.5 py-0.5 text-[10px] uppercase font-bold"
                          >
                            {tx.type === "buy" ? "Compra" : "Venta"}
                          </Badge>
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
                    </Card>
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
