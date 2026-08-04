"use client"

import { useMemo } from "react"
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
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export function MoreView() {
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
    const nowTime = Date.now()
    
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
  }, [vehicles, vehicleLogs])

  const profitLossPercentVal = portfolioTotalProfitLossPercent || 0

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Explorar</h1>
      <p className="text-xs text-muted-foreground mt-0.5">
        Accedé a tus herramientas avanzadas y configuraciones de cuenta.
      </p>

      {/* Mini Profile Card Header */}
      <Link href="/profile" className="block mt-5">
        <Card className="w-full flex items-center justify-between p-4.5 hover:bg-accent/40 transition-all cursor-pointer group shadow-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {user?.name?.charAt(0) ?? "U"}
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-base font-bold text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Card>
      </Link>

      {/* Hub Options Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3.5">
        {/* Proyecciones Card */}
        <Link href="/dashboard/proyecciones" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm border-primary/30">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                <Target className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Proyección Financiera</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Simulador de patrimonio a 1-5 años con inflación y metas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px] font-bold">
                Nuevo
              </Badge>
              <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Card>
        </Link>
        {/* Vencimientos Card */}
        <Link href="/dashboard/vencimientos" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:scale-105 transition-transform">
                <CalendarClock className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Vencimientos y Servicios</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {pendingDueCount === 0
                    ? "Al día sin facturas pendientes"
                    : `${pendingDueCount} ${pendingDueCount === 1 ? "vencimiento pendiente" : "vencimientos pendientes"}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {pendingDueCount > 0 && (
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-bold">
                  {pendingDueCount}
                </Badge>
              )}
              <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Card>
        </Link>
        {/* Vehicles Card */}
        <Link href="/vehicles" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 group-hover:scale-105 transition-transform">
                <Bike className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Control Vehicular</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {vehicles.length === 0
                    ? "Cargá y controlá tus vehículos"
                    : `${vehicles.length} ${vehicles.length === 1 ? "vehículo registrado" : "vehículos registrados"}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {alertCount > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-bold animate-pulse">
                  <AlertTriangle className="size-3" />
                  {alertCount}
                </Badge>
              )}
              <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Card>
        </Link>

        {/* Portfolio Card */}
        <Link href="/stocks" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20 group-hover:scale-105 transition-transform">
                <LineChart className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Inversiones & Stocks</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {portfolioTotalValue > 0
                    ? `Valuación: ${formatShort(portfolioTotalValue, "USD")}`
                    : "Trading de acciones en tiempo real"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {portfolioTotalValue > 0 && (
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
              )}
              <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Card>
        </Link>

        {/* Activity Card */}
        <Link href="/activity" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <ReceiptText className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Historial de Movimientos</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {transactions.length === 0
                    ? "Sin movimientos registrados"
                    : `${transactions.length} movimientos cargados`}
                </p>
              </div>
            </div>
            <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Card>
        </Link>

        {/* Profile Details & Settings Card */}
        <Link href="/profile" className="block">
          <Card className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-all text-left cursor-pointer group shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-400 border border-slate-500/20 group-hover:scale-105 transition-transform">
                <User className="size-5.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Mi Perfil & Ajustes</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Categorías, notificaciones, seguridad y sesión.
                </p>
              </div>
            </div>
            <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Card>
        </Link>
      </div>

      <p className="mt-8 text-center text-[10px] text-muted-foreground tracking-wide font-medium uppercase">
        PLATA · Finanzas Personales v1.0
      </p>
    </div>
  )
}
