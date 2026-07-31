"use client"

import { useMemo } from "react"
import {
  Bike,
  LineChart,
  ReceiptText,
  User,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { formatShort } from "@/lib/finance-data"

export function MoreView({
  onNavigate,
}: {
  onNavigate: (view: "vehicles" | "stocks" | "activity" | "profile") => void
}) {
  const {
    user,
    vehicles,
    vehicleLogs,
    portfolioTotalValue,
    portfolioTotalProfitLoss,
    portfolioTotalProfitLossPercent,
    transactions
  } = useFinance()

  // Calculate active vehicle service alerts
  const alertCount = useMemo(() => {
    let count = 0
    const nowTime = Date.now()
    
    vehicles.forEach((vehicle) => {
      const logs = vehicleLogs.filter((l) => l.vehicleId === vehicle.id)
      logs.forEach((l) => {
        if (l.type === "service") {
          // Odometer-based alerts
          if (typeof l.nextServiceOdometer === "number") {
            const diff = l.nextServiceOdometer - vehicle.odometer
            if (diff <= 0) count++
          }
          // Date-based alerts
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

  const profitLossPercentVal = parseFloat(portfolioTotalProfitLossPercent) || 0

  return (
    <section className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Explorar</h1>
      <p className="text-xs text-muted-foreground mt-0.5">
        Accedé a tus herramientas avanzadas y configuraciones de cuenta.
      </p>

      {/* Mini Profile Card Header */}
      <button
        onClick={() => onNavigate("profile")}
        className="w-full mt-5 flex items-center justify-between gap-3.5 rounded-3xl border border-border bg-card/40 p-4.5 hover:bg-card/70 transition-all duration-200 cursor-pointer isolate relative overflow-hidden group"
      >
        <span
          aria-hidden
          className="absolute -right-8 -top-8 size-20 rounded-full bg-primary/10 opacity-30 blur-2xl group-hover:opacity-40 transition-opacity"
        />
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
      </button>

      {/* Hub Options Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3.5">
        {/* Vehicles Card */}
        <button
          onClick={() => onNavigate("vehicles")}
          className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-card/30 p-4 hover:bg-card/60 transition-all duration-200 text-left cursor-pointer isolate relative overflow-hidden group"
        >
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
              <span className="flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-500 animate-pulse">
                <AlertTriangle className="size-3" />
                {alertCount}
              </span>
            )}
            <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </button>

        {/* Portfolio Card */}
        <button
          onClick={() => onNavigate("stocks")}
          className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-card/30 p-4 hover:bg-card/60 transition-all duration-200 text-left cursor-pointer isolate relative overflow-hidden group"
        >
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
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  profitLossPercentVal >= 0
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                }`}
              >
                {profitLossPercentVal >= 0 ? (
                  <TrendingUp className="size-2.5" />
                ) : (
                  <TrendingDown className="size-2.5" />
                )}
                {profitLossPercentVal >= 0 ? "+" : ""}
                {portfolioTotalProfitLossPercent}%
              </span>
            )}
            <ChevronRight className="size-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </button>

        {/* Activity Card */}
        <button
          onClick={() => onNavigate("activity")}
          className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-card/30 p-4 hover:bg-card/60 transition-all duration-200 text-left cursor-pointer isolate relative overflow-hidden group"
        >
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
        </button>

        {/* Profile Details & Settings Card */}
        <button
          onClick={() => onNavigate("profile")}
          className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-card/30 p-4 hover:bg-card/60 transition-all duration-200 text-left cursor-pointer isolate relative overflow-hidden group"
        >
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
        </button>
      </div>

      <p className="mt-8 text-center text-[10px] text-muted-foreground tracking-wide font-medium uppercase">
        PLATA · Finanzas Personales v1.0
      </p>
    </section>
  )
}
