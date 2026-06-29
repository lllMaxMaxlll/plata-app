"use client"

import { useState, useMemo } from "react"
import { useFinance } from "./finance-provider"
import { AddVehicleSheet } from "./add-vehicle-sheet"
import { AddVehicleLogSheet } from "./add-vehicle-log-sheet"
import { formatCurrency, formatShort, type Vehicle, type VehicleLog, type VehicleLogType } from "@/lib/finance-data"
import {
  Bike,
  Car,
  Truck,
  Milestone,
  Plus,
  Edit2,
  Calendar,
  Gauge,
  Fuel,
  Wrench,
  WrenchIcon,
  ChevronRight,
  TrendingUp,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  Settings,
  ShoppingBag,
  ShieldAlert,
  Sparkles
} from "lucide-react"

const LOG_METADATA: Record<VehicleLogType, { label: string; Icon: any; color: string }> = {
  fuel: { label: "Combustible", Icon: Fuel, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  service: { label: "Service", Icon: Wrench, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  part: { label: "Repuesto", Icon: Settings, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  gear: { label: "Indumentaria", Icon: ShoppingBag, color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  insurance: { label: "Seguro/Patente", Icon: ShieldAlert, color: "text-red-500 bg-red-500/10 border-red-500/20" },
  other: { label: "Otro", Icon: Sparkles, color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
}

export function VehiclesView({ isDesktop = false }: { isDesktop?: boolean }) {
  const { vehicles, vehicleLogs, accounts } = useFinance()
  const [activeVehId, setActiveVehId] = useState<string>("")
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false)
  const [logSheetOpen, setLogSheetOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [editingLog, setEditingLog] = useState<VehicleLog | null>(null)

  // Filter logs states
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | VehicleLogType>("all")

  // Selected vehicle
  const activeVehicle = useMemo(() => {
    if (activeVehId) {
      return vehicles.find((v) => v.id === activeVehId) || vehicles[0]
    }
    return vehicles[0]
  }, [vehicles, activeVehId])

  // Set active vehicle ID on first load
  useMemo(() => {
    if (vehicles.length > 0 && !activeVehId) {
      setActiveVehId(vehicles[0].id)
    }
  }, [vehicles, activeVehId])

  // Filter logs for selected vehicle
  const activeLogs = useMemo(() => {
    if (!activeVehicle) return []
    return vehicleLogs.filter((l) => l.vehicleId === activeVehicle.id)
  }, [vehicleLogs, activeVehicle])

  // Filtered ledger list
  const filteredLogs = useMemo(() => {
    return activeLogs.filter((l) => {
      const matchesType = typeFilter === "all" || l.type === typeFilter
      const text = searchQuery.toLowerCase()
      let matchesText = true
      if (text.trim() !== "") {
        const noteMatch = l.note?.toLowerCase().includes(text) ?? false
        const gasStationMatch = l.gasStation?.toLowerCase().includes(text) ?? false
        const serviceMatch = l.serviceType?.toLowerCase().includes(text) ?? false
        const providerMatch = l.provider?.toLowerCase().includes(text) ?? false
        const itemMatch = l.itemName?.toLowerCase().includes(text) ?? false
        matchesText = noteMatch || gasStationMatch || serviceMatch || providerMatch || itemMatch
      }
      return matchesType && matchesText
    })
  }, [activeLogs, typeFilter, searchQuery])

  // Calculate statistics
  const stats = useMemo(() => {
    if (!activeVehicle || activeLogs.length === 0) {
      return {
        totalSpent: 0,
        spentByCurrency: { ARS: 0, USD: 0 },
        costByLogType: { fuel: 0, service: 0, part: 0, gear: 0, insurance: 0, other: 0 } as Record<VehicleLogType, number>,
        averageKmPerLiter: 0,
        lastKmPerLiter: 0,
        costPerKm: 0,
      }
    }

    let totalSpent = 0
    const costByLogType = { fuel: 0, service: 0, part: 0, gear: 0, insurance: 0, other: 0 } as Record<VehicleLogType, number>

    activeLogs.forEach((l) => {
      totalSpent += l.amount
      costByLogType[l.type] = (costByLogType[l.type] || 0) + l.amount
    })

    // Fuel consumption metrics
    const fuelLogs = [...activeLogs]
      .filter((l) => l.type === "fuel" && typeof l.liters === "number" && typeof l.odometer === "number")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let totalDistance = 0
    let totalLiters = 0
    let lastKmPerLiter = 0
    let prevFullTankLog: VehicleLog | null = null
    let accumulatedLiters = 0

    fuelLogs.forEach((current) => {
      if (current.isFullTank) {
        if (prevFullTankLog) {
          const distance = current.odometer - prevFullTankLog.odometer
          const litersConsumed = (current.liters || 0) + accumulatedLiters
          if (distance > 0 && litersConsumed > 0) {
            totalDistance += distance
            totalLiters += litersConsumed
            lastKmPerLiter = distance / litersConsumed
          }
        }
        prevFullTankLog = current
        accumulatedLiters = 0
      } else {
        accumulatedLiters += current.liters || 0
      }
    })

    const averageKmPerLiter = totalDistance > 0 && totalLiters > 0 ? totalDistance / totalLiters : 0

    // Cost per kilometer
    let costPerKm = 0
    if (activeLogs.length > 0) {
      const odometers = activeLogs.map((l) => l.odometer).filter((o) => o > 0)
      const minOdometer = odometers.length > 0 ? Math.min(...odometers, activeVehicle.odometer) : activeVehicle.odometer
      const odometerSpan = activeVehicle.odometer - minOdometer

      // If they logged expenses but haven't updated odometer span, divide by current odometer
      const span = odometerSpan > 0 ? odometerSpan : activeVehicle.odometer
      if (span > 0) {
        // Exclude gear (helmet, jacket) since it is personal equipment, not directly vehicle cost
        const directVehicleCost = totalSpent - costByLogType.gear
        costPerKm = directVehicleCost / span
      }
    }

    return {
      totalSpent,
      costByLogType,
      averageKmPerLiter,
      lastKmPerLiter,
      costPerKm,
    }
  }, [activeVehicle, activeLogs])

  // Alerts & Reminders logic
  const alerts = useMemo(() => {
    if (!activeVehicle) return []
    const list: { id: string; title: string; type: "critical" | "warning" | "info"; description: string }[] = []

    // 1. Check services based on odometer
    activeLogs
      .filter((l) => l.type === "service" && typeof l.nextServiceOdometer === "number")
      .forEach((l) => {
        const nextOdo = l.nextServiceOdometer!
        const diff = nextOdo - activeVehicle.odometer
        const label = l.serviceType || "Mantenimiento general"

        if (diff <= 0) {
          list.push({
            id: `odo-crit-${l.id}`,
            title: `Service Vencido: ${label}`,
            type: "critical",
            description: `Venció a los ${nextOdo} km. Tenés un exceso de ${Math.abs(diff)} km.`,
          })
        } else if (diff <= 300) {
          list.push({
            id: `odo-warn-${l.id}`,
            title: `Service Próximo: ${label}`,
            type: "warning",
            description: `Toca a los ${nextOdo} km. Faltan sólo ${diff} km.`,
          })
        }
      })

    // 2. Check services based on date
    const nowTime = Date.now()
    activeLogs
      .filter((l) => l.type === "service" && l.nextServiceDate)
      .forEach((l) => {
        const nextDate = new Date(l.nextServiceDate!)
        const diffDays = Math.ceil((nextDate.getTime() - nowTime) / (1000 * 60 * 60 * 24))
        const label = l.serviceType || "Mantenimiento general"

        if (diffDays <= 0) {
          list.push({
            id: `date-crit-${l.id}`,
            title: `Service Vencido (por fecha): ${label}`,
            type: "critical",
            description: `Venció el ${nextDate.toLocaleDateString("es-AR")}.`,
          })
        } else if (diffDays <= 15) {
          list.push({
            id: `date-warn-${l.id}`,
            title: `Service Próximo (por fecha): ${label}`,
            type: "warning",
            description: `Programado para el ${nextDate.toLocaleDateString("es-AR")} (en ${diffDays} días).`,
          })
        }
      })

    // Sort: critical first, then warning
    return list.sort((a, b) => {
      const map = { critical: 2, warning: 1, info: 0 }
      return map[b.type] - map[a.type]
    })
  }, [activeVehicle, activeLogs])

  function handleAddVehicle() {
    setEditingVehicle(null)
    setVehicleSheetOpen(true)
  }

  function handleEditVehicle(v: Vehicle, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingVehicle(v)
    setVehicleSheetOpen(true)
  }

  function handleAddLog() {
    setEditingLog(null)
    setLogSheetOpen(true)
  }

  function handleEditLog(l: VehicleLog) {
    setEditingLog(l)
    setLogSheetOpen(true)
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "motorcycle":
        return <Bike className="size-5" />
      case "car":
        return <Car className="size-5" />
      case "truck":
        return <Truck className="size-5" />
      default:
        return <Milestone className="size-5" />
    }
  }

  const formatLogDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
  }

  const maxLogSpent = Math.max(...Object.values(stats.costByLogType), 1)

  return (
    <div className={`flex flex-col gap-6 ${isDesktop ? "px-8 py-5" : "px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-24"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isDesktop ? "Mis Vehículos" : "Vehículos"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Llevá el control de tus gastos de nafta, mantenimientos y services.
          </p>
        </div>

        <button
          onClick={handleAddVehicle}
          className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95 px-3 py-2 rounded-xl transition-all cursor-pointer shadow-sm shadow-primary/10"
        >
          <Plus className="size-4" />
          Añadir vehículo
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="max-w-md mx-auto mt-12 text-center border border-border/40 rounded-3xl bg-card/30 p-8 flex flex-col items-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-inner">
            <Bike className="size-7" />
          </div>
          <h3 className="text-lg font-bold">No tenés vehículos agregados</h3>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Registrá tu primer vehículo para poder llevar un control detallado de su combustible, services, seguro y gastos.
          </p>
          <button
            onClick={handleAddVehicle}
            className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:scale-[1.01] transition-transform cursor-pointer"
          >
            Agregar mi primer vehículo
          </button>
        </div>
      ) : (
        <>
          {/* Selector de Vehículo Activo */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            {vehicles.map((v) => {
              const active = v.id === activeVehicle?.id
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveVehId(v.id)}
                  className={`flex items-center gap-2 shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:bg-card/70 hover:text-foreground"
                  }`}
                >
                  {getVehicleIcon(v.type)}
                  <span>{v.name}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground">
                    {v.odometer} Km
                  </span>
                  <span
                    onClick={(e) => handleEditVehicle(v, e)}
                    className="ml-1 p-0.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit2 className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>

          {activeVehicle && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left & Middle: Stats & Actions */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Stats Dashboard Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Kilometraje */}
                  <article className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm flex flex-col justify-between min-h-24">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Kilometraje</p>
                      <Gauge className="size-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight mt-2 tabular-nums">
                        {activeVehicle.odometer.toLocaleString("es-AR")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Kilómetros totales</p>
                    </div>
                  </article>

                  {/* Consumo Medio */}
                  <article className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm flex flex-col justify-between min-h-24">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Consumo Medio</p>
                      <Fuel className="size-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight mt-2 tabular-nums">
                        {stats.averageKmPerLiter > 0 ? `${stats.averageKmPerLiter.toFixed(2)} Km/L` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {stats.lastKmPerLiter > 0 ? `Última: ${stats.lastKmPerLiter.toFixed(1)} Km/L` : "Requiere 2 tanques llenos"}
                      </p>
                    </div>
                  </article>

                  {/* Costo por Kilómetro */}
                  <article className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm flex flex-col justify-between min-h-24">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Costo por Km</p>
                      <TrendingUp className="size-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight mt-2 tabular-nums">
                        {stats.costPerKm > 0 ? `$${stats.costPerKm.toFixed(1)}` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Gastos / kms recorridos</p>
                    </div>
                  </article>

                  {/* Gasto Total */}
                  <article className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm flex flex-col justify-between min-h-24">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Total Gastado</p>
                      <DollarSign className="size-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight mt-2 tabular-nums">
                        {formatShort(stats.totalSpent, "ARS")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Suma de bitácora</p>
                    </div>
                  </article>
                </div>

                {/* Alerts and Reminders section */}
                {alerts.length > 0 && (
                  <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wide">
                      <AlertTriangle className="size-4.5" />
                      Alertas de Mantenimiento y Services
                    </div>
                    <ul className="flex flex-col gap-2">
                      {alerts.map((al) => (
                        <li
                          key={al.id}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                            al.type === "critical"
                              ? "bg-red-500/10 text-red-500 border-red-500/20 font-medium"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}
                        >
                          <span className="font-semibold">{al.title}</span>
                          <span className="opacity-80">— {al.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Expense Chart Bar Graphic */}
                <section className="rounded-2xl border border-border/40 bg-card/45 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Distribución de Gastos
                  </h3>

                  {stats.totalSpent === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No hay gastos cargados en la bitácora.</p>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      {(Object.keys(stats.costByLogType) as VehicleLogType[]).map((t) => {
                        const amount = stats.costByLogType[t] || 0
                        if (amount === 0) return null
                        const percent = (amount / stats.totalSpent) * 100
                        const meta = LOG_METADATA[t]
                        return (
                          <li key={t} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className="flex items-center gap-2 font-semibold">
                                <span className={`size-2.5 rounded-full ${meta.color.split(" ")[0]}`} />
                                {meta.label}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {formatShort(amount, "ARS")} ({percent.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: "currentColor",
                                }}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Register Event Button & Ledger Header */}
                <div className="flex items-center justify-between border-b border-border/20 pb-3 mt-2">
                  <h3 className="text-sm font-bold">Historial de Bitácora</h3>
                  <button
                    onClick={handleAddLog}
                    className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="size-4" />
                    Registrar gasto / evento
                  </button>
                </div>

                {/* Search & Filter bar */}
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="flex-1 flex items-center gap-2 bg-card/45 border border-border/40 rounded-xl px-3 py-2.5 shadow-sm">
                    <Search className="size-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar en historial (YPF, aceite, casco...)"
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="size-3.5 text-muted-foreground shrink-0" />
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="appearance-none rounded-xl border border-border/40 bg-card/45 px-3 py-2 text-xs font-semibold outline-none focus:border-ring cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <option value="all">Todos los registros</option>
                      <option value="fuel">Sólo Combustible</option>
                      <option value="service">Sólo Services</option>
                      <option value="part">Sólo Repuestos</option>
                      <option value="gear">Sólo Indumentaria</option>
                      <option value="insurance">Sólo Seguro/Patente</option>
                      <option value="other">Otros registros</option>
                    </select>
                  </div>
                </div>

                {/* Ledger Log List */}
                <div className="border border-border/40 bg-card/25 rounded-2xl p-4 shadow-sm min-h-[300px]">
                  {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16">
                      <p className="text-xs font-semibold text-muted-foreground">
                        No se encontraron registros.
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">
                        Comenzá agregando un gasto con el botón superior o cambiá los términos de búsqueda.
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border/20">
                      {filteredLogs.map((l) => {
                        const meta = LOG_METADATA[l.type]
                        const details =
                          l.type === "fuel"
                            ? `${l.liters || 0} L · ${l.gasStation || "Carga nafta"}${l.isFullTank ? " · Tanque lleno" : ""}`
                            : l.type === "service"
                            ? `${l.serviceType || "Service"} · ${l.provider || "Taller"}`
                            : l.type === "part" || l.type === "gear"
                            ? `${l.itemName || "Compra"}`
                            : l.note || "Registro general"

                        return (
                          <li
                            key={l.id}
                            onClick={() => handleEditLog(l)}
                            className="flex cursor-pointer items-center justify-between gap-4 py-3.5 px-1 hover:bg-muted/15 rounded-xl transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl shadow-inner border ${meta.color}`}>
                                <meta.Icon className="size-4.5" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-foreground">
                                  {details}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {l.odometer} Km {l.note ? `· ${l.note}` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold tabular-nums text-foreground">
                                -{formatShort(l.amount, "ARS")}
                              </p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                {formatLogDate(l.date)}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right Column (Desktop): Mini Profile Info / Details */}
              <div className="hidden lg:flex flex-col gap-6">
                <article className="rounded-2xl border border-border/40 bg-card/40 p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {getVehicleIcon(activeVehicle.type)}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{activeVehicle.name}</h4>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{activeVehicle.brand} {activeVehicle.model}</p>
                    </div>
                  </div>

                  <div className="border-t border-border/20 pt-4 flex flex-col gap-2.5 text-xs">
                    {activeVehicle.plate && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Patente</span>
                        <span className="font-bold font-mono bg-muted px-2 py-0.5 rounded border border-border/40">{activeVehicle.plate}</span>
                      </div>
                    )}
                    {activeVehicle.year && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Año</span>
                        <span className="font-semibold">{activeVehicle.year}</span>
                      </div>
                    )}
                    {activeVehicle.fuelCapacity && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Capacidad Tanque</span>
                        <span className="font-semibold">{activeVehicle.fuelCapacity} Litros</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Agregado el</span>
                      <span className="font-semibold">{new Date(activeVehicle.createdAt).toLocaleDateString("es-AR")}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleEditVehicle(activeVehicle, e)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border hover:bg-muted/40 text-xs font-bold text-foreground transition-all cursor-pointer"
                  >
                    <Edit2 className="size-3.5" />
                    Editar Ficha del Vehículo
                  </button>
                </article>

                {/* Additional tip for fuel saving */}
                <article className="rounded-2xl border border-primary/10 bg-primary/5 p-4 flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wide">💡 Plata Tips: Ahorro en Nafta</h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Mantener la presión correcta en los neumáticos de tu moto reduce la fricción en el asfalto y puede mejorar el rendimiento de combustible hasta en un 3%. ¡Revisala cada 15 días!
                  </p>
                </article>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sheets */}
      <AddVehicleSheet
        open={vehicleSheetOpen}
        onClose={() => {
          setVehicleSheetOpen(false)
          setEditingVehicle(null)
        }}
        vehicle={editingVehicle}
      />

      {activeVehicle && (
        <AddVehicleLogSheet
          open={logSheetOpen}
          onClose={() => {
            setLogSheetOpen(false)
            setEditingLog(null)
          }}
          vehicle={activeVehicle}
          log={editingLog}
        />
      )}
    </div>
  )
}
