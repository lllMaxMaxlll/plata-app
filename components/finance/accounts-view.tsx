"use client"

import { useState, useMemo } from "react"
import { Plus, Wallet, Building2, CreditCard, Banknote, ShieldCheck, ArrowLeftRight, Pencil, Coins, Percent } from "lucide-react"
import { ACCENT_BY_KIND, formatShort, formatCurrency, type Account, type Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useUI } from "./ui-context"

type FilterKind = "all" | "bank" | "wallet" | "cash" | "savings" | "crypto"

const KIND_LABELS: Record<FilterKind, { label: string; icon: any }> = {
  all: { label: "Todas", icon: Wallet },
  bank: { label: "Bancos", icon: Building2 },
  wallet: { label: "Billeteras", icon: CreditCard },
  cash: { label: "Efectivo", icon: Banknote },
  savings: { label: "Ahorros/Inversión", icon: ShieldCheck },
  crypto: { label: "Crypto", icon: Coins },
}

export function AccountsView({
  onAddAccount,
  onEditAccount,
}: {
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
}) {
  const { accounts, totalsByCurrency } = useFinance()
  const ui = useUI()

  const [selectedKind, setSelectedKind] = useState<FilterKind>("all")

  // Filter accounts by kind
  const filteredAccounts = useMemo(() => {
    if (selectedKind === "all") return accounts
    return accounts.filter((a) => a.kind === selectedKind)
  }, [accounts, selectedKind])

  const groups: { currency: Currency; label: string; subtitle: string }[] = [
    { currency: "ARS", label: "Cuentas en Pesos (ARS)", subtitle: "Pesos Argentinos" },
    { currency: "USD", label: "Cuentas en Dólares (USD)", subtitle: "Dólares Estadounidenses" },
  ]

  // Count active account types
  const countsByKind = useMemo(() => {
    const counts: Record<string, number> = {}
    accounts.forEach((a) => {
      counts[a.kind] = (counts[a.kind] || 0) + 1
    })
    return counts
  }, [accounts])

  if (accounts.length === 0) {
    return (
      <div className="px-4 sm:px-6 pt-4 pb-12 font-sans max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Wallet className="size-5 text-primary" /> Mis Cuentas
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Administrá tus fuentes y métodos de pago</p>
          </div>
          <Button
            size="sm"
            onClick={onAddAccount}
            className="h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            Nueva Cuenta
          </Button>
        </div>

        <Card className="p-8 text-center border-dashed border-border/80 bg-card/40 flex flex-col items-center justify-center max-w-md mx-auto my-12">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AccountIcon kind="bank" className="size-7 text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground">No tenés cuentas registradas</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Agregá tus cuentas bancarias, billeteras digitales (Mercado Pago, Ualá) o efectivo para organizar tu dinero.
          </p>
          <Button
            onClick={onAddAccount}
            className="mt-5 h-9 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            + Crear Mi Primera Cuenta
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wallet className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Mis Cuentas & Tarjetas
              </h1>
              <p className="text-xs text-muted-foreground">
                {accounts.length} {accounts.length === 1 ? "cuenta activa" : "cuentas activas en total"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={ui.handleOpenExchange}
            className="h-9 text-xs gap-1.5 font-semibold border-border bg-card hover:bg-accent hover:border-primary/40 cursor-pointer shadow-xs flex-1 sm:flex-initial transition-all"
          >
            <ArrowLeftRight className="size-3.5 text-primary" />
            Transferir / Cambio
          </Button>

          <Button
            size="sm"
            onClick={onAddAccount}
            className="h-9 text-xs gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex-1 sm:flex-initial"
          >
            <Plus className="size-3.5" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* 2. Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none font-mono">
        {(Object.keys(KIND_LABELS) as FilterKind[]).map((kindKey) => {
          const { label, icon: Icon } = KIND_LABELS[kindKey]
          const count = kindKey === "all" ? accounts.length : countsByKind[kindKey] || 0
          if (kindKey !== "all" && count === 0) return null // Hide empty category filters

          const isSelected = selectedKind === kindKey

          return (
            <button
              key={kindKey}
              type="button"
              onClick={() => setSelectedKind(kindKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${isSelected
                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                }`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
              <span className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          )
        })}

      </div>

      {/* 3. Account Cards Grid (2 Columns on Desktop for ARS and USD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {groups.map((g) => {
          const groupAccounts = filteredAccounts.filter((a) => a.currency === g.currency)
          const totalBalance = totalsByCurrency[g.currency] || 0

          if (groupAccounts.length === 0 && selectedKind !== "all") {
            return null
          }

          return (
            <Card
              key={g.currency}
              className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{g.label}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground">{g.subtitle}</p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    TOTAL CONSOLIDADO
                  </span>
                  <span className={`text-base font-bold tabular-nums ${g.currency === "USD" ? "text-primary" : "text-foreground"}`}>
                    {formatCurrency(totalBalance, g.currency)}
                  </span>
                </div>
              </div>

              {/* Group Accounts List */}
              {groupAccounts.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border/60 rounded-lg bg-muted/20 font-mono">
                  <p className="text-xs text-muted-foreground">Sin cuentas registradas en {g.currency}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {groupAccounts.map((acc) => {
                    const pctShare = totalBalance > 0 ? (acc.balance / totalBalance) * 100 : 0

                    return (
                      <li key={acc.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Editar cuenta ${acc.name}`}
                          onClick={() => onEditAccount(acc)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onEditAccount(acc)
                            }
                          }}
                          className="group relative flex flex-col p-3.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer shadow-xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-foreground transition-transform group-hover:scale-105 shadow-xs"
                                style={{ background: ACCENT_BY_KIND[acc.kind] + "22", color: ACCENT_BY_KIND[acc.kind] }}
                              >
                                <AccountIcon kind={acc.kind} className="size-5" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                    {acc.name}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0 text-[9px] font-mono uppercase tracking-wider border-border text-muted-foreground"
                                  >
                                    {acc.kind}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {pctShare > 0 ? `${pctShare.toFixed(1)}% del saldo ${acc.currency}` : "Sin saldo"}
                                </p>
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <p className="text-sm font-bold text-foreground tabular-nums">
                                {formatShort(acc.balance, acc.currency)}
                              </p>
                              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                                <Pencil aria-hidden className="size-3" />
                                Editar
                              </span>
                            </div>
                          </div>

                          {/* Share Percentage Bar */}
                          {totalBalance > 0 && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(pctShare, 2)}%`,
                                  background: ACCENT_BY_KIND[acc.kind],
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Add Account Button inside group */}
              <Button
                variant="outline"
                onClick={onAddAccount}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-dashed border-border/80 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary cursor-pointer"
              >
                <Plus className="size-3.5" />
                Agregar Cuenta en {g.currency}
              </Button>

            </Card>

          )
        })}
      </div>
    </div>
  )
}
