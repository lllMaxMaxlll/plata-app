import { cn } from "@/lib/utils"

interface AppIconProps {
  className?: string
  pulse?: boolean
}

/**
 * La moneda de EN MANO: un círculo lima con borde de tinta y sombra dura. Va en
 * SVG en línea para que no dependa de una imagen ni de su carga.
 */
export function AppIcon({ className, pulse = false }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("inline-block shrink-0", pulse && "animate-pulse", className)}
      aria-hidden="true"
    >
      <circle cx="35" cy="35" r="26" fill="var(--shadow-ink)" />
      <circle cx="31" cy="31" r="26" fill="var(--lime)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M31 14v34" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M40.5 22.5c-1.6-3-5.1-4.5-9.5-4.5-5.6 0-9.5 2.8-9.5 6.8 0 10 20 4.7 20 14.3 0 4.2-4.4 7.2-10.4 7.2-4.8 0-8.9-1.9-10.4-5.3"
        stroke="var(--ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/** Moneda + EN MANO, para el sidebar y las pantallas de bienvenida. */
export function Wordmark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tighter", className)}>
      <AppIcon className={cn("size-[1.1em]", iconClassName)} />
      EN MANO
    </span>
  )
}
