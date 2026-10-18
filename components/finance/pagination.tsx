"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Pagina una lista ya filtrada.
 *
 * `resetKey` resume los filtros: cuando cambia se vuelve a la primera página.
 * No alcanza con mirar la lista, porque el realtime la recrea con cada
 * movimiento editado y eso mandaría al usuario a la página 1 en plena edición.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 0 })
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  // Si se borró lo último de la última página, la página deja de existir.
  const page = state.key === resetKey ? Math.min(state.page, pageCount - 1) : 0

  return {
    page,
    pageCount,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    setPage: (next: number) => setState({ key: resetKey, page: Math.max(0, Math.min(next, pageCount - 1)) }),
  }
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (pageCount <= 1) return null

  return (
    <nav aria-label="Paginación" className={cn("flex items-center justify-between gap-3", className)}>
      <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft />
        Anterior
      </Button>
      <p className="font-mono text-xs font-semibold text-muted-foreground" aria-live="polite">
        {page + 1} / {pageCount}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
        <ChevronRight />
      </Button>
    </nav>
  )
}
