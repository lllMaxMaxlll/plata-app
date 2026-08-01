"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { Vehicle, VehicleLog, VehicleLogType } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { Fuel, Wrench, Settings, ShieldAlert, Sparkles, ShoppingBag } from "lucide-react"

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
  const [accountId, setAccountId] = useState<string>("")

  // Combustible
  const [liters, setLiters] = useState("")
  const [gasStation, setGasStation] = useState("YPF")
  const [customGasStation, setCustomGasStation] = useState("")
  const [isFullTank, setIsFullTank] = useState(true)

  // Service
  const [serviceType, setServiceType] = useState("")
  const [provider, setProvider] = useState("")
  const [nextServiceOdometer, setNextServiceOdometer] = useState("")
  const [nextServiceDate, setNextServiceDate] = useState("")

  // Repuestos / Indumentaria / Otro / Seguro
  const [logDetails, setLogDetails] = useState("")

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (log) {
        setType(log.type)
        setDate(log.date ? new Date(log.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
        setOdometer(String(log.odometer))
        setAmount(String(log.amount))
        setAccountId(log.accountId || "")

        if (log.type === "fuel") {
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
        } else if (log.type === "service") {
          setServiceType(log.serviceType || "")
          setProvider(log.provider || "")
          setNextServiceOdometer(log.nextServiceOdometer ? String(log.nextServiceOdometer) : "")
          setNextServiceDate(
            log.nextServiceDate ? new Date(log.nextServiceDate).toISOString().split("T")[0] : ""
          )
        } else {
          setLogDetails(log.itemName || log.note || "")
        }
      } else {
        setType("fuel")
        setDate(new Date().toISOString().split("T")[0])
        setOdometer(vehicle ? String(vehicle.odometer) : "0")
        setAmount("")
        setAccountId("")
        setLiters("")
        setGasStation("YPF")
        setCustomGasStation("")
        setIsFullTank(true)
        setServiceType("")
        setProvider("")
        setNextServiceOdometer("")
        setNextServiceDate("")
        setLogDetails("")
      }
    }
  }, [open, log, vehicle])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedOdometer = parseInt(odometer)
    if (isNaN(parsedOdometer) || parsedOdometer < 0) {
      toast.error("Ingresá un kilometraje válido.")
      return
    }

    const parsedAmount = parseFloat(amount) || 0

    const selectedGasStation = gasStation === "Otro" ? customGasStation.trim() : gasStation

    setSubmitting(true)
    try {
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg w-full rounded-3xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            {log ? "Editar Registro" : "Nuevo Registro"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {log ? "Modificá los detalles del registro" : `Registrar evento para ${vehicle.name}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          {/* Selector de Tipo de Gasto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Categoría del Registro
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {LOG_TYPES.map((t) => {
                const active = type === t.value
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    onClick={() => setType(t.value)}
                    className="flex h-12 flex-col items-center justify-center gap-1 p-1 rounded-xl cursor-pointer"
                  >
                    <t.Icon className="size-4" />
                    <span className="text-[10px]">{t.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Fecha */}
            <div className="space-y-1.5">
              <Label htmlFor="log-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fecha
              </Label>
              <Input
                id="log-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 text-sm rounded-xl border-border bg-card/60"
              />
            </div>

            {/* Odometer */}
            <div className="space-y-1.5">
              <Label htmlFor="log-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Kilometraje Actual (Km)
              </Label>
              <Input
                id="log-odo"
                type="number"
                required
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="h-10 text-sm rounded-xl border-border bg-card/60"
              />
            </div>
          </div>

          {/* Formulario según Tipo de Gasto */}
          {type === "fuel" && (
            <div className="space-y-3.5 rounded-2xl border border-border/40 bg-card/40 p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fuel-liters" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Litros cargados
                  </Label>
                  <Input
                    id="fuel-liters"
                    type="number"
                    step="any"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    placeholder="Ej. 10.5"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Estación de Servicio
                  </Label>
                  <select
                    value={gasStation}
                    onChange={(e) => setGasStation(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-card/60 px-3 text-sm"
                  >
                    {GAS_STATIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {gasStation === "Otro" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fuel-custom-station" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Nombre de la estación
                  </Label>
                  <Input
                    id="fuel-custom-station"
                    type="text"
                    value={customGasStation}
                    onChange={(e) => setCustomGasStation(e.target.value)}
                    placeholder="Ej. Gulf, Dapsa"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-foreground">¿Tanque lleno?</span>
                <Switch checked={isFullTank} onCheckedChange={setIsFullTank} />
              </div>
            </div>
          )}

          {type === "service" && (
            <div className="space-y-3.5 rounded-2xl border border-border/40 bg-card/40 p-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="service-type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tipo de Service
                  </Label>
                  <Input
                    id="service-type"
                    type="text"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    placeholder="Ej. Cambio de Aceite y Filtro"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="service-provider" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Taller / Mecánico
                  </Label>
                  <Input
                    id="service-provider"
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="Ej. Taller Oficial"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="next-service-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Próximo Service (Km)
                  </Label>
                  <Input
                    id="next-service-odo"
                    type="number"
                    value={nextServiceOdometer}
                    onChange={(e) => setNextServiceOdometer(e.target.value)}
                    placeholder="Ej. 6000"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="next-service-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Próximo Service (Fecha)
                  </Label>
                  <Input
                    id="next-service-date"
                    type="date"
                    value={nextServiceDate}
                    onChange={(e) => setNextServiceDate(e.target.value)}
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>
              </div>
            </div>
          )}

          {(type === "part" || type === "gear" || type === "insurance" || type === "other") && (
            <div className="space-y-1.5">
              <Label htmlFor="log-details" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Detalle / Descripción
              </Label>
              <Input
                id="log-details"
                type="text"
                value={logDetails}
                onChange={(e) => setLogDetails(e.target.value)}
                placeholder={
                  type === "part"
                    ? "Ej. Pastillas de freno, Transmisión"
                    : type === "gear"
                    ? "Ej. Casco, Guantes, Campera"
                    : type === "insurance"
                    ? "Ej. Cuota Seguro / Patente ARBA"
                    : "Detalle del gasto"
                }
                className="h-10 text-sm rounded-xl border-border bg-card/60"
              />
            </div>
          )}

          {/* Costo y cuenta */}
          <div className="space-y-3 rounded-2xl border border-border/40 bg-card/40 p-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="log-amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Costo Total ($)
              </Label>
              <Input
                id="log-amount"
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 text-sm font-semibold rounded-xl border-border bg-card/60"
              />
            </div>

            {/* Sincronización con cuenta */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pagar desde cuenta
              </Label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card/60 px-3 text-sm"
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
          <div className="mt-2 flex flex-col gap-2">
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-xl h-11 font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer"
              disabled={submitting}
            >
              {log ? "Guardar cambios" : "Registrar evento"}
            </Button>

            {log && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full rounded-xl h-11 cursor-pointer"
                onClick={handleDelete}
                disabled={submitting}
              >
                Eliminar registro
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
