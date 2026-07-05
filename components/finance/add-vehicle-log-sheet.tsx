"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Vehicle, VehicleLog, VehicleLogType } from "@/lib/finance-data"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { Fuel, Wrench, Settings, ShieldAlert, Sparkles, ShoppingBag, Eye } from "lucide-react"

const LOG_TYPES: { value: VehicleLogType; label: string; Icon: any; color: string }[] = [
  { value: "fuel", label: "Combustible", Icon: Fuel, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { value: "service", label: "Service", Icon: Wrench, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "part", label: "Repuesto", Icon: Settings, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "gear", label: "Indumentaria", Icon: ShoppingBag, color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { value: "insurance", label: "Seguro/Patente", Icon: ShieldAlert, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { value: "other", label: "Otro", Icon: Sparkles, color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
]

const GAS_STATIONS = ["YPF", "Shell", "Axion", "Puma", "Otro"]

export function AddVehicleLogSheet({
  open,
  onClose,
  vehicle,
  log,
}: {
  open: boolean
  onClose: () => void
  vehicle: Vehicle
  log?: VehicleLog | null
}) {
  const { addVehicleLog, updateVehicleLog, deleteVehicleLog, accounts } = useFinance()

  const [type, setType] = useState<VehicleLogType>("fuel")
  const [date, setDate] = useState("")
  const [odometer, setOdometer] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [accountId, setAccountId] = useState("")

  // Fuel specific
  const [liters, setLiters] = useState("")
  const [gasStation, setGasStation] = useState("YPF")
  const [customGasStation, setCustomGasStation] = useState("")
  const [isFullTank, setIsFullTank] = useState(true)

  // Service specific
  const [serviceType, setServiceType] = useState("")
  const [provider, setProvider] = useState("")
  const [nextServiceOdometer, setNextServiceOdometer] = useState("")
  const [nextServiceDate, setNextServiceDate] = useState("")

  // Part / Gear
  const [itemName, setItemName] = useState("")

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (log) {
        setType(log.type)
        setDate(log.date ? log.date.split("T")[0] : new Date().toISOString().split("T")[0])
        setOdometer(String(log.odometer))
        setAmount(String(log.amount))
        setNote(log.note || "")
        setAccountId(log.accountId || "")

        // Fuel
        setLiters(log.liters ? String(log.liters) : "")
        if (log.gasStation && GAS_STATIONS.includes(log.gasStation)) {
          setGasStation(log.gasStation)
          setCustomGasStation("")
        } else if (log.gasStation) {
          setGasStation("Otro")
          setCustomGasStation(log.gasStation)
        } else {
          setGasStation("YPF")
          setCustomGasStation("")
        }
        setIsFullTank(log.isFullTank ?? true)

        // Service
        setServiceType(log.serviceType || "")
        setProvider(log.provider || "")
        setNextServiceOdometer(log.nextServiceOdometer ? String(log.nextServiceOdometer) : "")
        setNextServiceDate(log.nextServiceDate ? log.nextServiceDate.split("T")[0] : "")

        // Item
        setItemName(log.itemName || log.note || "")
      } else {
        setType("fuel")
        setDate(new Date().toISOString().split("T")[0])
        setOdometer(String(vehicle.odometer))
        setAmount("")
        setNote("")
        setAccountId("")

        // Fuel
        setLiters("")
        setGasStation("YPF")
        setCustomGasStation("")
        setIsFullTank(true)

        // Service
        setServiceType("")
        setProvider("")
        setNextServiceOdometer("")
        setNextServiceDate("")

        // Item
        setItemName("")
      }
    }
  }, [log, open, vehicle])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = Math.round((parseFloat(amount) || 0) * 100) / 100
    const parsedOdometer = parseInt(odometer) || 0

    if (parsedOdometer < 0) {
      toast.error("El kilometraje no puede ser menor a 0.")
      return
    }

    setSubmitting(true)
    try {
      const selectedGasStation = gasStation === "Otro" ? customGasStation.trim() : gasStation

      const logDetails = itemName.trim()

      const data: any = {
        vehicleId: vehicle.id,
        type,
        date: new Date(date).toISOString(),
        odometer: parsedOdometer,
        amount: parsedAmount,
        accountId: accountId || undefined,
      }

      if (type === "fuel") {
        data.liters = liters ? parseFloat(liters) || undefined : undefined
        data.gasStation = selectedGasStation || undefined
        data.isFullTank = isFullTank
        if (data.liters && parsedAmount > 0) {
          data.pricePerLiter = Number((parsedAmount / data.liters).toFixed(2))
        }
        data.itemName = undefined
        data.note = undefined
      } else if (type === "service") {
        data.serviceType = serviceType.trim() || undefined
        data.provider = provider.trim() || undefined
        data.nextServiceOdometer = nextServiceOdometer ? parseInt(nextServiceOdometer) || undefined : undefined
        data.nextServiceDate = nextServiceDate ? new Date(nextServiceDate).toISOString() : undefined
        data.itemName = undefined
        data.note = undefined
      } else if (type === "part" || type === "gear" || type === "insurance" || type === "other") {
        data.itemName = logDetails || undefined
        data.note = logDetails || undefined
      }

      if (log) {
        await updateVehicleLog(log.id, data)
        toast.success("Registro actualizado con éxito.")
      } else {
        await addVehicleLog(data)
        toast.success("Registro guardado con éxito.")
      }
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar el registro.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!log) return
    const confirmed = window.confirm(
      "¿Estás seguro de que querés eliminar este registro?\n(Si estaba vinculado a una cuenta, se devolverá el dinero a su saldo)"
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteVehicleLog(log.id)
      toast.success("Registro eliminado correctamente.")
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error("Error al eliminar el registro.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={log ? "Editar Registro" : "Nuevo Registro"}
      description={log ? "Modificá los detalles del registro" : `Registrar evento para ${vehicle.name}`}
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* Selector de Tipo de Gasto */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Categoría del Registro
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LOG_TYPES.map((t) => {
              const active = type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-1.5 rounded-xl border p-2.5 transition-all text-xs font-medium cursor-pointer ${
                    active ? t.color + " border-current shadow-inner" : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <t.Icon className="size-4 shrink-0" />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Campos Dinámicos por Categoría */}

        {/* COMBUSTIBLE */}
        {type === "fuel" && (
          <div className="flex flex-col gap-4 border-l-2 border-orange-500/35 pl-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fuel-liters" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Litros Cargados
                </label>
                <input
                  id="fuel-liters"
                  type="number"
                  step="any"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder="Ej. 10.5"
                  className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between mt-6 bg-muted/10 border border-border rounded-xl px-3 h-11">
                <span className="text-xs font-semibold text-foreground">¿Tanque Lleno?</span>
                <button
                  type="button"
                  onClick={() => setIsFullTank(!isFullTank)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isFullTank ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isFullTank ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Estación de Carga
                </label>
                <select
                  value={gasStation}
                  onChange={(e) => setGasStation(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                >
                  {GAS_STATIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {gasStation === "Otro" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fuel-custom-station" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    ¿Cuál?
                  </label>
                  <input
                    id="fuel-custom-station"
                    type="text"
                    value={customGasStation}
                    onChange={(e) => setCustomGasStation(e.target.value)}
                    placeholder="Ej. Sol"
                    className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* SERVICE */}
        {type === "service" && (
          <div className="flex flex-col gap-4 border-l-2 border-blue-500/35 pl-3 py-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="svc-type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tipo de Service
              </label>
              <input
                id="svc-type"
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="Ej. Cambio de Aceite y Filtro, Transmisión"
                className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="svc-prov" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Taller / Proveedor
              </label>
              <input
                id="svc-prov"
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej. Taller Honda Oficial, Mecánico del barrio"
                className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="svc-next-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Próx. Service (Km)
                </label>
                <input
                  id="svc-next-odo"
                  type="number"
                  value={nextServiceOdometer}
                  onChange={(e) => setNextServiceOdometer(e.target.value)}
                  placeholder="Ej. 7000"
                  className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="svc-next-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Próx. Service (Fecha)
                </label>
                <input
                  id="svc-next-date"
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* REPUESTOS / INDUMENTARIA / SEGURO / OTROS */}
        {(type === "part" || type === "gear" || type === "insurance" || type === "other") && (
          <div className="flex flex-col gap-4 border-l-2 border-purple-500/35 pl-3 py-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="item-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Artículo / Detalle
              </label>
              <input
                id="item-name"
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={
                  type === "part" ? "Ej. Cubierta delantera, Bujía NGK" :
                  type === "gear" ? "Ej. Casco LS2, Guantes de cuero" :
                  type === "insurance" ? "Ej. Cuota Seguro ATM, Patente 03/26" :
                  "Ej. Peajes, Multa, Estacionamiento"
                }
                className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* CAMPOS COMUNES */}

        <div className="grid grid-cols-2 gap-3">
          {/* Fecha */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fecha
            </label>
            <input
              id="log-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Kilometraje */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Kilometraje (Km)
            </label>
            <input
              id="log-odo"
              type="number"
              required
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder={`Km actual: ${vehicle.odometer}`}
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Monto Gastado */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-cost" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Costo total
            </label>
            <input
              id="log-cost"
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej. 12000"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Sincronización con cuenta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pagar desde
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">No descontar (Solo registrar)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        </div>


        {/* Botones de acción */}
        <div className="mt-4 flex flex-col gap-2">
          <Button type="submit" size="lg" className="w-full rounded-xl h-12" disabled={submitting}>
            {log ? "Guardar cambios" : "Registrar evento"}
          </Button>

          {log && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full rounded-xl h-12 shadow-sm"
              onClick={handleDelete}
              disabled={submitting}
            >
              Eliminar registro
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  )
}
