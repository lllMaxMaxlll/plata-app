"use client"

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { Toaster } from "sonner"
import type { ThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useUI } from "./ui-context"

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
]

/** Selector claro / oscuro / sistema. Vive sólo en Yo: un lugar, no tres. */
export function ThemeToggle({ className }: { className?: string }) {
  const { themePreference, setThemePreference } = useUI()

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("inline-flex rounded-xl border-2 border-foreground bg-card p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = themePreference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemePreference(value)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-lime text-ink" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** Los avisos siguen el tema elegido en la app, no sólo el del sistema. */
export function ThemedToaster() {
  const { theme } = useUI()
  return <Toaster theme={theme} position="top-center" closeButton richColors />
}
