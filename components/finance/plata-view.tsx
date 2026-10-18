"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Download, Plus, Target } from "lucide-react"
import { formatCompact, formatShort } from "@/lib/finance-data"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { BlockHeader, Pill, pageClass } from "./lucas-ui"
import { useAgenda, useNetWorth, useToARS } from "./use-lucas-data"
import { PageHeader } from "./page-header"

/** Colores de los tramos de "Dónde está", en orden. El último es para "otras". */
const SLICE_COLORS = ["bg-lime", "bg-sky", "bg-grape", "bg-coral", "bg-muted"]

/**
 * Plata: todo lo que tenés junto. Reemplaza el ir y venir entre Cuentas,
 * Análisis, Portafolio y Proyecciones: cada bloque resume y lleva a la
 * pantalla completa.
 */
export function PlataView() {
  const ui = useUI()

  return (
    <div className={pageClass}>
      <PageHeader route="plata" description="Lo que tenés, dónde está y en qué se va." />

      <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <WhereItIs />
          <Tiles />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={ui.handleOpenExchange} className="h-auto flex-col gap-1 py-2.5 text-xs">
              <ArrowLeftRight />
              Cambio
            </Button>
            <Button variant="outline" onClick={ui.handleAddAccount} className="h-auto flex-col gap-1 py-2.5 text-xs">
              <Plus />
              Cuenta
            </Button>
            <Button variant="outline" onClick={ui.handleOpenExport} className="h-auto flex-col gap-1 py-2.5 text-xs">
              <Download />
              Exportar
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <WhereItGoes />
          <Goals />
        </div>
      </div>
    </div>
  )
}

function WhereItIs() {
  const { accounts, portfolioTotalValue } = useFinance()
  const { mask } = useUI()
  const { fxRate, inARS } = useNetWorth()

  const slices = useMemo(() => {
    const parts = accounts
      .map((a) => ({ name: a.name, value: a.currency === "USD" ? a.balance * fxRate : a.balance }))
      .concat(portfolioTotalValue > 0 ? [{ name: "Acciones", value: portfolioTotalValue * fxRate }] : [])
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)

    const total = parts.reduce((sum, p) => sum + p.value, 0)
    if (total === 0) return []

    const top = parts.slice(0, 4)
    const rest = parts.slice(4).reduce((sum, p) => sum + p.value, 0)
    if (rest > 0) top.push({ name: "Otras", value: rest })
    return top.map((p, i) => ({ ...p, share: p.value / total, color: SLICE_COLORS[i] }))
  }, [accounts, portfolioTotalValue, fxRate])

  return (
    <section>
      <BlockHeader title="Dónde está" href={ROUTES.accounts.href} linkLabel="cuentas" />
      <p className="text-3xl font-extrabold tracking-tighter">{mask(formatShort(inARS, "ARS"))}</p>
      {slices.length > 0 ? (
        <>
          <div className="mt-3 flex h-6 overflow-hidden rounded-lg border-2 border-foreground">
            {slices.map((s) => (
              <span
                key={s.name}
                className={cn("h-full border-r-2 border-foreground last:border-r-0", s.color)}
                style={{ width: `${s.share * 100}%` }}
                title={`${s.name} ${Math.round(s.share * 100)}%`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-[3px] border-[1.5px] border-foreground", s.color)} />
                {s.name} {Math.round(s.share * 100)}%
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Cuando cargues saldo en tus cuentas, acá vas a ver cómo se reparte.</p>
      )}
    </section>
  )
}

function Tiles() {
  const { accounts, transactions, vehicles, portfolioTotalValue, portfolioTotalProfitLossPercent } = useFinance()
  const { mask } = useUI()
  const toARS = useToARS()
  const agenda = useAgenda(30)
  const [now] = useState(() => new Date())

  const month = useMemo(() => {
    let income = 0
    let expense = 0
    for (const tx of transactions) {
      const d = new Date(tx.date)
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue
      if (tx.type === "income") income += toARS(tx)
      else if (tx.type === "expense") expense += toARS(tx)
    }
    return { net: income - expense, rate: income > 0 ? (income - expense) / income : null }
  }, [transactions, toARS, now])

  const serviceAlerts = agenda.filter((i) => i.kind === "service" && i.urgency !== "later").length
  const pl = portfolioTotalProfitLossPercent || 0

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Tile href={ROUTES.accounts.href} label="Cuentas" value={String(accounts.length)}>
        {accounts.length === 1 ? "cuenta" : "cuentas"}
      </Tile>
      <Tile
        href={ROUTES.stocks.href}
        label="Acciones"
        value={portfolioTotalValue > 0 ? mask(formatShort(portfolioTotalValue, "USD")) : "—"}
      >
        {portfolioTotalValue > 0 ? (
          <span className={pl >= 0 ? "text-success" : "text-destructive"}>
            {pl >= 0 ? "▲" : "▼"} {Math.abs(pl)}%
          </span>
        ) : (
          "sin posiciones"
        )}
      </Tile>
      <Tile href={ROUTES.vehicles.href} label="Vehículos" value={String(vehicles.length)}>
        {serviceAlerts > 0 ? <Pill tone="coral">{serviceAlerts} service pronto</Pill> : "al día"}
      </Tile>
      <Tile href={ROUTES.analytics.href} label="Este mes" value={mask(formatCompact(month.net, "ARS"))}>
        {month.rate === null ? "sin ingresos todavía" : `ahorrás ${Math.round(month.rate * 100)}%`}
      </Tile>
    </div>
  )
}

function Tile({
  href,
  label,
  value,
  children,
}: {
  href: string
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border-2 border-foreground bg-card p-3 transition-colors hover:bg-lime/30"
    >
      <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="mt-0.5 block truncate text-lg font-extrabold tracking-tight">{value}</span>
      <span className="block truncate font-mono text-[11px]">{children}</span>
    </Link>
  )
}

function WhereItGoes() {
  const { transactions, categories } = useFinance()
  const { mask } = useUI()
  const toARS = useToARS()
  const [now] = useState(() => new Date())

  const rows = useMemo(() => {
    const thisMonth = new Map<string, number>()
    const lastMonth = new Map<string, number>()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    for (const tx of transactions) {
      if (tx.type !== "expense") continue
      const d = new Date(tx.date)
      const bucket =
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
          ? thisMonth
          : d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()
          ? lastMonth
          : null
      if (bucket) bucket.set(tx.category, (bucket.get(tx.category) ?? 0) + toARS(tx))
    }

    return [...thisMonth.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => {
        const before = lastMonth.get(name)
        return {
          name,
          total,
          delta: before ? (total - before) / before : null,
          color: categories.find((c) => c.name === name)?.color,
        }
      })
  }, [transactions, categories, toARS, now])

  const max = rows[0]?.total ?? 0
  const monthName = now.toLocaleDateString("es-AR", { month: "long" })

  return (
    <section>
      <BlockHeader title={`En qué se va · ${monthName}`} href={ROUTES.analytics.href} linkLabel="detalle" />
      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-foreground/30 px-4 py-5 text-sm text-muted-foreground">
          Todavía no hay gastos este mes.
        </p>
      ) : (
        <ul className="space-y-3 rounded-2xl border-2 border-foreground bg-card p-3.5">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px] border-[1.5px] border-foreground"
                    style={{ background: row.color }}
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold">{mask(formatShort(row.total, "ARS"))}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${(row.total / max) * 100}%` }} />
                </div>
                {row.delta !== null && (
                  <span
                    className={cn(
                      "w-16 shrink-0 text-right font-mono text-[10px]",
                      row.delta > 0 ? "text-destructive" : "text-success"
                    )}
                  >
                    {row.delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(row.delta * 100))}% mes
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Goals() {
  const { goals } = useFinance()
  const { mask } = useUI()
  const pending = goals.filter((g) => !g.achievedAt).sort((a, b) => a.priority - b.priority)

  return (
    <section>
      <BlockHeader title="Metas" href={ROUTES.projections.href} linkLabel="simular" />
      {pending.length === 0 ? (
        <Link
          href={ROUTES.projections.href}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-foreground/40 px-4 py-4 text-sm transition-colors hover:bg-grape/30"
        >
          <Target className="size-5 shrink-0" />
          <span>
            <b>Poné una meta</b> y te digo cuándo llegás a este ritmo.
          </span>
        </Link>
      ) : (
        <ul className="space-y-2">
          {pending.slice(0, 3).map((goal) => (
            <li key={goal.id}>
              <Link
                href={ROUTES.projections.href}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-foreground bg-grape px-3.5 py-3 text-ink transition-transform hover:-translate-y-px"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{goal.name}</span>
                  <span className="font-mono text-[11px]">
                    {goal.kind === "reserve" ? "reserva" : "compra"} · ver cuándo llegás
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold">
                  {mask(formatShort(goal.amount, goal.currency))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
