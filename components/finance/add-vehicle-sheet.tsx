"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Vehicle, VehicleType } from "@/lib/finance-data"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { Bike, Car, Truck, Milestone } from "lucide-react"

const TYPES: { value: VehicleType; label: string; Icon: any }[] = [
  { value: "motorcycle", label: "Moto", Icon: Bike },
  { value: "car", label: "Auto", Icon: Car },
  { value: "truck", label: "Camioneta/Camión", Icon: Truck },
  { value: "other", label: "Otro", Icon: Milestone },
]

export function AddVehicleSheet({
  open,
  onClose,
  vehicle,
}: {
  open: boolean
  onClose: () => void
  vehicle?: Vehicle | null
}) {
  const { addVehicle, updateVehicle, deleteVehicle } = useFinance()
  const [name, setName] = useState("")
  const [type, setType] = useState<VehicleType>("motorcycle")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [plate, setPlate] = useState("")
  const [odometer, setOdometer] = useState("")
  const [fuelCapacity, setFuelCapacity] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (vehicle) {
        setName(vehicle.name)
        setType(vehicle.type)
        setBrand(vehicle.brand || "")
        setModel(vehicle.model || "")
        setYear(vehicle.year ? String(vehicle.year) : "")
        setPlate(vehicle.plate || "")
        setOdometer(String(vehicle.odometer))
        setFuelCapacity(vehicle.fuelCapacity ? String(vehicle.fuelCapacity) : "")
      } else {
        setName("")
        setType("motorcycle")
        setBrand("")
        setModel("")
        setYear("")
        setPlate("")
        setOdometer("0")
        setFuelCapacity("")
      }
    }
  }, [vehicle, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("El nombre del vehículo es requerido.")
      return
    }

    setSubmitting(true)
    try {
      const parsedOdo = parseInt(odometer) || 0
      const parsedYear = year ? parseInt(year) || undefined : undefined
      const parsedCap = fuelCapacity ? parseFloat(fuelCapacity) || undefined : undefined

      const data = {
        name: name.trim(),
        type,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        year: parsedYear,
        plate: plate.trim().toUpperCase() || undefined,
        odometer: parsedOdo,
        fuelCapacity: parsedCap,
      }

      if (vehicle) {
        await updateVehicle(vehicle.id, data)
        toast.success(`Vehículo "${name.trim()}" modificado con éxito.`)
      } else {
        await addVehicle(data)
        toast.success(`Vehículo "${name.trim()}" agregado con éxito.`)
      }
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar el vehículo.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!vehicle) return
    const confirmed = window.confirm(
      `¿Estás seguro de que querés eliminar el vehículo "${vehicle.name}"?\n(Se eliminarán todos sus registros y gastos asociados de forma permanente)`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteVehicle(vehicle.id)
      toast.success(`Vehículo "${vehicle.name}" eliminado correctamente.`)
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error("Error al eliminar el vehículo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={vehicle ? "Editar Vehículo" : "Nuevo Vehículo"}
      description={vehicle ? "Modificá la ficha del vehículo" : "Registrá un nuevo vehículo en tu garaje"}
    >
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="veh-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nombre / Apodo
          </label>
          <input
            id="veh-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mi Honda GLH, El auto familiar"
            className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Tipo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo de Vehículo
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => {
              const SelectedIcon = t.Icon
              const active = type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all cursor-pointer ${
                    active
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <SelectedIcon className="size-5" />
                  <span className="text-[10px]">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Marca */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-brand" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Marca
            </label>
            <input
              id="veh-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej. Honda, Fiat"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Modelo */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-model" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Modelo
            </label>
            <input
              id="veh-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej. GLH 150, Cronos"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Año */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-year" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Año
            </label>
            <input
              id="veh-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Ej. 2023"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Patente */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-plate" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Patente / Dominio
            </label>
            <input
              id="veh-plate"
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Ej. A123BCD"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Kilometraje inicial */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-odo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Kilometraje (Km)
            </label>
            <input
              id="veh-odo"
              type="number"
              required
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="Ej. 1200"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Capacidad del tanque */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="veh-tank" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tanque (Litros)
            </label>
            <input
              id="veh-tank"
              type="number"
              step="any"
              value={fuelCapacity}
              onChange={(e) => setFuelCapacity(e.target.value)}
              placeholder="Ej. 12"
              className="h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-4 flex flex-col gap-2">
          <Button type="submit" size="lg" className="w-full rounded-xl h-12" disabled={submitting}>
            {vehicle ? "Guardar cambios" : "Agregar vehículo"}
          </Button>

          {vehicle && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full rounded-xl h-12 shadow-sm"
              onClick={handleDelete}
              disabled={submitting}
            >
              Eliminar vehículo
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  )
}
