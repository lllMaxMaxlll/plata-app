"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useFinance } from "@/components/finance/finance-provider"
import { useUI } from "@/components/finance/ui-context"
import { AuthView } from "@/components/finance/auth-view"
import { LoadingSkeleton } from "@/components/finance/loading-skeleton"
import { BottomNav } from "@/components/finance/bottom-nav"
import { TransactionSheet } from "@/components/finance/transaction-sheet"
import { AddAccountSheet } from "@/components/finance/add-account-sheet"
import { ManageCategoriesSheet } from "@/components/finance/manage-categories-sheet"
import { SecuritySheet } from "@/components/finance/security-sheet"
import { CurrencyExchangeSheet } from "@/components/finance/currency-exchange-sheet"
import { ExportSheet } from "@/components/finance/export-sheet"
import { Button } from "@/components/ui/button"
import { AppIcon } from "@/components/finance/app-icon"
import {
  Wallet,
  Home,
  ReceiptText,
  User,
  Plus,
  Eye,
  EyeOff,
  LogOut,
  ArrowLeftRight,
  LineChart,
  TrendingUp,
  Bike,
  CalendarClock,
  Target,
  Globe,
  ChevronRight,
  Shield,
  Activity,
} from "lucide-react"
import { formatShort } from "@/lib/finance-data"
import { useIsDesktop } from "@/lib/use-is-desktop"

const NAV_GROUPS = [
  {
    title: "CORE SERVICES",
    items: [
      { href: "/", label: "Inicio", Icon: Home },
      { href: "/accounts", label: "Cuentas", Icon: Wallet },
      { href: "/activity", label: "Actividad", Icon: ReceiptText },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { href: "/analytics", label: "Análisis", Icon: TrendingUp },
      { href: "/dashboard/proyecciones", label: "Proyecciones", Icon: Target },
    ],
  },
  {
    title: "ASSETS & TRACKING",
    items: [
      { href: "/stocks", label: "Portafolio", Icon: LineChart },
      { href: "/vehicles", label: "Vehículos", Icon: Bike },
      { href: "/dashboard/vencimientos", label: "Vencimientos", Icon: CalendarClock },
    ],
  },
  {
    title: "ACCOUNT & SETTINGS",
    items: [
      { href: "/profile", label: "Perfil", Icon: User },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, totalsByCurrency } = useFinance()
  const ui = useUI()
  const pathname = usePathname()
  const [hidden, setHidden] = useState(false)
  const isDesktop = useIsDesktop()

  const mask = (value: string) => (hidden ? "••••••" : value)

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

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/":
        return "Overview Dashboard"
      case "/accounts":
        return "Cuentas & Activos"
      case "/dashboard/proyecciones":
      case "/proyecciones":
        return "Proyección Financiera & Escenarios"
      case "/dashboard/vencimientos":
      case "/vencimientos":
        return "Calendario de Vencimientos"
      case "/vehicles":
        return "Vehículos & Mantenimiento"
      case "/stocks":
        return "Portafolio de Inversiones"
      case "/activity":
        return "Historial de Eventos"
      case "/profile":
        return "Configuración de Cuenta"
      case "/analytics":
        return "Análisis & Métricas"
      case "/more":
        return "Explorar"
      default:
        return "Cloudflare Dashboard"
    }
  }

  return (
    <>
      {/* Mobile View Shell */}
      {!isDesktop && (
        <div className="mx-auto min-h-dvh w-full max-w-md bg-background">
          <main className="pb-28">{children}</main>
          <BottomNav onAdd={ui.handleAddTransaction} />
        </div>
      )}

      {/* Desktop View Shell (Cloudflare Dashboard Clone) */}
      {isDesktop && (
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          {/* Cloudflare Sidebar Navigation */}
          <aside className="w-64 shrink-0 h-full border-r border-border/80 bg-sidebar flex flex-col justify-between p-4 overflow-y-auto">
            <div className="flex flex-col gap-6">
              {/* Cloudflare Logo Branding */}
              <div className="flex items-center gap-3 px-2 py-1">
                <AppIcon className="size-8 border border-primary/20 shadow-sm" priority />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight text-foreground">
                      PLATA
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={ui.handleAddTransaction}
                  className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 shadow-sm cursor-pointer"
                >
                  <Plus data-icon="inline-start" className="size-3.5" />
                  Nuevo Movimiento
                </Button>

                <Button
                  onClick={ui.handleOpenExchange}
                  variant="outline"
                  className="w-full justify-start gap-2 border-border bg-card/60 hover:bg-accent text-foreground font-medium text-xs h-9 cursor-pointer"
                >
                  <ArrowLeftRight data-icon="inline-start" className="size-3.5 text-muted-foreground" />
                  Cambio de Moneda
                </Button>
              </div>

              {/* Nav Groups */}
              <nav className="flex flex-col gap-5 pt-1">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="flex flex-col gap-1">
                    <h3 className="px-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {group.title}
                    </h3>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {group.items.map((item) => {
                        const active = pathname === item.href
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-all ${active
                              ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold pl-2"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.Icon
                                className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"
                                  }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* User Profile & System Status Panel */}
            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 mt-4">
              <div className="flex items-center gap-2.5 px-2 py-1 rounded-md bg-muted/40 border border-border/50">
                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/20 text-primary text-xs font-mono font-bold">
                  {user?.name?.charAt(0) ?? "U"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{user?.name}</p>
                  <p className="truncate text-[10px] font-mono text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 cursor-pointer"
              >
                <LogOut data-icon="inline-start" className="size-3.5" />
                Cerrar Sesión
              </Button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background">
            {/* Cloudflare Top Header Bar */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold tracking-tight text-foreground">
                      {getPageTitle(pathname)}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Consolidated Cloudflare Metric Pill */}
                <div className="flex items-center gap-3 border border-border bg-muted/30 rounded-md px-3.5 py-1.5 font-mono">
                  <div className="flex items-center gap-2 border-r border-border pr-3">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">
                        TOTAL ARS
                      </p>
                      <p className="text-xs font-bold text-foreground tabular-nums">
                        {mask(formatShort(totalsByCurrency.ARS, "ARS"))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">
                        TOTAL USD
                      </p>
                      <p className="text-xs font-bold text-primary tabular-nums">
                        {mask(formatShort(totalsByCurrency.USD, "USD"))}
                      </p>
                    </div>

                    <Button
                      onClick={() => setHidden((h) => !h)}
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      title={hidden ? "Mostrar saldos" : "Ocultar saldos"}
                    >
                      {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <div className="flex-1 p-6">{children}</div>
          </main>
        </div>
      )}

      {/* Shared Dialogs / sheets */}
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
