"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ROUTES, type AppRoute, type RouteKey } from "@/lib/routes"
import { useIsDesktop } from "@/lib/use-is-desktop"
import { cn } from "@/lib/utils"

/**
 * Encabezado común de las pantallas: título del mapa de rutas, descripción,
 * acciones a la derecha y, en mobile, el botón "Volver" a la pantalla padre.
 */
export function PageHeader({
  route,
  description,
  actions,
  className,
}: {
  route: RouteKey
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const { label, parent }: AppRoute = ROUTES[route]

  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {parent && isDesktop === false && (
          <Button
            render={<Link href={parent} />}
            nativeButton={false}
            variant="outline"
            size="icon-lg"
            className="shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground">{label}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
