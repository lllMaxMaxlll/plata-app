"use client"

import { useState, useEffect, useMemo, useRef, useId } from "react"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { useUI } from "./ui-context"
import { formatShort, type StockTransaction } from "@/lib/finance-data"
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Briefcase,
  History,
  Eye,
  LineChart,
  X,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react"
import { StockTradeModal } from "./stock-trade-modal"
import { MarketMonitorPanel } from "./market-monitor-panel"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { getApiAuthHeaders } from "@/lib/supabase/client"
import { relativeDate } from "@/lib/relative-date"
import { pageClass } from "./lucas-ui"
import { cn } from "@/lib/utils"

type HistoryFilter = "all" | "buy" | "sell"

/** Tramos del reparto de la cartera, en orden; el último es "Otras". */
const ALLOCATION_COLORS = ["bg-sky", "bg-grape", "bg-coral", "bg-paper", "bg-muted"]

/** Agrupa por mes leyendo el prefijo del texto: construir un Date con una fecha
 *  sin hora la interpreta como UTC y en nuestro huso cae en el mes anterior. */
function monthKeyOf(iso: string) {
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (match) return `${match[1]}-${match[2]}`
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function StocksView() {
  const {
    user,
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
  const { mask } = useUI()

  const [activeTab, setActiveTab] = useState<"holdings" | "watchlist" | "history">("holdings")
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeSymbol, setTradeSymbol] = useState("")
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy")

  // --- Buscador de símbolos (combobox) ---
  const [searchSymbol, setSearchSymbol] = useState("")
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [recommendations, setRecommendations] = useState<{ symbol: string; name: string }[]>([])
  const [activeOption, setActiveOption] = useState(-1)
  const [listOpen, setListOpen] = useState(false)
  const listboxId = useId()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // --- Historial ---
  const [historyQuery, setHistoryQuery] = useState("")
  const [historyType, setHistoryType] = useState<HistoryFilter>("all")

  // --- Confirmación de borrado ---
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)

  const hasUSDAccount = accounts.some((a) => a.currency === "USD")

  const sharesBySymbol = useMemo(
    () => new Map(holdings.map((h) => [h.symbol, h.shares])),
    [holdings]
  )
  const watchedSymbols = useMemo(
    () => new Set(watchlist.map((w) => w.symbol.toUpperCase())),
    [watchlist]
  )

  useEffect(() => {
    const query = searchSymbol.trim()
    if (query.length < 1) {
      setRecommendations([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
          headers: await getApiAuthHeaders(),
        })
        if (res.ok) {
          const list = await res.json()
          setRecommendations(list)
          setActiveOption(-1)
          setListOpen(true)
        }
      } catch (err) {
        console.error("Error searching stock symbols:", err)
      } finally {
        setIsSearching(false)
      }
    }, 200)

    return () => clearTimeout(delayDebounce)
  }, [searchSymbol])

  async function addSymbol(symbol: string, label?: string) {
    const clean = symbol.trim().toUpperCase()
    if (!clean) return

    // El alta es un upsert, así que repetir un símbolo no fallaba ni cambiaba
    // nada: avisaba "agregado" y no pasaba nada. Mejor decirlo.
    if (watchedSymbols.has(clean)) {
      toast.info(`${clean} ya está en tu seguimiento.`)
      setSearchSymbol("")
      setListOpen(false)
      return
    }

    setIsAddingWatchlist(true)
    try {
      await addWatchlistStock(clean)
      toast.success(`${label ? `${clean} (${label})` : clean} agregado al seguimiento.`)
      setSearchSymbol("")
      setRecommendations([])
      setListOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al buscar el ticker.")
    } finally {
      setIsAddingWatchlist(false)
    }
  }

  async function confirmRemoveWatchlist() {
    if (!pendingRemoval) return
    const symbol = pendingRemoval
    setPendingRemoval(null)
    try {
      await removeWatchlistStock(symbol)
      toast.success(`${symbol} quitado del seguimiento.`)
    } catch {
      toast.error("Error al quitar el símbolo.")
    }
  }

  function handleOpenTrade(sym: string, type: "buy" | "sell") {
    setTradeSymbol(sym)
    setTradeType(type)
    setTradeOpen(true)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen || recommendations.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveOption((i) => (i + 1) % recommendations.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveOption((i) => (i <= 0 ? recommendations.length - 1 : i - 1))
    } else if (e.key === "Escape") {
      e.preventDefault()
      setListOpen(false)
      setActiveOption(-1)
    } else if (e.key === "Enter" && activeOption >= 0) {
      e.preventDefault()
      const option = recommendations[activeOption]
      void addSymbol(option.symbol, option.name)
    }
  }

  // --- Historial: filtrado, agrupado y totales ---
  const filteredTrades = useMemo(() => {
    const query = historyQuery.trim().toUpperCase()
    return stockTransactions.filter((tx) => {
      if (historyType !== "all" && tx.type !== historyType) return false
      if (query && !tx.symbol.toUpperCase().includes(query)) return false
      return true
    })
  }, [stockTransactions, historyType, historyQuery])

  const tradesByMonth = useMemo(() => {
    const groups = new Map<string, StockTransaction[]>()
    for (const tx of filteredTrades) {
      const key = monthKeyOf(tx.date)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(tx)
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredTrades])

  const historyTotals = useMemo(() => {
    let invested = 0
    let recovered = 0
    for (const tx of filteredTrades) {
      const total = tx.shares * tx.price
      if (tx.type === "buy") invested += total
      else recovered += total
    }
    return { invested, recovered, count: filteredTrades.length }
  }, [filteredTrades])

  const buyCount = useMemo(
    () => stockTransactions.filter((t) => t.type === "buy").length,
    [stockTransactions]
  )
  const sellCount = stockTransactions.length - buyCount
  const historyIsFiltered = historyType !== "all" || historyQuery.trim() !== ""

  // Cómo se reparte la cartera: las cuatro posiciones más grandes y el resto junto.
  const allocation = useMemo(() => {
    if (portfolioTotalValue <= 0) return []
    const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue)
    const top = sorted.slice(0, 4).map((h) => ({ symbol: h.symbol, value: h.currentValue }))
    const rest = sorted.slice(4).reduce((sum, h) => sum + h.currentValue, 0)
    if (rest > 0) top.push({ symbol: "Otras", value: rest })
    return top.map((slice, i) => ({ ...slice, share: slice.value / portfolioTotalValue, color: ALLOCATION_COLORS[i] }))
  }, [holdings, portfolioTotalValue])

  return (
    <div className={cn(pageClass, "space-y-5")}>
      {/* Encabezado */}
      <PageHeader
        route="stocks"
        description="Tus tenencias, la lista de seguimiento y el historial de operaciones."
        actions={
          <Button onClick={() => handleOpenTrade("", "buy")} disabled={!hasUSDAccount}>
            <Plus className="size-4" />
            Operar
          </Button>
        }
      />

      {/* Valor del portafolio y cómo se reparte */}
      <section className="rounded-3xl border-2 border-border bg-card p-4 text-card-foreground shadow-md sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Tu cartera vale</p>
            <p className="mt-1 text-[2.5rem] leading-none font-extrabold tracking-tighter">
              {mask(formatShort(portfolioTotalValue, "USD"))}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-muted px-2.5 py-1 font-mono text-xs font-semibold">
            {portfolioTotalProfitLoss >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {portfolioTotalProfitLoss >= 0 ? "+" : ""}
            {mask(formatShort(portfolioTotalProfitLoss, "USD"))} · {portfolioTotalProfitLossPercent}%
          </span>
        </div>
        {allocation.length > 0 && (
          <>
            <div className="mt-4 flex h-5 overflow-hidden rounded-lg border-2 border-border bg-muted">
              {allocation.map((slice) => (
                <span
                  key={slice.symbol}
                  className={cn("h-full border-r-2 border-border last:border-r-0", slice.color)}
                  style={{ width: `${slice.share * 100}%` }}
                  title={`${slice.symbol} ${Math.round(slice.share * 100)}%`}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] font-semibold">
              {allocation.map((slice) => (
                <li key={slice.symbol} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-[3px] border-[1.5px] border-border", slice.color)} />
                  {slice.symbol} {Math.round(slice.share * 100)}%
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!hasUSDAccount && (
        <div className="rounded-2xl border border-warning/20 bg-warning/10 p-3.5 text-xs text-warning">
          ⚠️ <strong>Atención:</strong> Para comprar o vender acciones necesitás tener al menos una
          cuenta en Dólares (USD) registrada en la pestaña Cuentas.
        </div>
      )}

      {user && <MarketMonitorPanel key={user.uid} symbols={[...holdings.map(h => h.symbol), ...watchlist.map(w => w.symbol)]} />}

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full">
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

        {/* ---------------------------------------------------------------- */}
        {/* TENENCIAS                                                        */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="holdings" className="pt-1">
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
            <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
              {holdings.map((h) => {
                const up = h.profitLoss >= 0
                const share = portfolioTotalValue > 0 ? h.currentValue / portfolioTotalValue : 0
                return (
                  <li key={h.symbol} className="flex flex-col rounded-2xl border-2 border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg leading-none font-extrabold tracking-tight">{h.symbol}</span>
                      <span
                        className={cn(
                          "rounded-full border-[1.5px] border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink",
                          up ? "bg-lime" : "bg-coral"
                        )}
                      >
                        {up ? "▲" : "▼"} {Math.abs(h.profitLossPercent)}%
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{h.name}</p>

                    <p className="mt-3 truncate text-xl font-extrabold tracking-tight">
                      {mask(formatShort(h.currentValue, "USD"))}
                    </p>
                    <p className={cn("font-mono text-[11px] font-semibold", up ? "text-success" : "text-destructive")}>
                      {up ? "+" : ""}
                      {mask(formatShort(h.profitLoss, "USD"))}
                    </p>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" title={`${Math.round(share * 100)}% de la cartera`}>
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${share * 100}%` }} />
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {h.shares} {h.shares === 1 ? "acc" : "accs"} · prom {formatShort(h.avgBuyPrice, "USD")}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handleOpenTrade(h.symbol, "sell")} className="h-8 px-0 text-xs">
                        Vender
                      </Button>
                      <Button size="sm" onClick={() => handleOpenTrade(h.symbol, "buy")} disabled={!hasUSDAccount} className="h-8 px-0 text-xs">
                        Comprar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* SEGUIMIENTO                                                      */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="watchlist" className="pt-1 space-y-4">
          {/* Buscador */}
          <div
            className="relative"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setListOpen(false)
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void addSymbol(searchSymbol)
              }}
              className="relative flex items-center"
            >
              <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded={listOpen && recommendations.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeOption >= 0 ? `${listboxId}-opt-${activeOption}` : undefined
                }
                placeholder="Buscar símbolo (ej. AMZN, NVDA)…"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => recommendations.length > 0 && setListOpen(true)}
                className="h-10 pl-9 pr-24 text-xs font-medium"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {isSearching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                {searchSymbol && !isSearching && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setSearchSymbol("")
                      setRecommendations([])
                      searchInputRef.current?.focus()
                    }}
                    aria-label="Limpiar búsqueda"
                    className="text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={searchSymbol.trim().length === 0 || isAddingWatchlist}
                  className="h-7 font-bold"
                >
                  {isAddingWatchlist ? <Loader2 className="size-3.5 animate-spin" /> : "Agregar"}
                </Button>
              </div>
            </form>

            {listOpen && recommendations.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Sugerencias de símbolos"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in duration-150"
              >
                {recommendations.map((item, index) => {
                  const alreadyWatched = watchedSymbols.has(item.symbol.toUpperCase())
                  return (
                    <li key={item.symbol}>
                      <button
                        id={`${listboxId}-opt-${index}`}
                        role="option"
                        aria-selected={index === activeOption}
                        type="button"
                        disabled={alreadyWatched}
                        onMouseEnter={() => setActiveOption(index)}
                        onClick={() => void addSymbol(item.symbol, item.name)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 ${
                          index === activeOption ? "bg-accent" : "hover:bg-accent"
                        }`}
                      >
                        <span className="font-bold text-foreground shrink-0">{item.symbol}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {alreadyWatched ? "Ya en seguimiento" : item.name}
                        </span>
                      </button>
                    </li>
                  )
                })}
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
                Buscá y agregá tus acciones preferidas para seguir sus precios.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
              {watchlist.map((w) => {
                const priceInfo = stockPrices[w.symbol]
                const currentPrice = priceInfo?.price ?? 0
                const dailyChange = priceInfo?.change ?? 0
                const isPositive = dailyChange >= 0
                const ownedShares = sharesBySymbol.get(w.symbol) ?? 0
                const hasPrice = Boolean(priceInfo) && currentPrice > 0

                return (
                  <li key={w.symbol} className="flex flex-col rounded-2xl border-2 border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg leading-none font-extrabold tracking-tight">{w.symbol}</span>
                      <button
                        type="button"
                        onClick={() => setPendingRemoval(w.symbol)}
                        className="-mt-1 -mr-1 flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Quitar ${w.symbol} del seguimiento`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{w.name}</p>

                    {hasPrice ? (
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-1">
                        <span className="text-xl font-extrabold tracking-tight">{formatShort(currentPrice, "USD")}</span>
                        <span className={cn("font-mono text-[11px] font-semibold", isPositive ? "text-success" : "text-destructive")}>
                          {isPositive ? "▲" : "▼"} {Math.abs(dailyChange).toFixed(2)}% hoy
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Skeleton className="h-6 w-24" />
                        <span className="sr-only">Cargando cotización</span>
                      </div>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {ownedShares > 0 ? `${ownedShares} en cartera` : "sin posición"}
                    </p>

                    <div className={cn("mt-3 grid gap-1.5", ownedShares > 0 ? "grid-cols-2" : "grid-cols-1")}>
                      {ownedShares > 0 && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenTrade(w.symbol, "sell")} className="h-8 px-0 text-xs">
                          Vender
                        </Button>
                      )}
                      <Button size="sm" onClick={() => handleOpenTrade(w.symbol, "buy")} disabled={!hasUSDAccount} className="h-8 px-0 text-xs">
                        Comprar
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* HISTORIAL                                                        */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="history" className="pt-1 space-y-4">
          {stockTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <History className="size-6" />
              </div>
              <p className="text-sm font-medium">No hay operaciones registradas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tus compras y ventas aparecerán acá.
              </p>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <Card className="p-4 shadow-sm space-y-3">
                <div className="relative flex items-center w-full">
                  <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Buscar por símbolo…"
                    aria-label="Buscar operaciones por símbolo"
                    className="pl-9 pr-9 h-9 text-xs bg-muted/30 border-border/60 focus:bg-background"
                  />
                  {historyQuery.trim() !== "" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setHistoryQuery("")}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-1.5 text-muted-foreground"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {(
                    [
                      { key: "all", label: `Todas (${stockTransactions.length})`, tone: "primary" },
                      { key: "buy", label: `Compras (${buyCount})`, tone: "emerald" },
                      { key: "sell", label: `Ventas (${sellCount})`, tone: "rose" },
                    ] as const
                  ).map(({ key, label, tone }) => {
                    const active = historyType === key
                    const styles =
                      tone === "primary"
                        ? active
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                        : tone === "emerald"
                        ? active
                          ? "bg-success text-white shadow-xs"
                          : "bg-success/10 text-success dark:text-success hover:bg-success/20 border border-success/20"
                        : active
                        ? "bg-destructive text-white shadow-xs"
                        : "bg-destructive/10 text-destructive dark:text-destructive hover:bg-destructive/20 border border-destructive/20"
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setHistoryType(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${styles}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Totales de lo que se está viendo */}
                <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Invertido
                    </p>
                    <p className="text-sm font-bold tabular-nums text-destructive">
                      {mask(formatShort(historyTotals.invested, "USD"))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Recuperado
                    </p>
                    <p className="text-sm font-bold tabular-nums text-success">
                      {mask(formatShort(historyTotals.recovered, "USD"))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Operaciones
                    </p>
                    <p className="text-sm font-bold tabular-nums">{historyTotals.count}</p>
                  </div>
                </div>
              </Card>

              {filteredTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-medium">Ninguna operación coincide</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Probá con otro símbolo o quitá los filtros.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHistoryQuery("")
                      setHistoryType("all")
                    }}
                    className="mt-3 text-xs font-semibold"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {tradesByMonth.map(([monthKey, trades]) => {
                    const net = trades.reduce(
                      (sum, tx) => sum + (tx.type === "sell" ? 1 : -1) * tx.shares * tx.price,
                      0
                    )
                    return (
                      <section key={monthKey}>
                        <div className="flex items-baseline justify-between gap-2 pb-2">
                          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {monthLabelOf(monthKey)}
                          </h2>
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              net >= 0 ? "text-success" : "text-destructive"
                            }`}
                          >
                            {net >= 0 ? "+" : "−"}
                            {mask(formatShort(Math.abs(net), "USD"))}
                          </span>
                        </div>

                        <ul className="flex flex-col gap-2.5">
                          {trades.map((tx) => {
                            const isBuy = tx.type === "buy"
                            const total = tx.shares * tx.price
                            return (
                              <li key={tx.id}>
                                <Card className="flex items-center gap-3 p-3.5 shadow-sm">
                                  <span
                                    aria-hidden
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
                                      isBuy
                                        ? "bg-success/10 border-success/20 text-success"
                                        : "bg-destructive/10 border-destructive/20 text-destructive"
                                    }`}
                                  >
                                    {isBuy ? (
                                      <ArrowDownLeft className="size-4" />
                                    ) : (
                                      <ArrowUpRight className="size-4" />
                                    )}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-bold">{tx.symbol}</span>
                                      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                                        {isBuy ? "Compra" : "Venta"}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                                      {tx.shares} {tx.shares === 1 ? "acción" : "acc"} ·{" "}
                                      {formatShort(tx.price, "USD")} c/u · {relativeDate(tx.date)}
                                    </p>
                                  </div>

                                  <p
                                    className={`text-sm font-bold tabular-nums shrink-0 ${
                                      isBuy ? "text-destructive" : "text-success"
                                    }`}
                                  >
                                    {isBuy ? "−" : "+"}
                                    {formatShort(total, "USD")}
                                  </p>
                                </Card>
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              )}

              {historyIsFiltered && filteredTrades.length > 0 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Mostrando {filteredTrades.length} de {stockTransactions.length} operaciones.
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <StockTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        prefilledSymbol={tradeSymbol}
        prefilledType={tradeType}
      />

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {pendingRemoval} del seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejás de ver su cotización en esta lista. No afecta a tus tenencias ni a las
              operaciones que ya registraste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRemoveWatchlist}
              className="cursor-pointer"
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
