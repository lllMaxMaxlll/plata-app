"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff, Plus, RefreshCw } from "lucide-react"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { TransactionList } from "./transaction-list"
import { AgendaRow, BlockHeader, pageClass } from "./lucas-ui"
import { useAgenda, useNetWorth, useToARS } from "./use-lucas-data"
import { formatShort, type Currency, type Transaction } from "@/lib/finance-data"
import { weeklyPace } from "@/lib/weekly-pace"
import { ROUTES } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 6) return "Buenas noches"
  if (hour < 13) return "Buen día"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}

/**
 * Hoy: cuánto tenés, cómo viene la semana y qué se viene. La barra de arriba
 * abre Anotar, que sirve tanto para cargar como para preguntar.
 */
export function HomeView({ onEditTransaction }: { onEditTransaction: (tx: Transaction) => void }) {
  const { user, transactions } = useFinance()
  const ui = useUI()
  const agenda = useAgenda(7)
  const [now] = useState(() => new Date())
  const firstName = user?.name?.split(" ")[0]

  return (
    <div className={pageClass}>
      <h1 className="text-2xl font-extrabold tracking-tight">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ""}
      </h1>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <BalanceCard />

          <button
            type="button"
            onClick={ui.handleOpenAnotar}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-foreground bg-card px-3.5 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-lime/30"
          >
            <Plus className="size-4.5 shrink-0 text-foreground" strokeWidth={2.5} />
            <span className="min-w-0 truncate">
              Anotá o preguntá… <b className="font-semibold text-foreground">“cuánto en nafta este mes”</b>
            </span>
          </button>

          <WeekMeter now={now} />
        </div>

        <div className="space-y-5">
          <section>
            <BlockHeader title="Se viene" href={ROUTES.agenda.href} linkLabel="agenda" />
            {agenda.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-foreground/30 px-4 py-5 text-sm text-muted-foreground">
                Nada en los próximos 7 días. Estás al día 🙌
              </p>
            ) : (
              <ul className="rounded-2xl border-2 border-foreground bg-card px-3.5">
                {agenda.slice(0, 4).map((item) => (
                  <AgendaRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <BlockHeader title="Últimos" href={ROUTES.activity.href} linkLabel="todos" />
            <div className="rounded-2xl border-2 border-foreground bg-card px-3.5 py-1">
              <TransactionList
                transactions={transactions.slice(0, 5)}
                onEditTransaction={onEditTransaction}
                empty={
                  <>
                    <p>Todavía no anotaste nada.</p>
                    <Button size="sm" onClick={ui.handleOpenAnotar}>
                      <Plus className="size-4" />
                      Anotar el primero
                    </Button>
                  </>
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function BalanceCard() {
  const { syncMacroFromApi, settingsLoaded } = useFinance()
  const { balancesHidden, toggleBalancesHidden, mask } = useUI()
  const worth = useNetWorth()
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [syncing, setSyncing] = useState(false)

  const total = currency === "ARS" ? worth.inARS : worth.inUSD
  const updatedAt = worth.lastUpdated
    ? new Date(worth.lastUpdated).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null

  async function syncFx() {
    setSyncing(true)
    try {
      await syncMacroFromApi()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="rounded-3xl border-2 border-foreground bg-lime p-4 text-ink shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">Tenés</span>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex overflow-hidden rounded-full border-2 border-ink bg-white" role="group" aria-label="Moneda">
            {(["ARS", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "cursor-pointer px-2.5 py-0.5 font-mono text-[11px] font-semibold",
                  currency === c ? "bg-ink text-lime" : "text-ink"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleBalancesHidden}
            aria-label={balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-ink/10"
          >
            {balancesHidden ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[2.5rem] leading-none font-extrabold tracking-tighter">
        {mask(formatShort(total, currency))}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        {settingsLoaded && !worth.fxConfigured ? (
          <>
            <span>Sin dólar cargado: consolido a {formatShort(worth.fxRate, "ARS")}</span>
            <button
              type="button"
              onClick={syncFx}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1 font-semibold underline underline-offset-2"
            >
              <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
              traer cotización
            </button>
          </>
        ) : (
          <>
            {worth.rates?.mep ? <span>MEP {formatShort(worth.rates.mep, "ARS")}</span> : null}
            {worth.rates?.blue ? <span>Blue {formatShort(worth.rates.blue, "ARS")}</span> : null}
            {updatedAt && <span>act. {updatedAt}</span>}
            <button
              type="button"
              onClick={syncFx}
              disabled={syncing}
              aria-label="Actualizar cotización"
              className="inline-flex cursor-pointer items-center rounded-full p-0.5 hover:bg-ink/10"
            >
              <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
            </button>
          </>
        )}
      </div>
    </section>
  )
}

function WeekMeter({ now }: { now: Date }) {
  const { transactions } = useFinance()
  const { mask } = useUI()
  const toARS = useToARS()
  const pace = useMemo(() => weeklyPace(transactions, { now, toARS }), [transactions, now, toARS])

  const fill = pace.ratio === null ? 0 : Math.min(1, pace.ratio)
  const over = pace.ratio !== null && pace.ratio > 1

  return (
    <section>
      <BlockHeader title="Esta semana" href={ROUTES.analytics.href} linkLabel="en qué se va" />
      <div
        className="h-4 overflow-hidden rounded-full border-2 border-foreground bg-card"
        role="meter"
        aria-label="Gasto de la semana contra tu promedio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
      >
        <div
          className={cn("h-full border-foreground", over ? "bg-coral" : "bg-lime")}
          style={{ width: `${fill * 100}%`, borderRightWidth: fill > 0 && fill < 1 ? 2 : 0 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 font-mono text-[11px]">
        <span>gastaste {mask(formatShort(pace.spent, "ARS"))}</span>
        <span className="text-muted-foreground">
          {pace.average === null
            ? "sin semanas para comparar"
            : over
            ? `${Math.round((pace.ratio! - 1) * 100)}% más que tu promedio`
            : `tu promedio ${mask(formatShort(pace.average, "ARS"))}`}
        </span>
      </div>
    </section>
  )
}
