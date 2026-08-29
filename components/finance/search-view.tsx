"use client"

import { useState } from "react"
import { Search, Sparkles, CalendarRange, RefreshCw, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, type Currency, type Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { useSemanticSearch } from "./use-semantic-search"
import { TransactionList } from "./transaction-list"
import { cn } from "@/lib/utils"

const EXAMPLES = [
  "cuánto gasté en el auto el verano pasado",
  "compras del super el mes pasado",
  "servicios de la casa este año",
  "salidas a comer en marzo",
]

export function SearchView({
  onEditTransaction,
}: {
  onEditTransaction?: (tx: Transaction) => void
}) {
  const { user, transactions, accounts, vehicles } = useFinance()
  const [query, setQuery] = useState("")

  const { result, search, clear, sync, searching, syncing, pending, available } =
    useSemanticSearch({
      uid: user?.uid,
      transactions,
      accounts,
      vehicles: vehicles ?? [],
    })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void search(query)
  }

  function handleClear() {
    setQuery("")
    clear()
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
          <Sparkles className="size-4 text-primary" />
          Búsqueda inteligente
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Preguntá en tus palabras. Devuelve tus movimientos reales, no un resumen escrito por
          una IA.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Cuánto gasté en el auto el verano pasado?"
            aria-label="Buscar movimientos"
            className="h-11 rounded-xl pl-9 pr-9 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-11 rounded-xl px-5 text-sm font-semibold"
        >
          {searching ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "Buscar"
          )}
        </Button>
      </form>

      {!result && !searching && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Badge
              key={example}
              variant="outline"
              onClick={() => {
                setQuery(example)
                void search(example)
              }}
              className="cursor-pointer px-3 py-1 text-xs font-normal text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </Badge>
          ))}
        </div>
      )}

      <IndexStatus
        available={available}
        pending={pending}
        syncing={syncing}
        onSync={() => void sync()}
      />

      {result && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">
                {result.transactions.length}{" "}
                {result.transactions.length === 1 ? "movimiento" : "movimientos"}
              </p>
              {result.dateRange && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-[10px] font-medium"
                >
                  <CalendarRange className="size-3" />
                  {result.dateRange.label}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              {Object.entries(result.totals).map(([currency, total]) => (
                <span
                  key={currency}
                  className={cn(
                    "font-bold",
                    total < 0 ? "text-red-400" : "text-emerald-400"
                  )}
                >
                  {formatCurrency(total, currency as Currency)}
                </span>
              ))}
            </div>
          </div>

          {result.transactions.length === 0 ? (
            <p className="mt-6 rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              No encontré movimientos que coincidan.
              {result.dateRange && ` El filtro de fecha fue: ${result.dateRange.label}.`}
            </p>
          ) : (
            <TransactionList
              transactions={result.transactions}
              onEditTransaction={onEditTransaction}
            />
          )}
        </section>
      )}
    </div>
  )
}

/**
 * Estado del índice. Sólo aparece cuando hay algo que decir: si todo está
 * indexado y el índice existe, no ocupa lugar en la pantalla.
 */
function IndexStatus({
  available,
  pending,
  syncing,
  onSync,
}: {
  available: boolean
  pending: number
  syncing: boolean
  onSync: () => void
}) {
  if (!available) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          La búsqueda semántica no está configurada en este entorno. El filtro por fecha sigue
          funcionando.
        </span>
      </p>
    )
  }

  if (pending === 0 && !syncing) return null

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {syncing
          ? "Indexando movimientos…"
          : `${pending} ${pending === 1 ? "movimiento" : "movimientos"} sin indexar.`}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={syncing}
        onClick={onSync}
        className="h-8 gap-1.5 rounded-lg text-xs"
      >
        <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
        {syncing ? "Indexando" : "Indexar ahora"}
      </Button>
    </div>
  )
}
