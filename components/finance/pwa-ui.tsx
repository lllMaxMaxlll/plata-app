"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CloudOff, Share, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getInstallContext, useInstallPrompt, useOnline, type InstallContext } from "@/lib/pwa"
import { IconTile } from "./lucas-ui"

/**
 * Aviso fijo mientras no hay red. Lo que se ve es la última copia guardada, y
 * lo que se anote no llega a Supabase: mejor decirlo antes que después del error.
 */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b-2 border-border bg-coral px-4 pt-[calc(env(safe-area-inset-top)+0.375rem)] pb-1.5 text-xs font-bold text-ink"
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      Sin conexión: ves lo último guardado. Para anotar hace falta internet.
    </div>
  )
}

/** Sección de Yo para instalar la app. Desaparece cuando ya está instalada. */
export function InstallAppSection() {
  const install = useInstallPrompt()
  // matchMedia y el user agent sólo existen en el cliente
  const [context, setContext] = useState<InstallContext | null>(null)
  useEffect(() => setContext(getInstallContext()), [])

  if (context === null || context === "installed") return null
  // Fuera de iOS, sin el evento del navegador no hay nada que ofrecer (Firefox
  // de escritorio, o Chrome que todavía no la considera instalable)
  if (context === "other" && !install) return null

  return (
    <section className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <IconTile Icon={Smartphone} className="bg-sky" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-bold">Instalá EN MANO</p>
          <p className="text-xs text-muted-foreground">
            Queda en la pantalla de inicio como una app y abre aunque no tengas señal.
          </p>
        </div>
        {context === "ios" ? (
          <p className="text-xs">
            En Safari tocá <Share className="inline size-3.5 align-[-2px]" aria-label="Compartir" /> y después{" "}
            <span className="font-bold">Agregar a inicio</span>.
          </p>
        ) : (
          <Button
            size="sm"
            className="bg-lime text-ink hover:bg-lime/85"
            onClick={async () => {
              const outcome = await install?.()
              if (outcome === "accepted") toast.success("Listo, EN MANO quedó instalada.")
            }}
          >
            Instalar app
          </Button>
        )}
      </div>
    </section>
  )
}
