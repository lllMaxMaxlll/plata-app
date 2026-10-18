"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  Bike,
  Car,
  CreditCard,
  GraduationCap,
  Home,
  Landmark,
  Receipt,
  Repeat,
  Shield,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { formatShort } from "@/lib/finance-data"
import { relativeDays, type AgendaItem } from "@/lib/agenda"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"

/**
 * Contenedor de toda pantalla: mismo ancho y márgenes en todas, así el
 * contenido no salta al navegar. En escritorio el padding lo pone el shell.
 */
export const pageClass = "mx-auto w-full max-w-6xl px-4 pt-4 pb-12 md:px-0 md:pt-0"

/** Título de bloque con un link a la pantalla completa a la derecha. */
export function BlockHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      {href && (
        <Link href={href} className="font-mono text-[11px] font-semibold underline-offset-2 hover:underline">
          {linkLabel ?? "ver todo"} →
        </Link>
      )}
    </div>
  )
}

/**
 * Ícono en un cuadrado con borde de tinta: la unidad visual de las listas.
 * Sobre los acentos de marca (lima, coral, cielo, uva) el ícono va en tinta en
 * los dos temas; sobre `bg-muted` hay que pasar también `text-foreground`.
 */
export function IconTile({ Icon, className }: { Icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-foreground text-ink",
        className
      )}
    >
      <Icon className="size-4.5" strokeWidth={2.2} />
    </span>
  )
}

export function Pill({ tone, children }: { tone: "coral" | "lime" | "plain"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-[1.5px] border-foreground px-2 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap",
        tone === "coral" && "bg-coral text-ink",
        tone === "lime" && "bg-lime text-ink",
        tone === "plain" && "bg-card"
      )}
    >
      {children}
    </span>
  )
}

const DUE_ICONS: Record<string, LucideIcon> = {
  Servicios: Zap,
  Alquiler: Home,
  "Tarjeta de Crédito": CreditCard,
  Impuestos: Landmark,
  Subscripciones: Repeat,
  Seguros: Shield,
  Educación: GraduationCap,
}

/** Ícono de un vencimiento según su categoría. */
export function dueIcon(category: string): LucideIcon {
  return DUE_ICONS[category] ?? Receipt
}

export function agendaIcon(item: AgendaItem, vehicleType?: string): LucideIcon {
  if (item.kind === "service") {
    return vehicleType === "motorcycle" ? Bike : vehicleType === "truck" ? Truck : Car
  }
  return dueIcon(item.item.category)
}

/** Fondo del ícono según lo que pide la fecha: coral si apura, cielo si es del vehículo. */
export function agendaTone(item: AgendaItem): string {
  if (item.urgency !== "later") return "bg-coral"
  return item.kind === "service" ? "bg-sky" : "bg-muted text-foreground"
}

export function agendaWhen(item: AgendaItem): string {
  if (item.kind === "service") {
    const parts: string[] = []
    if (item.kmLeft !== null) parts.push(item.kmLeft <= 0 ? `pasado ${Math.abs(item.kmLeft).toLocaleString("es-AR")} km` : `faltan ${item.kmLeft.toLocaleString("es-AR")} km`)
    if (item.daysUntil !== null) parts.push(relativeDays(item.daysUntil))
    return parts.join(" · ")
  }
  return relativeDays(item.daysUntil ?? 0)
}

/** Fila compacta de agenda para Hoy: ícono, qué, cuándo y cuánto. */
export function AgendaRow({ item }: { item: AgendaItem }) {
  const { vehicles, getAccount } = useFinance()
  const { mask } = useUI()
  const vehicle = item.kind === "service" ? vehicles.find((v) => v.id === item.vehicleId) : undefined
  const account = item.kind === "due" && item.accountId ? getAccount(item.accountId) : undefined

  return (
    <li className="flex items-center gap-3 border-b-[1.5px] border-dashed border-foreground/15 py-2.5 last:border-b-0">
      <IconTile Icon={agendaIcon(item, vehicle?.type)} className={agendaTone(item)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {agendaWhen(item)}
          {account && ` · ${account.name}`}
        </p>
      </div>
      {item.kind === "due" ? (
        <span className="shrink-0 font-mono text-xs font-semibold">{mask(formatShort(item.amount, item.currency))}</span>
      ) : (
        <Pill tone={item.urgency === "later" ? "plain" : "coral"}>{item.urgency === "overdue" ? "ya toca" : "pronto"}</Pill>
      )}
    </li>
  )
}
