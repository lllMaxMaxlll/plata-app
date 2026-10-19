"use client"

import { ReactNode, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useFinance } from "@/components/finance/finance-provider"
import { useUI } from "@/components/finance/ui-context"
import { AuthView } from "@/components/finance/auth-view"
import { LoadingSkeleton } from "@/components/finance/loading-skeleton"
import { BottomNav } from "@/components/finance/bottom-nav"
import { AnotarSheet } from "@/components/finance/anotar-sheet"
import { TransactionSheet } from "@/components/finance/transaction-sheet"
import { AddAccountSheet } from "@/components/finance/add-account-sheet"
import { ManageCategoriesSheet } from "@/components/finance/manage-categories-sheet"
import { SecuritySheet } from "@/components/finance/security-sheet"
import { CurrencyExchangeSheet } from "@/components/finance/currency-exchange-sheet"
import { ExportSheet } from "@/components/finance/export-sheet"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/finance/app-icon"
import {
  Home,
  Coins,
  CalendarDays,
  User,
  Plus,
  Eye,
  EyeOff,
  LogOut,
  ArrowLeftRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { formatShort } from "@/lib/finance-data"
import { ROUTES, activeTab, findRoute, type RouteKey } from "@/lib/routes"
import { useIsDesktop } from "@/lib/use-is-desktop"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/finance/user-avatar"
import { OfflineBanner } from "@/components/finance/pwa-ui"

/** El sidebar de escritorio repite las pestañas de mobile, con sus pantallas colgando. */
const NAV: { tab: RouteKey; Icon: LucideIcon; children: RouteKey[] }[] = [
  { tab: "home", Icon: Home, children: ["activity", "search"] },
  { tab: "plata", Icon: Coins, children: ["accounts", "analytics", "stocks", "projections", "vehicles"] },
  { tab: "agenda", Icon: CalendarDays, children: ["dueItems"] },
  { tab: "profile", Icon: User, children: [] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, totalsByCurrency } = useFinance()
  const ui = useUI()
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const { handleOpenAnotar } = ui

  // ⌘K / Ctrl+K abre Anotar desde cualquier pantalla: en escritorio es más
  // rápido que ir a buscar el botón.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        handleOpenAnotar()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleOpenAnotar])

  // Only one shell is mounted: rendering both and hiding one with CSS duplicated
  // every page, its effects and its data fetching.
  // Las pantallas de /auth se muestran solas: durante la recuperación la sesión
  // puede tardar en establecerse, y el gate de abajo mostraría el login encima
  // del formulario de contraseña nueva.
  if (pathname.startsWith("/auth/")) {
    return <>{children}</>
  }

  if (loading || isDesktop === null) {
    return <LoadingSkeleton />
  }

  if (!user) {
    return <AuthView />
  }

  const route = findRoute(pathname)
  const tab = activeTab(pathname)
  const parent = route && "parent" in route && route.parent ? findRoute(route.parent) : undefined

  return (
    <>
      {!isDesktop && (
        <div className="mx-auto min-h-dvh w-full max-w-md bg-background">
          <OfflineBanner />
          <main className="pt-[env(safe-area-inset-top)] pb-28">{children}</main>
          <BottomNav onAnotar={ui.handleOpenAnotar} />
        </div>
      )}

      {isDesktop && (
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <aside className="flex h-full w-64 shrink-0 flex-col justify-between overflow-y-auto border-r-2 border-foreground bg-sidebar p-4">
            <div className="flex flex-col gap-5">
              <Link href="/" className="px-1 text-3xl">
                <Wordmark />
              </Link>

              <div className="flex flex-col gap-2">
                <Button onClick={ui.handleOpenAnotar} className="h-10 w-full justify-start gap-2 bg-lime text-ink hover:bg-lime/85">
                  <Plus data-icon="inline-start" className="size-4" strokeWidth={2.5} />
                  Anotar
                  <kbd className="ml-auto rounded border-[1.5px] border-ink/40 px-1 font-mono text-[10px]">⌘K</kbd>
                </Button>
                <Button onClick={ui.handleOpenExchange} variant="outline" className="h-9 w-full justify-start gap-2 text-xs">
                  <ArrowLeftRight data-icon="inline-start" className="size-3.5" />
                  Cambio de moneda
                </Button>
              </div>

              <nav className="flex flex-col gap-3" aria-label="Principal">
                {NAV.map(({ tab: key, Icon, children: subs }) => {
                  const item = ROUTES[key]
                  const open = tab === item.href
                  return (
                    <div key={key}>
                      <Link
                        href={item.href}
                        aria-current={pathname === item.href ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-sm font-bold transition-colors",
                          open ? "border-foreground bg-lime text-ink shadow-xs" : "border-transparent hover:bg-muted"
                        )}
                      >
                        <Icon className="size-4.5" />
                        {item.label}
                      </Link>
                      {subs.length > 0 && (
                        <div className="mt-1 ml-[1.15rem] flex flex-col border-l-2 border-foreground/15 pl-2.5">
                          {subs.map((sub) => {
                            const child = ROUTES[sub]
                            const active = pathname === child.href
                            return (
                              <Link
                                key={sub}
                                href={child.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                                  active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {child.label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t-2 border-foreground pt-4">
              <div className="flex items-center gap-2.5 px-1 py-1">
                <UserAvatar user={user} className="size-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{user?.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut data-icon="inline-start" className="size-3.5" />
                Cerrar sesión
              </Button>
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
            <OfflineBanner />
            <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-foreground bg-background px-6 py-3">
              {/* Ruta y no título: el <h1> lo pone cada vista con el mismo nombre. */}
              <nav aria-label="Ubicación" className="flex items-center gap-1.5 text-sm">
                <span className="font-extrabold">lucas</span>
                {parent && (
                  <>
                    <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    <Link href={parent.href} className="text-muted-foreground hover:text-foreground">
                      {parent.label}
                    </Link>
                  </>
                )}
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="font-semibold text-foreground" aria-current="page">
                  {route?.label ?? "lucas"}
                </span>
              </nav>

              <div className="flex items-center gap-3 rounded-xl border-2 border-foreground bg-card px-3 py-1.5 font-mono">
                <div className="border-r-2 border-foreground/15 pr-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Pesos</p>
                  <p className="text-xs font-bold tabular-nums">{ui.mask(formatShort(totalsByCurrency.ARS, "ARS"))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dólares</p>
                  <p className="text-xs font-bold tabular-nums">{ui.mask(formatShort(totalsByCurrency.USD, "USD"))}</p>
                </div>
                <Button
                  onClick={ui.toggleBalancesHidden}
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={ui.balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
                  aria-label={ui.balancesHidden ? "Mostrar saldos" : "Ocultar saldos"}
                >
                  {ui.balancesHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </header>

            <div className="flex-1 p-6">{children}</div>
          </main>
        </div>
      )}

      {/* Shared Dialogs / sheets */}
      <AnotarSheet open={ui.anotarOpen} onClose={ui.handleCloseAnotar} />
      <TransactionSheet
        open={ui.txOpen}
        onClose={ui.handleCloseTxSheet}
        transaction={ui.editingTransaction}
      />
      <AddAccountSheet
        open={ui.accountOpen}
        onClose={ui.handleCloseAccountSheet}
        account={ui.editingAccount}
      />
      <ManageCategoriesSheet
        open={ui.categoriesOpen}
        onClose={ui.handleCloseCategories}
      />
      <SecuritySheet
        open={ui.securityOpen}
        onClose={ui.handleCloseSecurity}
      />
      <CurrencyExchangeSheet
        open={ui.exchangeOpen}
        onClose={ui.handleCloseExchange}
      />
      <ExportSheet
        open={ui.exportOpen}
        onClose={ui.handleCloseExport}
      />
    </>
  )
}
