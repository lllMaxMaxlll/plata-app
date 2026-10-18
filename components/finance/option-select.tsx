"use client"

import type { ReactNode } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
}

/**
 * Select de la app para listas simples de opciones, en lugar del `<select>`
 * nativo: mismo estilo que el resto de los formularios.
 */
export function OptionSelect<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly SelectOption<T>[]
  ariaLabel: string
  className?: string
}) {
  const selected = options.find((o) => o.value === value)

  return (
    <Select value={value} onValueChange={(v) => v != null && onValueChange(v as T)}>
      <SelectTrigger aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
