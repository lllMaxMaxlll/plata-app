"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, isSameDay, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock, Car, Plus } from "lucide-react"
import { formatShort, type DueItem } from "@/lib/finance-data"
import type { AgendaItem } from "@/lib/agenda"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { useAgenda } from "./use-lucas-data"
import { IconTile, Pill, agendaIcon, agendaTone, agendaWhen, pageClass } from "./lucas-ui"
import { PageHeader } from "./page-header"
import { PayVencimientoModal } from "./pay-vencimiento-modal"
import { VencimientoSheet } from "./vencimiento-sheet"

/**
 * Agenda: todo lo que tiene fecha o kilometraje, en una sola línea de tiempo.
 * Los vencimientos se pagan desde la tarjeta; el service del vehículo lleva a
 * su ficha. La pantalla completa de cada uno sigue a un toque.
 */
export function AgendaView() {
  const { mask } = useUI()
  const agenda = useAgenda(30)
  const [now] = useState(() => new Date())
  const [paying, setPaying] = useState<DueItem | null>(null)
  const [creating, setCreating] = useState(false)

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(now, i)), [now])
  const busyDays = useMemo(
    () =>
      agenda
        .map((item) => item.date)
        .filter((d): d is string => Boolean(d))
        .map((d) => parseISO(d)),
    [agenda]
  )

  const groups: { title: string; items: AgendaItem[] }[] = [
    { title: "Vencido", items: agenda.filter((i) => i.urgency === "overdue") },
    { title: "Esta semana", items: agenda.filter((i) => i.urgency !== "overdue" && (i.daysUntil ?? 0) <= 7) },
    { title: "Más adelante", items: agenda.filter((i) => i.urgency !== "overdue" && (i.daysUntil ?? 0) > 7) },
  ].filter((g) => g.items.length > 0)

  // Lo que hay que pagar en la semana, vencidos incluidos: el número que
  // importa para saber si alcanza la plata de la cuenta.
  const toPay = agenda.filter(
    (i): i is Extract<AgendaItem, { kind: "due" }> => i.kind === "due" && (i.daysUntil ?? 0) <= 7
  )
  const toPayARS = toPay.filter((i) => i.currency === "ARS").reduce((sum, i) => sum + i.amount, 0)
  const toPayUSD = toPay.filter((i) => i.currency === "USD").reduce((sum, i) => sum + i.amount, 0)
  const overdue = agenda.filter((i) => i.urgency === "overdue").length

  return (
    <div className={pageClass}>
      <PageHeader
        route="agenda"
        description="Vencimientos y services en una sola línea de tiempo."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            Vencimiento
          </Button>
        }
      />

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="space-y-4 lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1">
          <ol className="grid grid-cols-7 gap-1.5" aria-label="Próximos 7 días">
            {week.map((day, i) => {
              const busy = busyDays.some((d) => isSameDay(d, day))
              return (
                <li
                  key={day.toISOString()}
                  className={cn(
                    "rounded-[10px] border-2 border-foreground py-1.5 text-center",
                    i === 0 ? "bg-ink text-lime dark:bg-lime dark:text-ink" : busy ? "bg-coral text-ink" : "bg-card"
                  )}
                >
                  <span className="block text-[11px] font-semibold">{format(day, "EEEEEE", { locale: es })}</span>
                  <span className="block text-base font-extrabold leading-tight">{format(day, "d")}</span>
                </li>
              )
            })}
          </ol>

          <section className="rounded-2xl border-2 border-foreground bg-lime p-4 text-ink shadow-sm">
            <p className="text-sm font-bold">A pagar esta semana</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tighter">{mask(formatShort(toPayARS, "ARS"))}</p>
            {toPayUSD > 0 && <p className="text-lg font-extrabold">+ {mask(formatShort(toPayUSD, "USD"))}</p>}
            <p className="mt-2 font-mono text-[11px]">
              {toPay.length} {toPay.length === 1 ? "vencimiento" : "vencimientos"}
              {overdue > 0 && ` · ${overdue} ${overdue === 1 ? "vencido" : "vencidos"}`}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Button render={<Link href={ROUTES.dueItems.href} />} nativeButton={false} variant="outline">
              <CalendarClock />
              Vencimientos
            </Button>
            <Button render={<Link href={ROUTES.vehicles.href} />} nativeButton={false} variant="outline">
              <Car />
              Vehículos
            </Button>
          </div>
        </aside>

        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {groups.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-foreground/30 px-4 py-10 text-center">
              <p className="text-lg font-extrabold">Estás al día 🙌</p>
              <p className="mt-1 text-sm text-muted-foreground">Nada vence ni toca service en los próximos 30 días.</p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.title}>
                <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h2>
                <ul className="space-y-2.5">
                  {group.items.map((item) => (
                    <AgendaCard key={item.id} item={item} onPay={setPaying} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      <PayVencimientoModal open={paying !== null} onClose={() => setPaying(null)} item={paying} />
      <VencimientoSheet open={creating} onClose={() => setCreating(false)} item={null} />
    </div>
  )
}

function AgendaCard({ item, onPay }: { item: AgendaItem; onPay: (item: DueItem) => void }) {
  const { vehicles, getAccount } = useFinance()
  const { mask } = useUI()
  const vehicle = item.kind === "service" ? vehicles.find((v) => v.id === item.vehicleId) : undefined
  const account = item.kind === "due" && item.accountId ? getAccount(item.accountId) : undefined

  return (
    <li
      className={cn(
        "rounded-2xl border-2 border-foreground p-3.5",
        item.urgency === "overdue" ? "bg-coral/25" : "bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <IconTile Icon={agendaIcon(item, vehicle?.type)} className={agendaTone(item)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{item.title}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {agendaWhen(item)}
            {item.kind === "due" && ` · vence ${format(parseISO(item.date), "d/M")}`}
            {account && ` · ${account.name}`}
          </p>
        </div>
        {item.kind === "due" ? (
          <span className="shrink-0 font-mono text-sm font-semibold">{mask(formatShort(item.amount, item.currency))}</span>
        ) : item.kmLeft !== null ? (
          <Pill tone={item.urgency === "later" ? "plain" : "coral"}>
            {item.kmLeft <= 0 ? "ya toca" : `${item.kmLeft.toLocaleString("es-AR")} km`}
          </Pill>
        ) : null}
      </div>

      {item.kind === "service" && item.progress !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full border-[1.5px] border-foreground bg-background">
            <div className="h-full bg-foreground" style={{ width: `${item.progress * 100}%` }} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            vas {item.currentOdometer.toLocaleString("es-AR")} km · service a los{" "}
            {item.targetOdometer?.toLocaleString("es-AR")} km
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.kind === "due" ? (
          <Button size="sm" onClick={() => onPay(item.item)} className="bg-lime text-ink hover:bg-lime/80">
            {account ? `Pagar con ${account.name}` : "Pagar"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" render={<Link href={ROUTES.vehicles.href} />} nativeButton={false}>
            Anotar service o km
          </Button>
        )}
      </div>
    </li>
  )
}
