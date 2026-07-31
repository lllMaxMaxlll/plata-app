"use client"

import { Home, Wallet, Plus, Sparkles, LayoutGrid } from "lucide-react"

export type View =
  | "home"
  | "accounts"
  | "vehicles"
  | "stocks"
  | "activity"
  | "profile"
  | "advisor"
  | "more"
  | "analytics"

const ITEMS: { view: View; label: string; Icon: typeof Home }[] = [
  { view: "home", label: "Inicio", Icon: Home },
  { view: "accounts", label: "Cuentas", Icon: Wallet },
  { view: "advisor", label: "PLATA AI", Icon: Sparkles },
  { view: "more", label: "Más", Icon: LayoutGrid },
]

export function BottomNav({
  active,
  onChange,
  onAdd,
}: {
  active: View
  onChange: (v: View) => void
  onAdd: () => void
}) {
  const left = ITEMS.slice(0, 2)
  const right = ITEMS.slice(2)

  // Contextual FAB: Only show when creating a general transaction is relevant
  const showFab = ["home", "accounts", "activity"].includes(active)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="relative border-t border-border bg-card/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 justify-around">
            {left.map((item) => (
              <NavButton key={item.view} item={item} active={active} onChange={onChange} />
            ))}
          </div>

          <div className="w-16" aria-hidden />

          <div className="flex flex-1 justify-around">
            {right.map((item) => (
              <NavButton key={item.view} item={item} active={active} onChange={onChange} />
            ))}
          </div>
        </div>

        {/* Center FAB with scale & opacity animations */}
        <button
          onClick={onAdd}
          aria-label="Agregar movimiento"
          className={`absolute -top-5 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 ease-out active:scale-95 ${
            showFab ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none"
          }`}
        >
          <Plus className="size-6" />
        </button>
      </div>
    </nav>
  )
}

function isTabActive(tabView: View, currentView: View): boolean {
  if (tabView === currentView) return true
  if (tabView === "more") {
    return ["more", "vehicles", "stocks", "activity", "profile"].includes(currentView)
  }
  return false
}

function NavButton({
  item,
  active,
  onChange,
}: {
  item: { view: View; label: string; Icon: typeof Home }
  active: View
  onChange: (v: View) => void
}) {
  const isActive = isTabActive(item.view, active)
  return (
    <button
      onClick={() => onChange(item.view)}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <item.Icon className="size-5" />
      {item.label}
    </button>
  )
}
