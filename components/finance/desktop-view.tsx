"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Wallet,
  Home,
  ReceiptText,
  User,
  Plus,
  Eye,
  EyeOff,
  LogOut,
  CreditCard,
  Bell,
  ShieldCheck,
  CircleHelp,
  ChevronRight,
  ChevronDown,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Paperclip,
  Tag,
  LineChart,
  TrendingUp,
  TrendingDown,
  Briefcase,
  History,
  Trash2,
  Sparkles,
  Bike
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { StockTradeModal } from "./stock-trade-modal"
import { AdvisorView } from "./advisor-view"
import { VehiclesView } from "./vehicles-view"
import { AnalyticsView } from "./analytics-view"
import { toast } from "sonner"
import {
  ACCENT_BY_KIND,
  formatShort,
  formatCurrency,
  type Account,
  type Transaction,
  type Currency,
  type WatchlistStock,
  type StockTransaction,
  type StockHolding
} from "@/lib/finance-data"

type View = "home" | "accounts" | "vehicles" | "stocks" | "activity" | "profile" | "advisor"

interface DesktopViewProps {
  view: View
  setView: (v: View) => void
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
  onAddTransaction: () => void
  onEditTransaction: (tx: Transaction) => void
  onManageCategories: () => void
  onManageSecurity: () => void
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays <= 0) return "Hoy"
  if (diffDays === 1) return "Ayer"
  if (diffDays < 7) return `Hace ${diffDays} días`
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
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
}: DesktopViewProps) {
  const { user, logout, accounts, transactions, totalsByCurrency, getAccount } = useFinance()
  const [hidden, setHidden] = useState(false)

  const mask = (value: string) => (hidden ? "••••••" : value)

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* 1. Sidebar Navigation */}
      <aside className="w-72 shrink-0 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col justify-between p-6">
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

          {/* New Transaction Button */}
          <button
            onClick={onAddTransaction}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <Plus className="size-4.5" />
            Nuevo movimiento
          </button>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {[
              { id: "home", label: "Inicio", Icon: Home },
              { id: "accounts", label: "Cuentas", Icon: Wallet },
              { id: "vehicles", label: "Vehículos", Icon: Bike },
              { id: "advisor", label: "PLATA AI", Icon: Sparkles },
              { id: "stocks", label: "Portafolio", Icon: LineChart },
              { id: "analytics", label: "Análisis", Icon: TrendingUp },
              { id: "activity", label: "Actividad", Icon: ReceiptText },
              { id: "profile", label: "Perfil", Icon: User },
            ].map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as View)}
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
                </button>
              )
            })}

            {/* Category manager trigger */}
            <button
              onClick={onManageCategories}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 group text-left cursor-pointer"
            >
              <Tag className="size-5 text-muted-foreground group-hover:text-foreground group-hover:scale-105 transition-transform" />
              Categorías
            </button>
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

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="border-b border-border/30 bg-card/10 px-8 py-5 flex items-center justify-between gap-6 shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {view === "home" && "Panel de Control"}
              {view === "accounts" && "Mis Cuentas"}
              {view === "vehicles" && "Mis Vehículos"}
              {view === "advisor" && "Asistente AI"}
              {view === "stocks" && "Mi Portafolio"}
              {view === "activity" && "Historial de Actividad"}
              {view === "profile" && "Configuración de Perfil"}
              {view === "analytics" && "Análisis de Gastos"}
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

        {/* Tab Views */}
        <div className="flex-1 p-8">
          {view === "home" && (
            <DesktopHome
              mask={mask}
              onAddAccount={onAddAccount}
              onEditAccount={onEditAccount}
              onEditTransaction={onEditTransaction}
              onSeeAll={() => setView("activity")}
              onSeeAnalytics={() => setView("analytics")}
            />
          )}
          {view === "accounts" && (
            <DesktopAccounts
              mask={mask}
              onAddAccount={onAddAccount}
              onEditAccount={onEditAccount}
            />
          )}
          {view === "vehicles" && (
            <VehiclesView isDesktop />
          )}
          {view === "stocks" && (
            <DesktopPortfolio mask={mask} />
          )}
          {view === "activity" && (
            <DesktopActivity
              onEditTransaction={onEditTransaction}
            />
          )}
          {view === "profile" && (
            <DesktopProfile onManageCategories={onManageCategories} onManageSecurity={onManageSecurity} />
          )}
          {view === "advisor" && (
            <AdvisorView isDesktop />
          )}
          {view === "analytics" && (
            <AnalyticsView isDesktop onBack={() => setView("home")} onEditTransaction={onEditTransaction} />
          )}
        </div>
      </main>
    </div>
  )
}

/* ============================================================================
   SUB-MODULE: DesktopHome
   ============================================================================ */
function DesktopHome({
  mask,
  onAddAccount,
  onEditAccount,
  onEditTransaction,
  onSeeAll,
  onSeeAnalytics,
}: {
  mask: (v: string) => string
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
  onEditTransaction: (tx: Transaction) => void
  onSeeAll: () => void
  onSeeAnalytics: () => void
}) {
  const { accounts, transactions, getAccount, categories } = useFinance()

  const getCategoryColor = (catName: string) => {
    return categories.find((c) => c.name === catName)?.color ?? "var(--chart-5)"
  }

  const recent = useMemo(() => transactions.slice(0, 7), [transactions])

  // Category expense data calculation
  const { chartRows, chartTotal } = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== "expense") continue
      if (getAccount(t.accountId)?.currency !== "ARS") continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    const chartRows = [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const chartTotal = chartRows.reduce((s, r) => s + r.amount, 0)
    return { chartRows, chartTotal }
  }, [transactions, getAccount, accounts])

  const maxVal = chartRows[0]?.amount ?? 1

  return (
    <div className="grid grid-cols-3 gap-8 items-start">
      {/* Left 2 Columns */}
      <div className="col-span-2 flex flex-col gap-8">
        {/* Accounts Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold tracking-tight">Mis Cuentas</h2>
            <button
              onClick={onAddAccount}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <Plus className="size-4" />
              Nueva cuenta
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <article
                key={acc.id}
                onClick={() => onEditAccount(acc)}
                className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-5 flex flex-col justify-between h-36 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 hover:bg-card/65 transition-all duration-300 group"
              >
                {/* Glow Accent */}
                <span
                  aria-hidden
                  className="absolute -right-8 -top-8 size-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"
                  style={{ background: ACCENT_BY_KIND[acc.kind] }}
                />

                <div className="flex items-start justify-between">
                  <span
                    className="flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                    style={{ background: ACCENT_BY_KIND[acc.kind], color: "oklch(0.18 0.02 264)" }}
                  >
                    <AccountIcon kind={acc.kind} className="size-5" />
                  </span>
                  <span className="rounded-lg bg-muted/80 border border-border/20 px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                    {acc.currency}
                  </span>
                </div>

                <div className="mt-4 min-w-0">
                  <p className="truncate text-xs text-muted-foreground font-medium uppercase tracking-wider">{acc.name}</p>
                  <p className="mt-1 text-xl font-bold tracking-tight tabular-nums truncate">
                    {mask(formatShort(acc.balance, acc.currency))}
                  </p>
                </div>
              </article>
            ))}

            <button
              onClick={onAddAccount}
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border/60 hover:border-primary/60 text-muted-foreground hover:text-primary bg-card/10 hover:bg-primary/5 h-36 transition-all duration-200 cursor-pointer"
            >
              <Plus className="size-6" />
              <span className="text-xs font-semibold">Agregar cuenta</span>
            </button>
          </div>
        </section>

        {/* Expenses Chart */}
        <section className="rounded-3xl border border-border/40 bg-card/45 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold tracking-tight">Gastos por categoría</h2>
            <button
              onClick={onSeeAnalytics}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver análisis <ArrowUpRight className="size-3.5" />
            </button>
          </div>
          <p className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground mb-6">
            {mask(formatCurrency(chartTotal, "ARS"))}
          </p>

          {chartRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aún no hay gastos registrados en Pesos ARS.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-8 gap-y-4">
              {chartRows.map((r) => {
                const color = getCategoryColor(r.category)
                return (
                  <li key={r.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: color }}
                        />
                        {r.category}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {mask(formatShort(r.amount, "ARS"))}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((r.amount / maxVal) * 100, 4)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Right Column: Recent Transactions */}
      <section className="rounded-3xl border border-border/40 bg-card/40 p-6 flex flex-col justify-between self-stretch">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-border/20 pb-3">
            <h2 className="text-base font-bold tracking-tight">Actividad Reciente</h2>
            <button onClick={onSeeAll} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
              Ver todo
            </button>
          </div>

          {recent.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay movimientos registrados.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/20">
              {recent.map((tx) => {
                const acc = getAccount(tx.accountId)
                const toAcc = tx.toAccountId ? getAccount(tx.toAccountId) : undefined

                const isIncome = tx.type === "income"
                const isExpense = tx.type === "expense"

                const symbol = isIncome ? "+" : isExpense ? "-" : ""
                const color = isIncome
                  ? "text-primary bg-primary/10"
                  : isExpense
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground bg-muted"

                const signColor = isIncome
                  ? "text-primary"
                  : isExpense
                  ? "text-destructive"
                  : "text-foreground"

                const subtitle =
                  tx.type === "transfer"
                    ? `${acc?.name} → ${toAcc?.name}`
                    : `${tx.category} · ${acc?.name}`

                return (
                  <li
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="flex cursor-pointer items-center gap-3.5 py-3.5 rounded-xl hover:bg-muted/15 transition-all px-2 -mx-2 group"
                  >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105 ${color}`}>
                      {tx.type === "income" && <ArrowDownLeft className="size-5" />}
                      {tx.type === "expense" && <ArrowUpRight className="size-5" />}
                      {tx.type === "transfer" && <ArrowLeftRight className="size-5" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {tx.note || tx.category}
                        {tx.receiptName && <Paperclip className="size-3.5 text-muted-foreground shrink-0" />}
                      </p>
                      <p className="truncate text-xs text-muted-foreground font-medium mt-0.5">{subtitle}</p>
                    </div>

                    <div className="text-right">
                      <p className={`text-sm font-bold tabular-nums ${signColor}`}>
                        {symbol}
                        {mask(formatShort(tx.amount, acc?.currency ?? "ARS"))}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{relativeDate(tx.date)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          onClick={onSeeAll}
          className="w-full mt-6 flex items-center justify-center py-2.5 rounded-xl border border-border/60 hover:bg-muted/50 text-xs font-semibold text-foreground/80 hover:text-foreground transition-all cursor-pointer"
        >
          Ver historial completo
        </button>
      </section>
    </div>
  )
}

/* ============================================================================
   SUB-MODULE: DesktopAccounts
   ============================================================================ */
function DesktopAccounts({
  mask,
  onAddAccount,
  onEditAccount,
}: {
  mask: (v: string) => string
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
}) {
  const { accounts, totalsByCurrency } = useFinance()

  const currencies: { currency: Currency; title: string; subtitle: string; color: string }[] = [
    { currency: "ARS", title: "Cuentas en Pesos (ARS)", subtitle: "Pesos argentinos", color: "from-emerald-500/20" },
    { currency: "USD", title: "Cuentas en Dólares (USD)", subtitle: "Dólares estadounidenses", color: "from-primary/20" },
  ]

  if (accounts.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center border border-border/40 rounded-3xl bg-card/30 p-8 flex flex-col items-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-inner">
          <AccountIcon kind="bank" className="size-7" />
        </div>
        <h3 className="text-lg font-bold">No tenés cuentas creadas</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Registrá tus cuentas bancarias, billeteras digitales o fondos de ahorro para llevar el control.
        </p>
        <button
          onClick={onAddAccount}
          className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 hover:scale-[1.01] transition-transform cursor-pointer"
        >
          Crear mi primera cuenta
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-8 items-start">
      {currencies.map((curr) => {
        const list = accounts.filter((a) => a.currency === curr.currency)
        return (
          <div
            key={curr.currency}
            className="flex flex-col gap-5 border border-border/40 bg-card/25 rounded-3xl p-6"
          >
            {/* Header Column */}
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div>
                <h3 className="text-base font-bold tracking-tight">{curr.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{curr.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Consolidado
                </p>
                <p className={`text-base font-extrabold tabular-nums mt-0.5 ${curr.currency === "USD" ? "text-primary" : ""}`}>
                  {mask(formatShort(totalsByCurrency[curr.currency], curr.currency))}
                </p>
              </div>
            </div>

            {/* List */}
            {list.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border/40 rounded-2xl bg-card/10">
                Sin cuentas en esta moneda.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {list.map((acc) => (
                  <li
                    key={acc.id}
                    onClick={() => onEditAccount(acc)}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/30 bg-card/45 p-4.5 hover:bg-card/75 hover:border-border/50 hover:shadow-md hover:shadow-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105"
                        style={{ background: ACCENT_BY_KIND[acc.kind], color: "oklch(0.18 0.02 264)" }}
                      >
                        <AccountIcon kind={acc.kind} className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{acc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider capitalize mt-0.5">
                          {acc.kind}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums">
                        {mask(formatShort(acc.balance, acc.currency))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={onAddAccount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border/60 hover:border-primary/60 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              Nueva cuenta {curr.currency}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================================
   SUB-MODULE: DesktopActivity
   ============================================================================ */
type TypeFilter = "all" | "income" | "expense" | "transfer"
type DateFilter = "all" | "today" | "week" | "month"

function DesktopActivity({
  onEditTransaction,
}: {
  onEditTransaction: (tx: Transaction) => void
}) {
  const { transactions, accounts, getAccount } = useFinance()

  // Filter States
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<TypeFilter>("all")
  const [filterAccount, setFilterAccount] = useState<string>("all")
  const [filterDate, setFilterDate] = useState<DateFilter>("all")

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    const now = Date.now()
    return transactions.filter((t) => {
      // Search text match
      if (search.trim() !== "") {
        const queryText = search.toLowerCase()
        const noteMatch = t.note?.toLowerCase().includes(queryText) ?? false
        const categoryMatch = t.category.toLowerCase().includes(queryText)
        if (!noteMatch && !categoryMatch) return false
      }

      // Type filter
      if (filterType !== "all" && t.type !== filterType) return false

      // Account filter
      if (filterAccount !== "all" && t.accountId !== filterAccount && t.toAccountId !== filterAccount)
        return false

      // Date range filter
      if (filterDate !== "all") {
        const ageDays = (now - new Date(t.date).getTime()) / 86400000
        if (filterDate === "today" && ageDays > 1) return false
        if (filterDate === "week" && ageDays > 7) return false
        if (filterDate === "month" && ageDays > 31) return false
      }

      return true
    })
  }, [transactions, search, filterType, filterAccount, filterDate])

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in-50 duration-300">
      {/* Search & Filters Header */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between w-full">
        {/* Search Input */}
        <div className="flex-1 min-w-[280px] flex items-center gap-3 bg-card/45 border border-border/40 rounded-2xl px-4 py-3.5 shadow-sm">
          <Search className="size-4.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción o categoría..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TypeFilter)}
              className="appearance-none rounded-2xl border border-border/40 bg-card/45 pl-4 pr-10 py-3.5 text-xs font-semibold outline-none focus:border-ring cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="all">Todos los tipos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
              <option value="transfer">Transferencias</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Account Filter */}
          <div className="relative">
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="appearance-none rounded-2xl border border-border/40 bg-card/45 pl-4 pr-10 py-3.5 text-xs font-semibold outline-none focus:border-ring cursor-pointer hover:bg-muted/50 transition-colors max-w-[180px] truncate"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as DateFilter)}
              className="appearance-none rounded-2xl border border-border/40 bg-card/45 pl-4 pr-10 py-3.5 text-xs font-semibold outline-none focus:border-ring cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="all">Todo el tiempo</option>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Clear Button */}
          {(filterType !== "all" || filterAccount !== "all" || filterDate !== "all" || search !== "") && (
            <button
              onClick={() => {
                setSearch("")
                setFilterType("all")
                setFilterAccount("all")
                setFilterDate("all")
              }}
              className="px-4 py-3.5 text-xs font-bold text-destructive bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground rounded-2xl transition-all cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Ledger Container */}
      <div className="border border-border/40 bg-card/25 rounded-3xl p-5 shadow-sm min-h-[500px] w-full">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24">
            <p className="text-sm font-semibold text-muted-foreground">
              No se encontraron movimientos.
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Probá cambiando los términos de búsqueda o removiendo algún filtro.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border/20">
            {filteredTransactions.map((tx) => {
              const acc = getAccount(tx.accountId)
              const toAcc = tx.toAccountId ? getAccount(tx.toAccountId) : undefined

              const isIncome = tx.type === "income"
              const isExpense = tx.type === "expense"

              const symbol = isIncome ? "+" : isExpense ? "-" : ""
              const color = isIncome
                ? "text-primary bg-primary/10"
                : isExpense
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground bg-muted"

              const signColor = isIncome
                ? "text-primary"
                : isExpense
                ? "text-destructive"
                : "text-foreground"

              const subtitle =
                tx.type === "transfer"
                  ? `${acc?.name} → ${toAcc?.name}`
                  : `${tx.category} · ${acc?.name}`

              return (
                <li
                  key={tx.id}
                  onClick={() => onEditTransaction(tx)}
                  className="flex cursor-pointer items-center justify-between gap-4 py-4 px-2 hover:bg-muted/15 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105 ${color}`}>
                      {tx.type === "income" && <ArrowDownLeft className="size-5.5" />}
                      {tx.type === "expense" && <ArrowUpRight className="size-5.5" />}
                      {tx.type === "transfer" && <ArrowLeftRight className="size-5.5" />}
                    </span>

                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground truncate">
                        {tx.note || tx.category}
                        {tx.receiptName && <Paperclip className="size-4 text-muted-foreground shrink-0" />}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{subtitle}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-base font-extrabold tabular-nums ${signColor}`}>
                      {symbol}
                      {formatShort(tx.amount, acc?.currency ?? "ARS")}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                      {relativeDate(tx.date)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   SUB-MODULE: DesktopProfile
   ============================================================================ */
function DesktopProfile({
  onManageCategories,
  onManageSecurity,
}: {
  onManageCategories: () => void
  onManageSecurity: () => void
}) {
  const { user, logout, accounts, transactions, totalsByCurrency } = useFinance()

  const menuItems = [
    { Icon: Tag, label: "Categorías de movimientos", desc: "Personalizá tus carpetas de ingresos y gastos", onClick: onManageCategories },
    { Icon: CreditCard, label: "Cuentas y tarjetas", desc: "Administrá tus fuentes y métodos de pago" },
    { Icon: Bell, label: "Notificaciones", desc: "Configurá alertas de vencimiento e informes" },
    { Icon: ShieldCheck, label: "Seguridad", desc: "Cambiar contraseña, claves y accesos biométricos", onClick: onManageSecurity },
    { Icon: CircleHelp, label: "Ayuda", desc: "Contactar a soporte y tutoriales de uso" },
  ]

  return (
    <div className="grid grid-cols-3 gap-8 items-start">
      {/* Left Column: User details card */}
      <div className="col-span-1 flex flex-col gap-6">
        <section className="border border-border/40 bg-card/25 rounded-3xl p-6 text-center flex flex-col items-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground text-3xl font-extrabold shadow-lg shadow-primary/20 mb-4">
            {user?.name?.charAt(0) ?? "U"}
          </span>
          <h3 className="text-lg font-bold tracking-tight text-foreground">{user?.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{user?.email}</p>

          <button
            onClick={logout}
            className="w-full mt-6 py-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs font-semibold transition-all duration-200 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </section>

        {/* Database Quick Stats */}
        <section className="border border-border/40 bg-card/25 rounded-3xl p-5 flex flex-col gap-4">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20 pb-2">
            Métricas de cuenta
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border/30 bg-card/30 rounded-2xl p-4 text-center">
              <p className="text-xl font-bold tabular-nums">{accounts.length}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">Cuentas</p>
            </div>
            <div className="border border-border/30 bg-card/30 rounded-2xl p-4 text-center">
              <p className="text-xl font-bold tabular-nums">{transactions.length}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">Movimientos</p>
            </div>
          </div>
          <div className="border border-border/30 bg-card/30 rounded-2xl p-4 text-center">
            <p className="text-base font-bold tabular-nums text-primary">
              {formatShort(totalsByCurrency.USD, "USD")}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">Patrimonio consolidado USD</p>
          </div>
        </section>
      </div>

      {/* Right 2 Columns: Settings options list */}
      <section className="col-span-2 border border-border/40 bg-card/25 rounded-3xl p-6">
        <h3 className="text-base font-bold tracking-tight mb-5">Preferencias</h3>
        <ul className="flex flex-col border border-border/30 bg-card/45 rounded-2xl overflow-hidden divide-y divide-border/25">
          {menuItems.map((item) => (
            <li key={item.label}>
              <button
                onClick={item.onClick}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/20 transition-colors group cursor-pointer"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                  <item.Icon className="size-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-muted-foreground font-medium">PLATA · Demostración PWA v1.0</p>
          <p className="text-[9px] text-muted-foreground/60 mt-0.5">Conexión de base de datos segura y en tiempo real vía Firebase Firestore</p>
        </div>
      </section>
    </div>
  )
}

/* ============================================================================
   SUB-MODULE: DesktopPortfolio
   ============================================================================ */
function DesktopPortfolio({ mask }: { mask: (v: string) => string }) {
  const {
    watchlist,
    stockTransactions,
    stockPrices,
    holdings,
    portfolioTotalValue,
    portfolioTotalProfitLoss,
    portfolioTotalProfitLossPercent,
    addWatchlistStock,
    removeWatchlistStock,
    accounts,
  } = useFinance()

  const [searchSymbol, setSearchSymbol] = useState("")
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeSymbol, setTradeSymbol] = useState("")
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy")
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false)
  const [recommendations, setRecommendations] = useState<{ symbol: string; name: string }[]>([])

  // Fetch symbol recommendations with 200ms debounce
  useEffect(() => {
    const query = searchSymbol.trim()
    if (query.length < 1) {
      setRecommendations([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const list = await res.json()
          setRecommendations(list)
        }
      } catch (err) {
        console.error("Error searching stock symbols:", err)
      }
    }, 200)

    return () => clearTimeout(delayDebounce)
  }, [searchSymbol])

  async function handleAddWatchlist(e: React.FormEvent) {
    e.preventDefault()
    const sym = searchSymbol.trim().toUpperCase()
    if (!sym) return

    setIsAddingWatchlist(true)
    try {
      await addWatchlistStock(sym)
      toast.success(`${sym} agregado a la lista de seguimiento.`)
      setSearchSymbol("")
    } catch (err: any) {
      toast.error(err.message || "Error al buscar ticker.")
    } finally {
      setIsAddingWatchlist(false)
    }
  }

  async function handleRemoveWatchlist(sym: string) {
    try {
      await removeWatchlistStock(sym)
      toast.success(`${sym} removido de la lista de seguimiento.`)
    } catch (err: any) {
      toast.error("Error al remover de la lista.")
    }
  }

  function handleOpenTrade(sym: string, type: "buy" | "sell") {
    setTradeSymbol(sym)
    setTradeType(type)
    setTradeOpen(true)
  }

  const hasUSDAccount = accounts.some((a) => a.currency === "USD")

  return (
    <div className="grid grid-cols-3 gap-8 items-start">
      {/* Left 2 Columns: Holdings and Transaction History */}
      <div className="col-span-2 flex flex-col gap-8">
        {/* Portfolio Value Summary Card */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/45 p-6 shadow-sm flex items-center justify-between">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 size-44 rounded-full bg-primary/10 blur-3xl pointer-events-none"
          />

          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
              Valor Total Portafolio Acciones
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight tabular-nums mt-1.5 text-foreground">
              {mask(formatShort(portfolioTotalValue, "USD"))}
            </h2>
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold leading-none ${
                  portfolioTotalProfitLoss >= 0
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                {portfolioTotalProfitLoss >= 0 ? "+" : ""}
                {mask(formatShort(portfolioTotalProfitLoss, "USD"))} ({portfolioTotalProfitLossPercent}%)
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Ganancia / Pérdida total
              </span>
            </div>
          </div>

          <div className="flex gap-3 relative z-10">
            <button
              onClick={() => handleOpenTrade("", "buy")}
              disabled={!hasUSDAccount}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Plus className="size-4" />
              Nueva Operación
            </button>
          </div>
        </section>

        {!hasUSDAccount && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-500 leading-relaxed">
            ⚠️ <strong>Sin cuenta de USD:</strong> Para comprar o vender acciones necesitás tener al menos una cuenta en
            Dólares (USD). Podés crear una haciendo click en "Mis Cuentas".
          </div>
        )}

        {/* Holdings Card */}
        <section className="rounded-3xl border border-border/40 bg-card/45 p-6 shadow-sm">
          <h3 className="text-base font-bold tracking-tight mb-4">Mis Tenencias</h3>

          {holdings.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No tenés acciones en tu cartera.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Registrá compras de acciones usando el botón de arriba.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="pb-3 pt-1">Ticker</th>
                    <th className="pb-3 pt-1">Empresa</th>
                    <th className="pb-3 pt-1 text-right">Acciones</th>
                    <th className="pb-3 pt-1 text-right">P. Promedio</th>
                    <th className="pb-3 pt-1 text-right">P. Actual</th>
                    <th className="pb-3 pt-1 text-right">Valor Total</th>
                    <th className="pb-3 pt-1 text-right">Rendimiento</th>
                    <th className="pb-3 pt-1 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {holdings.map((h) => (
                    <tr key={h.symbol} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 font-bold text-foreground">{h.symbol}</td>
                      <td className="py-4 text-xs text-muted-foreground truncate max-w-[120px]">{h.name}</td>
                      <td className="py-4 text-right font-medium tabular-nums">{h.shares}</td>
                      <td className="py-4 text-right tabular-nums">{formatShort(h.avgBuyPrice, "USD")}</td>
                      <td className="py-4 text-right font-semibold text-primary tabular-nums">
                        {formatShort(h.currentPrice, "USD")}
                      </td>
                      <td className="py-4 text-right font-bold tabular-nums">
                        {mask(formatShort(h.currentValue, "USD"))}
                      </td>
                      <td
                        className={`py-4 text-right font-bold tabular-nums ${
                          h.profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {h.profitLoss >= 0 ? "+" : ""}
                        {h.profitLossPercent}%
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenTrade(h.symbol, "sell")}
                            className="rounded-lg bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-500 transition-colors cursor-pointer"
                          >
                            Vender
                          </button>
                          <button
                            onClick={() => handleOpenTrade(h.symbol, "buy")}
                            disabled={!hasUSDAccount}
                            className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Comprar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Transaction History Card */}
        <section className="rounded-3xl border border-border/40 bg-card/45 p-6 shadow-sm">
          <h3 className="text-base font-bold tracking-tight mb-4">Historial de Operaciones</h3>

          {stockTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no registraste ninguna operación de acciones.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
              {stockTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between border border-border/30 bg-card/30 rounded-2xl p-4 hover:bg-card/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl text-xs font-bold ${
                        tx.type === "buy" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}
                    >
                      {tx.type === "buy" ? "B" : "S"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{tx.symbol}</span>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                          {tx.type === "buy" ? "Compra" : "Venta"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tx.shares} acciones @ {formatShort(tx.price, "USD")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {tx.type === "buy" ? "-" : "+"}
                      {formatShort(tx.shares * tx.price, "USD")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.date).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right Column: Watchlist */}
      <div className="flex flex-col gap-8">
        <section className="rounded-3xl border border-border/40 bg-card/45 p-6 shadow-sm">
          <h3 className="text-base font-bold tracking-tight mb-4">Lista de Seguimiento</h3>

          {/* Add Ticker Form */}
          <div className="relative mb-5">
            <form onSubmit={handleAddWatchlist} className="relative flex items-center">
              <input
                type="text"
                placeholder="Buscar Ticker (ej. TSLA, NVDA)..."
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="w-full rounded-xl border border-border bg-card pl-10 pr-20 py-2.5 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Search className="absolute left-3.5 size-4 text-muted-foreground" />
              <button
                type="submit"
                disabled={searchSymbol.trim().length === 0 || isAddingWatchlist}
                className="absolute right-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
              >
                {isAddingWatchlist ? "..." : "Agregar"}
              </button>
            </form>

            {/* Recommendations Dropdown */}
            {recommendations.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-lg animate-in fade-in duration-150">
                {recommendations.map((item) => (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      onClick={async () => {
                        setSearchSymbol("")
                        setRecommendations([])
                        setIsAddingWatchlist(true)
                        try {
                          await addWatchlistStock(item.symbol)
                          toast.success(`${item.symbol} (${item.name}) agregado.`)
                        } catch (e: any) {
                          toast.error(e.message || "Error al agregar stock.")
                        } finally {
                          setIsAddingWatchlist(false)
                        }
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left text-xs hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <span className="font-bold text-foreground">{item.symbol}</span>
                      <span className="truncate text-[10px] text-muted-foreground ml-3 max-w-[180px]">
                        {item.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {watchlist.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">Tu lista de seguimiento está vacía.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Ingresá un ticker arriba para monitorear su precio en vivo.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {watchlist.map((w) => {
                const priceInfo = stockPrices[w.symbol] || { price: 0, change: 0, name: w.name }
                const currentPrice = priceInfo.price
                const dailyChange = priceInfo.change
                const isPositive = dailyChange >= 0

                return (
                  <li
                    key={w.symbol}
                    className="flex items-center justify-between border border-border/30 bg-card/30 rounded-2xl p-3.5 hover:bg-card/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleOpenTrade(w.symbol, "buy")}>
                      <p className="text-sm font-bold text-foreground">{w.symbol}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-0.5">{w.name}</p>
                    </div>

                    <div className="text-right px-3">
                      <p className="text-sm font-bold tabular-nums">
                        {currentPrice > 0 ? formatShort(currentPrice, "USD") : "Cargando..."}
                      </p>
                      {currentPrice > 0 && (
                        <p className={`text-[10px] font-bold mt-0.5 ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                          {isPositive ? "+" : ""}
                          {dailyChange.toFixed(2)}%
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pl-2 border-l border-border/20">
                      <button
                        onClick={() => handleOpenTrade(w.symbol, "buy")}
                        disabled={!hasUSDAccount}
                        className="rounded-lg bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary transition-all disabled:opacity-50 cursor-pointer"
                        title="Comprar"
                      >
                        Comprar
                      </button>
                      <button
                        onClick={() => handleRemoveWatchlist(w.symbol)}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Remover de seguimiento"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Trade Modal */}
      <StockTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        prefilledSymbol={tradeSymbol}
        prefilledType={tradeType}
      />
    </div>
  )
}
