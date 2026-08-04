"use client"

import { useState } from "react"
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
  Globe,
  Target,
  LayoutGrid,
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { HomeView } from "./home-view"
import { AccountsView } from "./accounts-view"
import { ActivityView } from "./activity-view"
import { ProfileView } from "./profile-view"
import { StocksView } from "./stocks-view"
import { VehiclesView } from "./vehicles-view"
import { AdvisorView } from "./advisor-view"
import { AnalyticsView } from "./analytics-view"
import { MoreView } from "./more-view"
import { ProjectionsView } from "./projections-view"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatShort, type Account, type Transaction } from "@/lib/finance-data"

export type DesktopViewType =
  | "home"
  | "accounts"
  | "vehicles"
  | "stocks"
  | "activity"
  | "profile"
  | "advisor"
  | "analytics"
  | "projections"
  | "more"

interface DesktopViewProps {
  view: DesktopViewType | string
  setView: (v: any) => void
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
  onAddTransaction: () => void
  onEditTransaction: (tx: Transaction) => void
  onManageCategories: () => void
  onManageSecurity: () => void
  onOpenExchange: () => void
  onOpenExport?: () => void
}

export function DesktopView({
  view,
  setView,
  onAddAccount,
  onEditAccount,
  onAddTransaction,
  onEditTransaction,
  onManageCategories,
  onManageSecurity,
  onOpenExchange,
  onOpenExport,
}: DesktopViewProps) {
  const { user, logout, totalsByCurrency } = useFinance()
  const [hidden, setHidden] = useState(false)

  const mask = (value: string) => (hidden ? "••••••" : value)

  const navItems = [
    { id: "home", label: "Overview", Icon: Home },
    { id: "accounts", label: "Cuentas", Icon: Wallet },
    { id: "vehicles", label: "Vehículos", Icon: Bike },
    { id: "advisor", label: "PLATA AI", Icon: Sparkles, badge: "AI" },
    { id: "stocks", label: "Portafolio", Icon: LineChart },
    { id: "projections", label: "Proyecciones", Icon: Target },
    { id: "analytics", label: "Análisis", Icon: TrendingUp },
    { id: "activity", label: "Actividad", Icon: ReceiptText },
    { id: "profile", label: "Perfil & Ajustes", Icon: User },
    { id: "more", label: "Herramientas", Icon: LayoutGrid },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <aside className="w-64 shrink-0 h-full border-r border-border bg-sidebar flex flex-col justify-between p-4 overflow-y-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 px-2 py-1">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold shadow-sm">
              <Globe className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">PLATA</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/40 text-primary font-mono leading-none">CLOUD</Badge>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Personal Finance</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={onAddTransaction} className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 shadow-sm cursor-pointer">
              <Plus className="size-3.5" /> Nuevo Movimiento
            </Button>
            <Button onClick={onOpenExchange} variant="outline" className="w-full justify-start gap-2 border-border bg-card/60 hover:bg-accent text-foreground font-medium text-xs h-9 cursor-pointer">
              <ArrowLeftRight className="size-3.5 text-muted-foreground" /> Cambio de Moneda
            </Button>
          </div>
          <nav className="flex flex-col gap-1 pt-1 font-sans">
            <p className="px-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">DASHBOARD SERVICES</p>
            {navItems.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                    active ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold pl-2" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <item.Icon className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono bg-primary/20 text-primary">{item.badge}</Badge>}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 mt-4 font-sans">
          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md bg-muted/40 border border-border/50">
            <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/20 text-primary text-xs font-mono font-bold">{user?.name?.charAt(0) ?? "U"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-[10px] font-mono text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button onClick={logout} variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 cursor-pointer">
            <LogOut className="size-3.5" /> Cerrar Sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background">
        <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {view === "home" && "Overview Dashboard"}
                {view === "accounts" && "Mis Cuentas & Activos"}
                {view === "vehicles" && "Mis Vehículos & Flota"}
                {view === "advisor" && "Workers AI Advisor"}
                {view === "stocks" && "Portafolio de Inversiones"}
                {view === "projections" && "Proyección Financiera"}
                {view === "activity" && "Historial de Eventos"}
                {view === "profile" && "Configuración de Cuenta"}
                {view === "analytics" && "Análisis & Métricas"}
                {view === "more" && "Herramientas & Secciones"}
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">Workspace: Personal</Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border border-border bg-muted/30 rounded-md px-3.5 py-1.5 font-mono">
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <p className="text-[9px] text-muted-foreground uppercase font-semibold">ARS</p>
                <p className="text-xs font-bold text-foreground">{mask(formatShort(totalsByCurrency.ARS, "ARS"))}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[9px] text-muted-foreground uppercase font-semibold">USD</p>
                <p className="text-xs font-bold text-primary">{mask(formatShort(totalsByCurrency.USD, "USD"))}</p>
                <Button onClick={() => setHidden((h) => !h)} variant="ghost" size="icon" className="size-7 rounded text-muted-foreground hover:bg-muted cursor-pointer">
                  {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 py-6">
          {view === "home" && (
            <HomeView
              onAddAccount={onAddAccount}
              onSeeAll={() => setView("activity")}
              onSeeAnalytics={() => setView("analytics")}
              onEditTransaction={onEditTransaction}
              onOpenExchange={onOpenExchange}
            />
          )}

          {view === "accounts" && (
            <AccountsView onAddAccount={onAddAccount} onEditAccount={onEditAccount} />
          )}

          {view === "vehicles" && (
            <VehiclesView onBack={() => setView("home")} />
          )}

          {view === "stocks" && (
            <StocksView onBack={() => setView("home")} />
          )}

          {view === "projections" && (
            <ProjectionsView isDesktop={true} />
          )}

          {view === "activity" && (
            <ActivityView
              onEditTransaction={onEditTransaction}
              onOpenExport={onOpenExport}
              onBack={() => setView("home")}
            />
          )}

          {view === "profile" && (
            <ProfileView
              onManageCategories={onManageCategories}
              onManageSecurity={onManageSecurity}
              onBack={() => setView("home")}
            />
          )}

          {view === "advisor" && (
            <AdvisorView />
          )}

          {view === "analytics" && (
            <AnalyticsView onBack={() => setView("home")} onEditTransaction={onEditTransaction} />
          )}

          {view === "more" && (
            <MoreView />
          )}
        </div>
      </main>
    </div>
  )
}





