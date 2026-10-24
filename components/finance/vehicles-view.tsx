"use client"

import { useState, useMemo } from "react"
import { useFinance } from "./finance-provider"
import { Pagination, usePagination } from "./pagination"
import { AddVehicleSheet } from "./add-vehicle-sheet"
import { AddVehicleLogSheet } from "./add-vehicle-log-sheet"
import { formatShort, type Vehicle, type VehicleLog, type VehicleLogType } from "@/lib/finance-data"
import {
  Bike,
  Car,
  Truck,
  Milestone,
  Plus,
  Edit2,
  Fuel,
  Wrench,
  Search,
  AlertTriangle,
  Settings,
  ShoppingBag,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, clickableRowProps, focusRing } from "@/lib/utils"
import { PageHeader } from "./page-header"
import { IconTile, pageClass } from "./lucas-ui"

/** Nombre, ícono y color de cada tipo de registro. Los acentos llevan ícono en tinta. */
const LOGS_PAGE_SIZE = 15

const LOG_METADATA: Record<VehicleLogType, { label: string; Icon: LucideIcon; tone: string }> = {
  fuel: { label: "Nafta", Icon: Fuel, tone: "bg-lime" },
  service: { label: "Service", Icon: Wrench, tone: "bg-sky" },
  part: { label: "Repuesto", Icon: Settings, tone: "bg-grape" },
  gear: { label: "Indumentaria", Icon: ShoppingBag, tone: "bg-paper" },
  insurance: { label: "Seguro y patente", Icon: ShieldAlert, tone: "bg-coral" },
  other: { label: "Otro", Icon: Sparkles, tone: "bg-muted text-foreground" },
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint: string }) {
  return (
    <section className="min-w-0 rounded-2xl border-2 border-border bg-card p-3">
      <p className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-extrabold tracking-tight sm:text-xl">
        {value}
        {unit && <span className="ml-1 text-xs font-bold">{unit}</span>}
      </p>
      <p className="truncate font-mono text-[10px] text-muted-foreground">{hint}</p>
    </section>
  )
}

export function VehiclesView() {
  const { vehicles, vehicleLogs } = useFinance()
  const [activeVehId, setActiveVehId] = useState<string>("")
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false)
  const [logSheetOpen, setLogSheetOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [editingLog, setEditingLog] = useState<VehicleLog | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | VehicleLogType>("all")
  const [nowTime] = useState(() => Date.now())

  const activeVehicle = useMemo(() => {
    if (activeVehId) {
      return vehicles.find((v) => v.id === activeVehId) || vehicles[0]
    }
    return vehicles[0]
  }, [vehicles, activeVehId])

  const activeLogs = useMemo(() => {
    if (!activeVehicle) return []
    return vehicleLogs.filter((l) => l.vehicleId === activeVehicle.id)
  }, [vehicleLogs, activeVehicle])

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

  const { page, pageCount, pageItems: pageLogs, setPage } = usePagination(
    filteredLogs,
    LOGS_PAGE_SIZE,
    [activeVehicle?.id, typeFilter, searchQuery.trim()].join("|")
  )

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

    let costPerKm = 0
    if (activeLogs.length > 0) {
      const odometers = activeLogs.map((l) => l.odometer).filter((o) => o > 0)
      const minOdometer = odometers.length > 0 ? Math.min(...odometers, activeVehicle.odometer) : activeVehicle.odometer
      const odometerSpan = activeVehicle.odometer - minOdometer

      const span = odometerSpan > 0 ? odometerSpan : activeVehicle.odometer
      if (span > 0) {
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

  const alerts = useMemo(() => {
    if (!activeVehicle) return []
    const list: { id: string; title: string; type: "critical" | "warning" | "info"; description: string }[] = []

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

    return list.sort((a, b) => {
      const map = { critical: 2, warning: 1, info: 0 }
      return map[b.type] - map[a.type]
    })
  }, [activeVehicle, activeLogs, nowTime])

  function handleAddVehicle() {
    setEditingVehicle(null)
    setVehicleSheetOpen(true)
  }

  function handleEditVehicle(v: Vehicle) {
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

  const formatLogDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
  }

  const VehicleIcon = (type: string) =>
    type === "motorcycle" ? Bike : type === "car" ? Car : type === "truck" ? Truck : Milestone

  return (
    <div className={cn(pageClass, "space-y-6")}>
      <PageHeader
        route="vehicles"
        description="Nafta, services, seguro y cuánto te cuesta cada kilómetro."
        actions={
          vehicles.length > 0 && (
            <Button onClick={handleAddLog}>
              <Plus className="size-4" />
              Registro
            </Button>
          )
        }
      />

      {vehicles.length === 0 ? (
        <button
          type="button"
          onClick={handleAddVehicle}
          className="mx-auto mt-10 flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-sky/30"
        >
          <IconTile Icon={Car} className="bg-sky" />
          <span className="text-lg font-extrabold">Agregá tu primer vehículo</span>
          <span className="text-sm text-muted-foreground">
            Cargás la nafta y los services y te digo cuántos km/L hacés, cuánto te cuesta cada kilómetro y cuándo toca el próximo service.
          </span>
        </button>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            {vehicles.map((v) => {
              const active = v.id === activeVehicle?.id
              const Icon = VehicleIcon(v.type)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveVehId(v.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-2 border-border px-3.5 py-1.5 text-sm font-bold transition-colors",
                    active ? "bg-lime text-ink" : "bg-card hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />
                  {v.name}
                  <span className="font-mono text-[10px] font-semibold opacity-70">{v.odometer.toLocaleString("es-AR")} km</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={handleAddVehicle}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-2 border-dashed border-border px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Plus className="size-4" />
              Vehículo
            </button>
          </div>

          {activeVehicle && (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <aside className="space-y-3 lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1">
                <section className="rounded-3xl border-2 border-border bg-sky p-4 text-ink shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-extrabold tracking-tight">{activeVehicle.name}</p>
                      <p className="truncate text-xs">
                        {[activeVehicle.brand, activeVehicle.model, activeVehicle.year].filter(Boolean).join(" · ") || "Sin ficha"}
                      </p>
                    </div>
                    {activeVehicle.plate && (
                      <span className="shrink-0 rounded-md border-2 border-ink bg-white px-1.5 py-0.5 font-mono text-xs font-bold">
                        {activeVehicle.plate}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-[2.25rem] leading-none font-extrabold tracking-tighter">
                    {activeVehicle.odometer.toLocaleString("es-AR")} <span className="text-lg">km</span>
                  </p>
                  {activeVehicle.fuelCapacity && (
                    <p className="mt-1 font-mono text-[11px]">tanque de {activeVehicle.fuelCapacity} L</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditVehicle(activeVehicle)}
                    className="mt-3 border-ink bg-white text-ink"
                  >
                    <Edit2 />
                    Editar ficha
                  </Button>
                </section>

                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-2xl border-2 border-border p-3 text-sm",
                      al.type === "critical" ? "bg-coral text-ink" : "bg-card"
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="block font-bold">{al.title}</span>
                      <span className="block text-xs">{al.description}</span>
                    </span>
                  </div>
                ))}
              </aside>

              <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
                <div className="grid grid-cols-3 gap-2.5">
                  <Stat
                    label="Consumo"
                    value={stats.averageKmPerLiter > 0 ? `${stats.averageKmPerLiter.toFixed(1)}` : "—"}
                    unit={stats.averageKmPerLiter > 0 ? "km/L" : undefined}
                    hint={stats.lastKmPerLiter > 0 ? `último ${stats.lastKmPerLiter.toFixed(1)}` : "faltan 2 tanques llenos"}
                  />
                  <Stat
                    label="Por km"
                    value={stats.costPerKm > 0 ? formatShort(stats.costPerKm, "ARS") : "—"}
                    hint="gastos / km"
                  />
                  <Stat label="Total" value={formatShort(stats.totalSpent, "ARS")} hint="en la bitácora" />
                </div>

                <section className="rounded-2xl border-2 border-border bg-card p-4">
                  <h2 className="mb-3 text-base font-extrabold tracking-tight">En qué se va</h2>
                  {stats.totalSpent === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay gastos en la bitácora.</p>
                  ) : (
                    <>
                      <div className="flex h-6 overflow-hidden rounded-lg border-2 border-border">
                        {(Object.keys(stats.costByLogType) as VehicleLogType[])
                          .filter((t) => stats.costByLogType[t] > 0)
                          .map((t) => (
                            <span
                              key={t}
                              className={cn("h-full border-r-2 border-border last:border-r-0", LOG_METADATA[t].tone)}
                              style={{ width: `${(stats.costByLogType[t] / stats.totalSpent) * 100}%` }}
                            />
                          ))}
                      </div>
                      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        {(Object.keys(stats.costByLogType) as VehicleLogType[])
                          .filter((t) => stats.costByLogType[t] > 0)
                          .map((t) => (
                            <li key={t} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2">
                                <span className={cn("size-2.5 rounded-[3px] border-[1.5px] border-border", LOG_METADATA[t].tone)} />
                                {LOG_METADATA[t].label}
                              </span>
                              <span className="font-mono text-xs font-semibold">
                                {formatShort(stats.costByLogType[t], "ARS")} ·{" "}
                                {Math.round((stats.costByLogType[t] / stats.totalSpent) * 100)}%
                              </span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-base font-extrabold tracking-tight">Bitácora</h2>
                    <Button variant="outline" size="sm" onClick={handleAddLog}>
                      <Plus />
                      Registro
                    </Button>
                  </div>

                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar: YPF, aceite, casco…"
                      aria-label="Buscar en la bitácora"
                      className="h-10 w-full rounded-xl border-2 border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Tipo de registro">
                    {(["all", ...(Object.keys(LOG_METADATA) as VehicleLogType[])] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={typeFilter === t}
                        onClick={() => setTypeFilter(t)}
                        className={cn(
                          "shrink-0 cursor-pointer rounded-full border-2 border-border px-3 py-1 text-xs font-semibold transition-colors",
                          typeFilter === t ? "bg-lime text-ink" : "bg-card hover:bg-muted"
                        )}
                      >
                        {t === "all" ? "Todo" : LOG_METADATA[t].label}
                      </button>
                    ))}
                  </div>

                  {filteredLogs.length === 0 ? (
                    <p className="rounded-2xl border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                      {activeLogs.length === 0 ? "Cargá la primera nafta o el último service." : "Nada con ese filtro."}
                    </p>
                  ) : (
                    <ul className="rounded-2xl border-2 border-border bg-card px-3.5 divide-y-[1.5px] divide-dashed divide-foreground/15">
                      {pageLogs.map((l) => {
                        const meta = LOG_METADATA[l.type]
                        const details =
                          l.type === "fuel"
                            ? `${l.liters || 0} L · ${l.gasStation || "Nafta"}${l.isFullTank ? " · tanque lleno" : ""}`
                            : l.type === "service"
                              ? `${l.serviceType || "Service"}${l.provider ? ` · ${l.provider}` : ""}`
                              : l.itemName || l.note || meta.label
                        return (
                          <li
                            key={l.id}
                            {...clickableRowProps(() => handleEditLog(l), `Editar registro ${details}`)}
                            className={cn(
                              "-mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-lime/20",
                              focusRing
                            )}
                          >
                            <IconTile Icon={meta.Icon} className={meta.tone} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{details}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {meta.label} · {l.odometer.toLocaleString("es-AR")} km
                                {l.note && l.note !== l.itemName ? ` · ${l.note}` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono text-sm font-semibold">−{formatShort(l.amount, "ARS")}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{formatLogDate(l.date)}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-3" />
                </section>
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
