import { format, isValid, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { VehicleLog } from './finance-data.ts'

/** Events and next-service dates are calendar dates, not instants. */
export function vehicleDateValue(value: string): string {
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && isValid(parseISO(day)) ? day : ''
}
export function formatVehicleDate(value: string, pattern = 'dd/MM/yyyy'): string {
  const day = vehicleDateValue(value)
  return day ? format(parseISO(day), pattern, { locale: es }) : 'Fecha inválida'
}
/** Latest service replaces the previous plan; parts/fuel do not complete it. */
export function latestVehicleService(logs: VehicleLog[]): VehicleLog | undefined {
  return logs.filter(l => l.type === 'service').sort((a, b) => vehicleDateValue(b.date).localeCompare(vehicleDateValue(a.date)) || b.odometer - a.odometer || b.id.localeCompare(a.id))[0]
}
export function validateVehicleLogNumbers(input: { odometer: string; amount: string; liters: string; nextOdometer: string; type: string }) {
  const odometer = Number(input.odometer)
  const amount = input.amount.trim() ? Number(input.amount.replace(',', '.')) : 0
  const liters = input.liters.trim() ? Number(input.liters.replace(',', '.')) : undefined
  const nextOdometer = input.nextOdometer.trim() ? Number(input.nextOdometer) : undefined
  if (!input.odometer.trim() || !Number.isSafeInteger(odometer) || odometer < 0 || odometer > 2147483647) throw new Error('Ingresá un kilometraje entero y no negativo.')
  if (!Number.isFinite(amount) || amount < 0) throw new Error('El costo debe ser un número válido, igual o mayor a cero.')
  if (input.type === 'fuel' && liters !== undefined && (!Number.isFinite(liters) || liters <= 0)) throw new Error('Los litros deben ser mayores a cero.')
  if (input.type === 'service' && nextOdometer !== undefined && (!Number.isSafeInteger(nextOdometer) || nextOdometer <= odometer || nextOdometer > 2147483647)) throw new Error('El próximo service debe tener un kilometraje mayor al de este registro.')
  return { odometer, amount, liters, nextOdometer }
}
