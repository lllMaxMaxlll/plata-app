/**
 * La Agenda junta en una sola línea de tiempo todo lo que tiene fecha o
 * kilometraje: los vencimientos y el próximo service de cada vehículo.
 *
 * Antes vivían en dos pantallas distintas y las alertas del auto sólo se veían
 * entrando a Vehículos. Acá se calculan juntas para que Hoy y Agenda muestren
 * lo mismo y en el mismo orden.
 */

import { differenceInCalendarDays, parseISO } from "date-fns"
import type { Currency, DueItem, Vehicle, VehicleLog } from "./finance-data.ts"
import { latestVehicleService, vehicleDateValue } from './vehicle-maintenance.ts'

export type Urgency = "overdue" | "soon" | "later"

interface BaseItem {
  id: string
  title: string
  urgency: Urgency
  /** Días de calendario hasta la fecha; negativo si ya pasó. `null` si sólo hay km. */
  daysUntil: number | null
}

export interface DueAgendaItem extends BaseItem {
  kind: "due"
  date: string
  amount: number
  currency: Currency
  accountId?: string
  item: DueItem
}

export interface ServiceAgendaItem extends BaseItem {
  kind: "service"
  vehicleId: string
  vehicleName: string
  /** Kilómetros que faltan; negativo si ya se pasó. */
  kmLeft: number | null
  /** Qué parte del intervalo entre services ya se recorrió, de 0 a 1. */
  progress: number | null
  targetOdometer: number | null
  currentOdometer: number
  date: string | null
}

export type AgendaItem = DueAgendaItem | ServiceAgendaItem

/** Avisar del service con este margen: un turno en el taller no es para mañana. */
const SERVICE_SOON_KM = 1000
const SERVICE_SOON_DAYS = 15
const SERVICE_LATER_KM = 3000

function daysUntil(date: string, now: Date): number {
  return differenceInCalendarDays(parseISO(date), now)
}

function dueUrgency(item: DueItem, days: number): Urgency {
  if (days < 0) return "overdue"
  if (days <= Math.max(item.reminderDaysBefore || 0, 3)) return "soon"
  return "later"
}

/**
 * El último service cargado es el que manda: los anteriores también traen un
 * "próximo service", pero ya quedó atrás cuando se hizo el siguiente.
 */
function latestServiceWithTarget(logs: VehicleLog[]): VehicleLog | undefined {
  return latestVehicleService(logs)
}

function serviceItem(vehicle: Vehicle, log: VehicleLog, now: Date, horizonDays: number): ServiceAgendaItem | null {
  const target = typeof log.nextServiceOdometer === "number" ? log.nextServiceOdometer : null
  const kmLeft = target === null ? null : target - vehicle.odometer
  const date = log.nextServiceDate ? vehicleDateValue(log.nextServiceDate) : ''
  const days = date ? daysUntil(date, now) : null

  const overdue = (kmLeft !== null && kmLeft <= 0) || (days !== null && days < 0)
  const soon = (kmLeft !== null && kmLeft <= SERVICE_SOON_KM) || (days !== null && days <= SERVICE_SOON_DAYS)
  const later = (kmLeft !== null && kmLeft <= SERVICE_LATER_KM) || (days !== null && days <= horizonDays)
  if (!overdue && !soon && !later) return null

  const interval = target === null ? null : target - log.odometer
  const progress =
    interval && interval > 0 ? Math.min(1, Math.max(0, (vehicle.odometer - log.odometer) / interval)) : null

  return {
    kind: "service",
    id: `service:${vehicle.id}`,
    title: `Service ${vehicle.name}`,
    urgency: overdue ? "overdue" : soon ? "soon" : "later",
    daysUntil: days,
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    kmLeft,
    progress,
    targetOdometer: target,
    currentOdometer: vehicle.odometer,
    date: date || null,
  }
}

const URGENCY_ORDER: Record<Urgency, number> = { overdue: 0, soon: 1, later: 2 }

/**
 * Para ordenar un service que sólo tiene km contra vencimientos con fecha:
 * se lo ubica al principio de su grupo, que es donde un aviso por km tiene
 * sentido mirarlo.
 */
function sortDays(item: AgendaItem): number {
  return item.daysUntil ?? -Infinity
}

export function buildAgenda({
  dueItems,
  vehicles,
  vehicleLogs,
  now = new Date(),
  horizonDays = 30,
}: {
  dueItems: DueItem[]
  vehicles: Vehicle[]
  vehicleLogs: VehicleLog[]
  now?: Date
  horizonDays?: number
}): AgendaItem[] {
  const items: AgendaItem[] = []

  for (const item of dueItems) {
    if (item.status === "paid") continue
    const days = daysUntil(item.dueDate, now)
    if (days > horizonDays) continue
    items.push({
      kind: "due",
      id: `due:${item.id}`,
      title: item.title,
      urgency: dueUrgency(item, days),
      daysUntil: days,
      date: item.dueDate,
      amount: item.amount,
      currency: item.currency,
      accountId: item.accountId,
      item,
    })
  }

  for (const vehicle of vehicles) {
    const log = latestServiceWithTarget(vehicleLogs.filter((l) => l.vehicleId === vehicle.id))
    if (!log) continue
    const service = serviceItem(vehicle, log, now, horizonDays)
    if (service) items.push(service)
  }

  return items.sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || sortDays(a) - sortDays(b)
  )
}

/** "Hoy", "mañana", "en 5 días", "hace 2 días": para las tarjetas de la agenda. */
export function relativeDays(days: number): string {
  if (days === 0) return "hoy"
  if (days === 1) return "mañana"
  if (days === -1) return "ayer"
  if (days < 0) return `hace ${-days} días`
  return `en ${days} días`
}
