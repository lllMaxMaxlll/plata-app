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
  Sparkles,
  Bike,
  CalendarClock
} from "lucide-react"
import { formatShort } from "@/lib/finance-data"

const NAV_ITEMS = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/accounts", label: "Cuentas", Icon: Wallet },
  { href: "/dashboard/vencimientos", label: "Vencimientos", Icon: CalendarClock },
  { href: "/vehicles", label: "Vehículos", Icon: Bike },
  { href: "/advisor", label: "PLATA AI", Icon: Sparkles },
  { href: "/stocks", label: "Portafolio", Icon: LineChart },
  { href: "/analytics", label: "Análisis", Icon: TrendingUp },
  { href: "/activity", label: "Actividad", Icon: ReceiptText },
  { href: "/profile", label: "Perfil", Icon: User },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, totalsByCurrency } = useFinance()
  const ui = useUI()
  const pathname = usePathname()
  const [hidden, setHidden] = useState(false)

  const mask = (value: string) => (hidden ? "••••••" : value)

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!user) {
    return <AuthView />
  }

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/":
        return "Panel de Control"
      case "/accounts":
        return "Mis Cuentas"
      case "/dashboard/vencimientos":
      case "/vencimientos":
        return "Calendario de Vencimientos"
      case "/vehicles":
        return "Mis Vehículos"
      case "/advisor":
        return "Asistente AI"
      case "/stocks":
        return "Mi Portafolio"
      case "/activity":
        return "Historial de Actividad"
      case "/profile":
        return "Configuración de Perfil"
      case "/analytics":
        return "Análisis de Gastos"
      case "/more":
        return "Explorar"
      default:
        return "PLATA"
    }
  }

  return (
    <>
      {/* Mobile View Shell */}
      <div className="md:hidden mx-auto min-h-dvh w-full max-w-md bg-background">
        <main className="pb-28">{children}</main>
        <BottomNav onAdd={ui.handleAddTransaction} />
      </div>

      {/* Desktop View Shell */}
      <div className="hidden md:flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar Navigation */}
        <aside className="w-72 shrink-0 h-full border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col justify-between p-6 overflow-y-auto">
          <div className="flex flex-col gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Wallet className="size-5" />
              </span>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  PLATA
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Finanzas Personales
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={ui.handleAddTransaction}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Plus className="size-4.5" />
              Nuevo movimiento
            </button>

            <button
              onClick={ui.handleOpenExchange}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <ArrowLeftRight className="size-4" />
              Cambio de moneda
            </button>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-200 group text-left ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <item.Icon
                      className={`size-5 transition-transform group-hover:scale-105 ${
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User Card at bottom */}
          <div className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <div className="flex items-center gap-3.5 px-2">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-base font-bold shadow-inner">
                {user?.name?.charAt(0) ?? "U"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Header Bar */}
          <header className="border-b border-border/30 bg-card/10 px-8 py-5 flex items-center justify-between gap-6 shrink-0">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {getPageTitle(pathname)}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hola, <span className="font-medium text-foreground">{user?.name}</span>. Gestioná tus finanzas.
              </p>
            </div>

            <div className="flex items-center gap-6">
              {/* Consolidated Balance Card */}
              <div className="flex items-center gap-4 border border-border/40 bg-card/45 backdrop-blur-md rounded-2xl px-5 py-2.5 shadow-sm">
                <div className="flex items-center gap-2 border-r border-border/40 pr-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                      Total ARS
                    </p>
                    <p className="text-sm font-bold tabular-nums">
                      {mask(formatShort(totalsByCurrency.ARS, "ARS"))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                      Total USD
                    </p>
                    <p className="text-sm font-bold tabular-nums text-primary">
                      {mask(formatShort(totalsByCurrency.USD, "USD"))}
                    </p>
                  </div>
                  <button
                    onClick={() => setHidden((h) => !h)}
                    className="flex size-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto cursor-pointer"
                    title={hidden ? "Mostrar saldos" : "Ocultar saldos"}
                  >
                    {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 p-8">{children}</div>
        </main>
      </div>

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
