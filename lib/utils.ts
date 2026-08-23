import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Props para filas/tarjetas clickeables que no son un `<button>` (llevan
 * párrafos, badges u otros bloques adentro). Agrega semántica y teclado:
 * sin esto, la fila es invisible para lectores de pantalla y no se puede
 * activar con Enter/Espacio.
 */
export function clickableRowProps(onActivate: () => void, label?: string) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onActivate()
      }
    },
  } as const
}

/** Anillo de foco consistente para esas filas clickeables. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
