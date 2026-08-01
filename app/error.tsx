"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to monitoring service if needed
    console.error("Unhandled Application Error:", error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg mb-4">
        <AlertTriangle className="size-8" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-foreground">
        ¡Ups! Ocurrió un error inesperado
      </h1>
      <p className="mt-2 text-xs text-muted-foreground max-w-md leading-relaxed">
        No te preocupes, tus datos financieros están seguros. Podés intentar recargar la vista o volver al inicio.
      </p>

      {error.message && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-[11px] font-mono text-muted-foreground/80 max-w-md truncate">
          {error.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={reset}
          variant="default"
          className="flex items-center gap-2 rounded-xl text-xs font-semibold"
        >
          <RotateCcw className="size-4" />
          Reintentar
        </Button>
        <Button
          asChild
          variant="outline"
          className="flex items-center gap-2 rounded-xl text-xs font-semibold"
        >
          <Link href="/">
            <Home className="size-4" />
            Ir al inicio
          </Link>
        </Button>
      </div>
    </div>
  )
}
