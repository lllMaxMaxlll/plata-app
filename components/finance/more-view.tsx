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
  type LucideIcon,
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { formatShort } from "@/lib/finance-data"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Explorar</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Tus herramientas avanzadas y la configuración de la cuenta.
        </p>
      </header>

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
          href="/analytics"
          Icon={PieChart}
          tone="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          title="Análisis & Métricas"
          description="Gastos por categoría, tendencias y comparativas"
        />
        <Row
          href="/dashboard/proyecciones"
          Icon={Target}
          tone="bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          title="Proyección Financiera"
          description="Simulá tu patrimonio a 1-5 años con inflación y metas"
          trailing={
            <Badge variant="outline" className="border-cyan-500/30 text-[10px] font-bold text-cyan-400">
              Nuevo
            </Badge>
          }
        />
      </Section>

      <Section title="Activos y seguimiento">
        <Row
          href="/dashboard/vencimientos"
          Icon={CalendarClock}
          tone="bg-purple-500/10 text-purple-500 border-purple-500/20"
          title="Vencimientos y Servicios"
          description={
            pendingDueCount === 0
              ? "Al día, sin facturas pendientes"
              : `${pendingDueCount} ${pendingDueCount === 1 ? "vencimiento pendiente" : "vencimientos pendientes"}`
          }
          trailing={
            pendingDueCount > 0 ? (
              <Badge
                variant="secondary"
                className="border-purple-500/20 bg-purple-500/10 text-[10px] font-bold text-purple-400"
              >
                {pendingDueCount}
              </Badge>
            ) : null
          }
        />
        <Row
          href="/stocks"
          Icon={LineChart}
          tone="bg-teal-500/10 text-teal-500 border-teal-500/20"
          title="Inversiones & Stocks"
          description={
            portfolioTotalValue > 0
              ? `Valuación: ${formatShort(portfolioTotalValue, "USD")}`
              : "Trading de acciones en tiempo real"
          }
          trailing={
            portfolioTotalValue > 0 ? (
              <Badge
                variant={profitLossPercentVal >= 0 ? "default" : "destructive"}
                className="flex items-center gap-0.5 text-[10px] font-bold"
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
          href="/vehicles"
          Icon={Bike}
          tone="bg-orange-500/10 text-orange-500 border-orange-500/20"
          title="Control Vehicular"
          description={
            vehicles.length === 0
              ? "Cargá y controlá tus vehículos"
              : `${vehicles.length} ${vehicles.length === 1 ? "vehículo registrado" : "vehículos registrados"}`
          }
          trailing={
            alertCount > 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-bold">
                <AlertTriangle className="size-3" />
                {alertCount}
              </Badge>
            ) : null
          }
        />
      </Section>

      <Section title="Cuenta">
        <Row
          href="/activity"
          Icon={ReceiptText}
          tone="bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
          title="Historial de Movimientos"
          description={
            transactions.length === 0
              ? "Sin movimientos registrados"
              : `${transactions.length} movimientos cargados`
          }
        />
        <Row
          href="/profile"
          Icon={User}
          tone="bg-slate-500/10 text-slate-400 border-slate-500/20"
          title="Perfil & Ajustes"
          description="Categorías, notificaciones, seguridad y sesión"
        />
      </Section>

      <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
      className="h-auto flex-col gap-1.5 rounded-2xl border-border bg-card/60 px-2 py-3 text-[11px] font-semibold text-foreground"
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
}: {
  href: string
  Icon: LucideIcon
  tone: string
  title: string
  description: string
  trailing?: React.ReactNode
}) {
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
        {trailing}
        <ChevronRight className="size-4.5 text-muted-foreground" />
      </div>
    </Link>
  )
}
