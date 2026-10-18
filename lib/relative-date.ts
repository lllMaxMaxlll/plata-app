import { differenceInCalendarDays, isSameYear, parseISO } from "date-fns"

/**
 * Fecha corta para listas de movimientos: "Hoy", "Ayer", "Hace 3 días" y
 * después "12 ene" (o "12 ene 2025" si no es del año en curso, para que el
 * historial completo no mezcle años).
 *
 * Cuenta días de calendario y no bloques de 24 h: un gasto de anoche a las 23
 * es "Ayer" aunque hayan pasado menos de 24 horas. `parseISO` lee "2026-10-18"
 * como fecha local; `new Date` la tomaba como medianoche UTC.
 */
export function relativeDate(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso)
  const diffDays = differenceInCalendarDays(now, date)

  if (diffDays === 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} días`

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    ...(isSameYear(date, now) ? {} : { year: "numeric" }),
  })
}
