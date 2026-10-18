"use client"

import type { ReactNode } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

/**
 * Selector de una sola opción (moneda, período, tipo de movimiento). Reemplaza
 * los grupos de `<button>` armados a mano: teclado, `aria-pressed` y estilo
 * salen del ToggleGroup.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  size = "default",
  className,
  itemClassName,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  ariaLabel: string
  size?: "sm" | "default"
  className?: string
  itemClassName?: string
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        // Volver a tocar la opción activa la deseleccionaría: se ignora.
        const next = values[0] as T | undefined
        if (next) onValueChange(next)
      }}
      multiple={false}
      variant="outline"
      size={size}
      spacing={0}
      aria-label={ariaLabel}
      className={className}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn("gap-1.5 px-3 text-xs font-semibold whitespace-nowrap", itemClassName)}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
