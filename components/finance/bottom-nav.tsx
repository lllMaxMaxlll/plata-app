"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Coins, Plus, CalendarDays, User, type LucideIcon } from "lucide-react"
import { activeTab, ROUTES, type RouteKey } from "@/lib/routes"
import { cn } from "@/lib/utils"

const ICONS: Record<"home" | "plata" | "agenda" | "profile", LucideIcon> = {
  home: Home,
  plata: Coins,
  agenda: CalendarDays,
  profile: User,
}

/**
 * Barra flotante con Anotar en lima en el medio. Anotar está siempre: es la
 * forma de cargar y de preguntar, no sólo un "+" para algunas pantallas.
 */
export function BottomNav({ onAnotar }: { onAnotar: () => void }) {
  const pathname = usePathname()
  const current = activeTab(pathname)

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]"
    >
      <div className="flex h-16 items-center justify-around rounded-3xl border-2 border-border bg-card px-1 text-muted-foreground shadow-md">
        <Tab route="home" current={current} />
        <Tab route="plata" current={current} />
        <button
          type="button"
          onClick={onAnotar}
          aria-label="Anotar o preguntar"
          className="flex size-12 cursor-pointer items-center justify-center rounded-2xl border-2 border-lime bg-lime text-ink transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
        <Tab route="agenda" current={current} />
        <Tab route="profile" current={current} />
      </div>
    </nav>
  )
}

function Tab({ route, current }: { route: keyof typeof ICONS & RouteKey; current: string | undefined }) {
  const { href, label } = ROUTES[route]
  const Icon = ICONS[route]
  const active = current === href

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
      {label}
    </Link>
  )
}
