"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Bike,
  LineChart,
  ReceiptText,
  User,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Target,
  PieChart,
  ArrowLeftRight,
  Download,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { ROUTES } from "@/lib/routes"
import { useRouteSeen } from "@/lib/seen-routes"
import { formatShort } from "@/lib/finance-data"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PageHeader } from "./page-header"

export function MoreView() {
  const [nowTime] = useState(() => Date.now())
  const ui = useUI()
  const {
    user,
    vehicles,
    vehicleLogs,
    portfolioTotalValue,
    portfolioTotalProfitLossPercent,
    transactions,
    dueItems,
  } = useFinance()

  const pendingDueCount = useMemo(() => {
    return dueItems.filter((i) => i.status !== "paid").length
  }, [dueItems])

  const alertCount = useMemo(() => {
    let count = 0

    vehicles.forEach((vehicle) => {
      const logs = vehicleLogs.filter((l) => l.vehicleId === vehicle.id)
      logs.forEach((l) => {
        if (l.type === "service") {
          if (typeof l.nextServiceOdometer === "number") {
            const diff = l.nextServiceOdometer - vehicle.odometer
            if (diff <= 0) count++
          }
          if (l.nextServiceDate) {
            const nextDate = new Date(l.nextServiceDate)
            const diffDays = Math.ceil((nextDate.getTime() - nowTime) / (1000 * 60 * 60 * 24))
            if (diffDays <= 0) count++
          }
        }
      })
    })

    return count
  }, [vehicles, vehicleLogs, nowTime])

  const profitLossPercentVal = portfolioTotalProfitLossPercent || 0

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans">
      <PageHeader route="more" description="Tus herramientas avanzadas y la configuración de la cuenta." />

      {/* Perfil */}
      <Link href="/profile" className="mt-4 block">
        <Card className="flex w-full items-center justify-between gap-3 p-4 shadow-sm transition-colors hover:bg-accent/40 active:bg-accent/60">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {user?.name?.charAt(0) ?? "U"}
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-bold text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Card>
      </Link>

      {/* Acciones rápidas: lo que antes sólo existía en el sidebar de escritorio */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickAction Icon={Plus} label="Movimiento" onClick={ui.handleAddTransaction} />
        <QuickAction Icon={ArrowLeftRight} label="Cambio" onClick={ui.handleOpenExchange} />
        <QuickAction Icon={Download} label="Exportar" onClick={ui.handleOpenExport} />
      </div>

      <Section title="Análisis y planificación">
        <Row
          href={ROUTES.search.href}
          Icon={Search}
          tone="bg-primary/10 text-primary border-primary/20"
          title={ROUTES.search.label}
          description="Preguntá en tus palabras: “cuánto gasté en el auto el verano pasado”"
          isNew
        />
        <Row
          href={ROUTES.analytics.href}
          Icon={PieChart}
          tone="bg-success/10 text-success border-success/20"
          title={ROUTES.analytics.label}
          description="Gastos por categoría, tendencias y comparativas"
        />
        <Row
          href={ROUTES.projections.href}
          Icon={Target}
          tone="bg-chart-3/10 text-chart-3 border-chart-3/20"
          title={ROUTES.projections.label}
          description="Simulá tu patrimonio a 1-5 años con inflación y metas"
          isNew
        />
      </Section>

      <Section title="Activos y seguimiento">
        <Row
          href={ROUTES.dueItems.href}
          Icon={CalendarClock}
          tone="bg-chart-5/10 text-chart-5 border-chart-5/20"
          title={ROUTES.dueItems.label}
          description={
            pendingDueCount === 0
              ? "Al día, sin facturas pendientes"
              : `${pendingDueCount} ${pendingDueCount === 1 ? "vencimiento pendiente" : "vencimientos pendientes"}`
          }
          trailing={
            pendingDueCount > 0 ? (
              <Badge
                variant="secondary"
                className="border-chart-5/20 bg-chart-5/10 text-[11px] font-bold text-chart-5"
              >
                {pendingDueCount}
              </Badge>
            ) : null
          }
        />
        <Row
          href={ROUTES.stocks.href}
          Icon={LineChart}
          tone="bg-chart-3/10 text-chart-3 border-chart-3/20"
          title={ROUTES.stocks.label}
          description={
            portfolioTotalValue > 0
              ? `Valuación: ${ui.mask(formatShort(portfolioTotalValue, "USD"))}`
              : "Trading de acciones en tiempo real"
          }
          trailing={
            portfolioTotalValue > 0 ? (
              <Badge
                variant={profitLossPercentVal >= 0 ? "default" : "destructive"}
                className="flex items-center gap-0.5 text-[11px] font-bold"
              >
                {profitLossPercentVal >= 0 ? (
                  <TrendingUp className="size-2.5" />
                ) : (
                  <TrendingDown className="size-2.5" />
                )}
                {profitLossPercentVal >= 0 ? "+" : ""}
                {portfolioTotalProfitLossPercent}%
              </Badge>
            ) : null
          }
        />
        <Row
          href={ROUTES.vehicles.href}
          Icon={Bike}
          tone="bg-chart-2/10 text-chart-2 border-chart-2/20"
          title={ROUTES.vehicles.label}
          description={
            vehicles.length === 0
              ? "Cargá y controlá tus vehículos"
              : `${vehicles.length} ${vehicles.length === 1 ? "vehículo registrado" : "vehículos registrados"}`
          }
          trailing={
            alertCount > 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1 text-[11px] font-bold">
                <AlertTriangle className="size-3" />
                {alertCount}
              </Badge>
            ) : null
          }
        />
      </Section>

      <Section title="Cuenta">
        <Row
          href={ROUTES.activity.href}
          Icon={ReceiptText}
          tone="bg-chart-1/10 text-chart-1 border-chart-1/20"
          title={ROUTES.activity.label}
          description={
            transactions.length === 0
              ? "Sin movimientos registrados"
              : `${transactions.length} movimientos cargados`
          }
        />
        <Row
          href={ROUTES.profile.href}
          Icon={User}
          tone="bg-muted text-muted-foreground border-border"
          title={ROUTES.profile.label}
          description="Categorías, notificaciones, seguridad y sesión"
        />
      </Section>

      <p className="mt-8 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        PLATA · Finanzas Personales v1.0
      </p>
    </div>
  )
}

function QuickAction({
  Icon,
  label,
  onClick,
}: {
  Icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-auto flex-col gap-1.5 border-border bg-card/60 px-2 py-3 text-[11px] font-semibold text-foreground"
    >
      <Icon className="size-4.5 text-primary" />
      {label}
    </Button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <Card className="mt-2 gap-0 overflow-hidden p-0 shadow-sm">{children}</Card>
    </section>
  )
}

function Row({
  href,
  Icon,
  tone,
  title,
  description,
  trailing,
  isNew = false,
}: {
  href: string
  Icon: LucideIcon
  tone: string
  title: string
  description: string
  trailing?: React.ReactNode
  /** Muestra "Nuevo" hasta que el usuario abre la pantalla por primera vez. */
  isNew?: boolean
}) {
  const seen = useRouteSeen(href)
  const badge =
    isNew && !seen ? (
      <Badge variant="outline" className="border-primary/30 text-[11px] font-bold text-primary">
        Nuevo
      </Badge>
    ) : null

  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 border-b border-border/60 p-4 transition-colors last:border-b-0 hover:bg-accent/40 active:bg-accent/60"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
          tone
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing ?? badge}
        <ChevronRight className="size-4.5 text-muted-foreground" />
      </div>
    </Link>
  )
}
