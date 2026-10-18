"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, Plus, ReceiptText, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { findRoute, ROUTES } from "@/lib/routes"

const ITEMS: { href: string; label: string; Icon: typeof Home }[] = [
  { ...ROUTES.home, Icon: Home },
  { ...ROUTES.accounts, Icon: Wallet },
  { ...ROUTES.activity, Icon: ReceiptText },
  { ...ROUTES.more, Icon: LayoutGrid },
]

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname()
  const left = ITEMS.slice(0, 2)
  const right = ITEMS.slice(2)

  // Contextual FAB: Only show when creating a general transaction is relevant
  const showFab = ["/", "/accounts", "/activity"].includes(pathname)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="relative border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 justify-around">
            {left.map((item) => (
              <NavButton key={item.href} item={item} currentPath={pathname} />
            ))}
          </div>

          {/* Hueco del FAB: sin FAB, las cuatro pestañas se reparten el ancho. */}
          {showFab && <div className="w-14" aria-hidden />}

          <div className="flex flex-1 justify-around">
            {right.map((item) => (
              <NavButton key={item.href} item={item} currentPath={pathname} />
            ))}
          </div>
        </div>

        {/* Center FAB with Shadcn Button */}
        <Button
          onClick={onAdd}
          aria-label="Agregar movimiento"
          size="icon"
          className={`absolute -top-5 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 active:scale-95 cursor-pointer ${
            showFab ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none"
          }`}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </nav>
  )
}

function isTabActive(href: string, currentPath: string): boolean {
  if (href === currentPath) return true
  // Las pantallas que cuelgan de "Más" mantienen esa pestaña activa.
  if (href === ROUTES.more.href) return findRoute(currentPath)?.parent === ROUTES.more.href
  return false
}

function NavButton({
  item,
  currentPath,
}: {
  item: { href: string; label: string; Icon: typeof Home }
  currentPath: string
}) {
  const isActive = isTabActive(item.href, currentPath)
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
        isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <item.Icon className="size-4.5" />
      {item.label}
    </Link>
  )
}

