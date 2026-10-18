"use client"

import { useEffect, useRef, useState } from "react"
import { Search, CalendarRange, RefreshCw, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatShort, type Currency, type Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { useSemanticSearch, type UnavailableReason } from "./use-semantic-search"
import { TransactionList } from "./transaction-list"
import { cn } from "@/lib/utils"
import { PageHeader } from "./page-header"
import { pageClass } from "./lucas-ui"

const EXAMPLES = [
  "cuánto gasté en el auto el verano pasado",
  "compras del super el mes pasado",
  "servicios de la casa este año",
  "salidas a comer en marzo",
]

export function SearchView({
  onEditTransaction,
  initialQuery = "",
}: {
  onEditTransaction?: (tx: Transaction) => void
  /** Pregunta que llega desde la barra Anotar: se busca apenas abre la pantalla. */
  initialQuery?: string
}) {
  const { user, transactions, accounts, vehicles } = useFinance()
  const [query, setQuery] = useState(initialQuery)

  const { result, search, clear, sync, searching, syncing, pending, available, reason } =
    useSemanticSearch({
      uid: user?.uid,
      transactions,
      accounts,
      vehicles: vehicles ?? [],
    })

  const askedInitial = useRef(false)
  useEffect(() => {
    if (askedInitial.current || !initialQuery.trim()) return
    askedInitial.current = true
    void search(initialQuery)
  }, [initialQuery, search])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void search(query)
  }

  function handleClear() {
    setQuery("")
    clear()
  }

  return (
    <div className={pageClass}>
      <PageHeader
        route="search"
        description="Preguntá en tus palabras. Devuelve tus movimientos reales, no un resumen escrito por una IA."
      />

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Cuánto gasté en el auto el verano pasado?"
                aria-label="Buscar movimientos"
                enterKeyHint="search"
                className="h-14 w-full rounded-2xl border-2 border-foreground bg-card pr-11 pl-12 text-base font-semibold shadow-md outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-lime"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Limpiar búsqueda"
                  className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" disabled={searching || !query.trim()} className="h-14 px-5 text-base font-extrabold">
              {searching ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Buscar"
              )}
            </Button>
          </form>

          <IndexStatus
            available={available}
            reason={reason}
            pending={pending}
            syncing={syncing}
            onSync={() => void sync()}
          />

          {result ? (
            <section className="space-y-4">
              <div className="rounded-2xl border-2 border-foreground bg-sky p-4 text-ink shadow-sm">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold">
                  <span>
                    {result.transactions.length} {result.transactions.length === 1 ? "movimiento" : "movimientos"}
                  </span>
                  {result.dateRange && (
                    <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-white/70 px-2 py-0.5">
                      <CalendarRange className="size-3" />
                      {result.dateRange.label}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5">
                  {Object.keys(result.totals).length === 0 ? (
                    <p className="text-3xl font-extrabold tracking-tighter">$0</p>
                  ) : (
                    Object.entries(result.totals).map(([currency, total]) => (
                      <p key={currency} className="text-3xl font-extrabold tracking-tighter">
                        {formatShort(total, currency as Currency)}
                      </p>
                    ))
                  )}
                </div>
              </div>

              {result.transactions.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-foreground/30 py-8 text-center text-sm text-muted-foreground">
                  No encontré movimientos que coincidan.
                  {result.dateRange && ` El filtro de fecha fue: ${result.dateRange.label}.`}
                </p>
              ) : (
                <div className="rounded-2xl border-2 border-foreground bg-card px-3.5 py-1">
                  <TransactionList transactions={result.transactions} onEditTransaction={onEditTransaction} />
                </div>
              )}
            </section>
          ) : (
            !searching && (
              <p className="rounded-2xl border-2 border-dashed border-foreground/30 px-4 py-8 text-center text-sm text-muted-foreground">
                El <b className="text-foreground">qué</b> lo entiendo por significado y el{" "}
                <b className="text-foreground">cuándo</b> lo leo de la frase: “el verano pasado”, “en marzo”, “este año”.
              </p>
            )
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-0">
          <p className="text-sm font-extrabold">Probá con</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example)
                  void search(example)
                }}
                className="cursor-pointer rounded-full border-2 border-foreground bg-card px-3 py-1 text-left text-xs font-semibold transition-colors hover:bg-lime hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            También podés preguntar desde Anotar (⌘K): si empieza con “cuánto” o “qué”, busca acá.
          </p>
        </aside>
      </div>
    </div>
  )
}

/**
 * Estado del índice. Sólo aparece cuando hay algo que decir: si todo está
 * indexado y el índice existe, no ocupa lugar en la pantalla.
 */
const UNAVAILABLE_COPY: Record<UnavailableReason, string> = {
  // Es lo esperable corriendo en local sin credenciales de Cloudflare.
  "no-binding":
    "La búsqueda semántica no está configurada en este entorno. El filtro por fecha sigue funcionando.",
  "embedding-failed":
    "No se pudo procesar la consulta (el modelo no respondió). Probá de nuevo en un momento.",
  "index-error":
    "El índice de búsqueda no respondió. Probá de nuevo; si sigue igual, mirá los logs del Worker.",
}

function IndexStatus({
  available,
  reason,
  pending,
  syncing,
  onSync,
}: {
  available: boolean
  reason: UnavailableReason | null
  pending: number
  syncing: boolean
  onSync: () => void
}) {
  if (!available) {
    return (
      <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-foreground/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{UNAVAILABLE_COPY[reason ?? "no-binding"]}</span>
      </p>
    )
  }

  if (pending === 0 && !syncing) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-foreground bg-card p-3">
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
        className="h-8 gap-1.5 text-xs"
      >
        <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
        {syncing ? "Indexando" : "Indexar ahora"}
      </Button>
    </div>
  )
}
