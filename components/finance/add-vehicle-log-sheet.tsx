"use client"

import { useState } from "react"
import { format } from "date-fns"
import { vehicleDateValue, validateVehicleLogNumbers } from "@/lib/vehicle-maintenance"
import { parseDecimalInput, formatDecimalInput } from "@/lib/decimal-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateStringPicker } from "@/components/ui/date-picker"
import { Switch } from "@/components/ui/switch"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import type { Vehicle, VehicleLog, VehicleLogType } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { useConfirm } from "./confirm-dialog"
import { toast } from "sonner"
import { Fuel, Wrench, Settings, ShieldAlert, Sparkles, ShoppingBag, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { OptionSelect } from "./option-select"

const LOG_TYPES: { value: VehicleLogType; label: string; Icon: any; color: string }[] = [
  { value: "fuel", label: "Combustible", Icon: Fuel, color: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
  { value: "service", label: "Service", Icon: Wrench, color: "bg-chart-1/10 text-chart-1 border-chart-1/20" },
  { value: "part", label: "Repuesto", Icon: Settings, color: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  { value: "gear", label: "Indumentaria", Icon: ShoppingBag, color: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  { value: "insurance", label: "Seguro/Patente", Icon: ShieldAlert, color: "bg-destructive/10 text-destructive border-destructive/20" },
  { value: "other", label: "Otro", Icon: Sparkles, color: "bg-muted text-muted-foreground border-border" },
]

const GAS_STATIONS = ["YPF", "Shell", "Axion", "Puma", "Otro"]

export function AddVehicleLogSheet({
  open,
  onClose,
  vehicle,
  log,
  initialType = "fuel",
  serviceTemplate,
}: {
  open: boolean
  onClose: () => void
  vehicle: Vehicle
  log?: VehicleLog | null
  initialType?: VehicleLogType
  serviceTemplate?: VehicleLog
}) {
  const { addVehicleLog, updateVehicleLog, deleteVehicleLog, accounts } = useFinance()
  const confirm = useConfirm()

  const [type, setType] = useState<VehicleLogType>(log?.type ?? initialType)
  const [date, setDate] = useState(() => log ? vehicleDateValue(log.date) : format(new Date(), "yyyy-MM-dd"))
  const [odometer, setOdometer] = useState(String(log?.odometer ?? vehicle.odometer))
  const [amount, setAmount] = useState(log ? String(log.amount) : "")
  const [accountId, setAccountId] = useState<string>(log?.accountId ?? "")

  // Combustible
  const [liters, setLiters] = useState(log?.liters ? String(log.liters) : "")
  const [gasStation, setGasStation] = useState(log?.gasStation ? GAS_STATIONS.includes(log.gasStation) ? log.gasStation : "Otro" : "YPF")
  const [customGasStation, setCustomGasStation] = useState(log?.gasStation && !GAS_STATIONS.includes(log.gasStation) ? log.gasStation : "")
  const [isFullTank, setIsFullTank] = useState(log?.isFullTank ?? true)

  // Service
  const [serviceType, setServiceType] = useState(log?.serviceType ?? (initialType === "service" ? serviceTemplate?.serviceType : "") ?? "")
  const [provider, setProvider] = useState(log?.provider ?? (initialType === "service" ? serviceTemplate?.provider : "") ?? "")
  const [nextServiceOdometer, setNextServiceOdometer] = useState(log?.nextServiceOdometer ? String(log.nextServiceOdometer) : "")
  const [nextServiceDate, setNextServiceDate] = useState(log?.nextServiceDate ? vehicleDateValue(log.nextServiceDate) : "")

  // Repuestos / Indumentaria / Otro / Seguro
  const [logDetails, setLogDetails] = useState(log?.itemName ?? log?.note ?? "")

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let numbers: ReturnType<typeof validateVehicleLogNumbers>
    try {
      numbers = validateVehicleLogNumbers({ odometer, amount, liters, nextOdometer: nextServiceOdometer, type })
      if (!vehicleDateValue(date)) throw new Error("Elegí una fecha válida.")
      if (date > format(new Date(), "yyyy-MM-dd")) throw new Error("No se puede registrar un service o gasto futuro como realizado.")
      if (type === "service" && nextServiceDate && (!vehicleDateValue(nextServiceDate) || nextServiceDate <= date)) throw new Error("La fecha del próximo service debe ser posterior a la de este registro.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revisá los valores.")
      return
    }
    const parsedOdometer = numbers.odometer
    const parsedAmount = numbers.amount

    const selectedGasStation = gasStation === "Otro" ? customGasStation.trim() : gasStation

    setSubmitting(true)
    try {
      const data: Omit<VehicleLog, "id"> = {
        vehicleId: vehicle.id,
        type,
        date: new Date(`${date}T12:00:00`).toISOString(),
        odometer: parsedOdometer,
        amount: parsedAmount,
        accountId: accountId || undefined,
      }

      if (type === "fuel") {
        data.liters = numbers.liters
        data.gasStation = selectedGasStation || undefined
        data.isFullTank = isFullTank
        if (data.liters && parsedAmount > 0) {
          data.pricePerLiter = Number((parsedAmount / data.liters).toFixed(2))
        }
        data.itemName = undefined
        data.note = log?.note
      } else if (type === "service") {
        data.serviceType = serviceType.trim() || undefined
        data.provider = provider.trim() || undefined
        data.nextServiceOdometer = numbers.nextOdometer
        data.nextServiceDate = nextServiceDate || undefined
        data.itemName = undefined
        data.note = log?.note
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
      await new Promise((resolve) => setTimeout(resolve, 350))
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
    const confirmed = await confirm({
      title: "¿Eliminar este registro?",
      description: "Si estaba vinculado a una cuenta, el importe vuelve a su saldo.",
    })
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteVehicleLog(log.id)
      toast.success("Registro eliminado correctamente.")
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error("Error al eliminar el registro.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <ResponsiveDialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <ResponsiveDialogHeader className="text-left pb-1">
          <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            {log ? "Editar registro" : initialType === "service" ? "Registrar service realizado" : "Nuevo registro"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs text-muted-foreground">
            {log ? "Modificá los detalles del registro" : initialType === "service" ? `Registrá lo que ya hiciste en ${vehicle.name} y definí el próximo service. No se guarda hasta confirmar.` : `Registrar evento para ${vehicle.name}`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
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
                    <span className="text-[11px]">{t.label}</span>
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
              <DateStringPicker
                id="log-date"
                required
                value={date}
                onChange={setDate}
                displayFormat="dd MMM yyyy"
                endMonth={new Date()}
                disabledDates={{ after: new Date() }}
              />
            </div>

            {/* Odometer */}
            <div className="space-y-1.5">
              <Label htmlFor="log-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Kilometraje del registro (km)
              </Label>
              <Input
                id="log-odo"
                type="number"
                required
                min="0"
                step="1"
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
                    type="text"
                    inputMode="decimal"
                    value={formatDecimalInput(liters)}
                    onChange={(e) => setLiters(parseDecimalInput(e.target.value))}
                    placeholder="Ej. 10.5"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Estación de Servicio
                  </Label>
                  <OptionSelect
                    ariaLabel="Estación de servicio"
                    value={gasStation}
                    onValueChange={setGasStation}
                    options={GAS_STATIONS.map((st) => ({ value: st, label: st }))}
                  />
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
                    placeholder="Mayor al kilometraje del registro"
                    min={Number(odometer) + 1}
                    step="1"
                    className="h-10 text-sm rounded-xl border-border bg-card/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="next-service-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Próximo Service (Fecha)
                  </Label>
                  <DateStringPicker
                    id="next-service-date"
                    value={nextServiceDate}
                    onChange={setNextServiceDate}
                    placeholder="Seleccionar"
                    displayFormat="dd MMM yyyy"
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
                Costo total ({accounts.find(a => a.id === accountId)?.currency ?? "ARS"})
              </Label>
              <Input
                id="log-amount"
                type="text"
                inputMode="decimal"
                value={formatDecimalInput(amount)}
                onChange={(e) => setAmount(parseDecimalInput(e.target.value))}
                placeholder="0.00"
                className="h-10 text-sm font-semibold rounded-xl border-border bg-card/60"
              />
            </div>

            {/* Sincronización con cuenta */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pagar desde cuenta
              </Label>
              <OptionSelect
                ariaLabel="Cuenta a descontar"
                value={accountId || "none"}
                onValueChange={(v) => setAccountId(v === "none" ? "" : v)}
                options={[
                  { value: "none", label: "No descontar (solo registrar)" },
                  ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
                ]}
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-2 flex flex-col gap-2">
            <Button
              type="submit"
              size="lg"
              className="w-full h-11 font-semibold"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {log ? "Guardando..." : "Guardando..."}
                </>
              ) : log ? (
                "Guardar cambios"
              ) : (
                type === "service" ? "Guardar service realizado" : "Registrar evento"
              )}
            </Button>

            {log && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full h-11"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar registro"
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
