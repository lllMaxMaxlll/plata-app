"use client"

import { useState, useMemo } from "react"
import { Plus, Wallet, Banknote, ArrowLeftRight, Pencil, Landmark, PiggyBank, Bitcoin, type LucideIcon } from "lucide-react"
import { formatShort, type Account, type Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { Button } from "@/components/ui/button"
import { useUI } from "./ui-context"
import { IconTile, pageClass } from "./lucas-ui"
import { cn } from "@/lib/utils"

type FilterKind = "all" | "bank" | "wallet" | "cash" | "savings" | "crypto"

const KIND_LABELS: Record<FilterKind, { label: string }> = {
  all: { label: "Todas" },
  bank: { label: "Bancos" },
  wallet: { label: "Billeteras" },
  cash: { label: "Efectivo" },
  savings: { label: "Ahorro" },
  crypto: { label: "Cripto" },
}

/** Nombre de cada tipo en singular, para la fila de la cuenta. */
const KIND_NAMES: Record<Account["kind"], string> = {
  bank: "Banco",
  wallet: "Billetera",
  cash: "Efectivo",
  savings: "Ahorro",
  crypto: "Cripto",
}

const KIND_ICONS: Record<Account["kind"], LucideIcon> = {
  bank: Landmark,
  wallet: Wallet,
  cash: Banknote,
  savings: PiggyBank,
  crypto: Bitcoin,
}

const KIND_TONES: Record<Account["kind"], string> = {
  bank: "bg-sky",
  wallet: "bg-grape",
  cash: "bg-lime",
  savings: "bg-muted text-foreground",
  crypto: "bg-coral",
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
  const { mask } = ui

  const [selectedKind, setSelectedKind] = useState<FilterKind>("all")

  // Filter accounts by kind
  const filteredAccounts = useMemo(() => {
    if (selectedKind === "all") return accounts
    return accounts.filter((a) => a.kind === selectedKind)
  }, [accounts, selectedKind])

  const groups: { currency: Currency; label: string }[] = [
    { currency: "ARS", label: "En pesos" },
    { currency: "USD", label: "En dólares" },
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
      <div className={pageClass}>
        <PageHeader route="accounts" description="Bancos, billeteras y efectivo." />
        <button
          type="button"
          onClick={onAddAccount}
          className="mx-auto mt-10 flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-lime/25"
        >
          <IconTile Icon={Plus} className="bg-lime" />
          <span className="text-lg font-extrabold">Agregá tu primera cuenta</span>
          <span className="text-sm text-muted-foreground">
            Tu banco, Mercado Pago, Ualá o el efectivo de la billetera. Después Anotar sabe de dónde sale cada gasto.
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={cn(pageClass, "space-y-6")}>
      <PageHeader
        route="accounts"
        description={`${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}`}
        actions={
          <>
            <Button variant="outline" onClick={ui.handleOpenExchange}>
              <ArrowLeftRight className="size-4" />
              Cambio
            </Button>
            <Button onClick={onAddAccount}>
              <Plus className="size-4" />
              Cuenta
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        {groups.map((g) => (
          <section
            key={g.currency}
            className={cn(
              "rounded-3xl border-2 border-border p-4 text-ink shadow-md",
              g.currency === "ARS" ? "bg-lime" : "bg-sky"
            )}
          >
            <p className="text-sm font-bold">{g.label}</p>
            <p className="mt-1 truncate text-2xl font-extrabold tracking-tighter sm:text-3xl">
              {mask(formatShort(totalsByCurrency[g.currency] || 0, g.currency))}
            </p>
            <p className="mt-1 font-mono text-[11px]">
              {accounts.filter((a) => a.currency === g.currency).length} cuentas
            </p>
          </section>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por tipo">
        {(Object.keys(KIND_LABELS) as FilterKind[]).map((kindKey) => {
          const count = kindKey === "all" ? accounts.length : countsByKind[kindKey] || 0
          if (kindKey !== "all" && count === 0) return null
          const active = selectedKind === kindKey
          return (
            <button
              key={kindKey}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedKind(kindKey)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 border-border px-3 py-1 text-xs font-semibold transition-colors",
                active ? "bg-lime text-ink" : "bg-card hover:bg-muted"
              )}
            >
              {KIND_LABELS[kindKey].label}
              <span className="font-mono text-[10px] opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {groups.map((g) => {
          const groupAccounts = filteredAccounts.filter((a) => a.currency === g.currency)
          const totalBalance = totalsByCurrency[g.currency] || 0
          if (groupAccounts.length === 0 && selectedKind !== "all") return null

          return (
            <section key={g.currency}>
              <h2 className="mb-2 text-base font-extrabold tracking-tight">{g.label}</h2>
              {groupAccounts.length > 0 && (
                <ul className="rounded-2xl border-2 border-border bg-card px-3.5 divide-y-[1.5px] divide-dashed divide-foreground/15">
                  {groupAccounts.map((acc) => {
                    const share = totalBalance > 0 ? acc.balance / totalBalance : 0
                    return (
                      <li key={acc.id}>
                        <button
                          type="button"
                          onClick={() => onEditAccount(acc)}
                          aria-label={`Editar cuenta ${acc.name}`}
                          className="-mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-3 rounded-lg px-1.5 py-3 text-left transition-colors hover:bg-lime/20"
                        >
                          <IconTile Icon={KIND_ICONS[acc.kind]} className={KIND_TONES[acc.kind]} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate font-bold">{acc.name}</span>
                              <span className="shrink-0 font-mono text-sm font-semibold">
                                {mask(formatShort(acc.balance, acc.currency))}
                              </span>
                            </span>
                            <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>{KIND_NAMES[acc.kind]}</span>
                              <span className="font-mono text-[11px]">{share > 0 ? `${Math.round(share * 100)}%` : "sin saldo"}</span>
                            </span>
                            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-foreground" style={{ width: `${share * 100}%` }} />
                            </span>
                          </span>
                          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={onAddAccount}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Cuenta en {g.currency === "ARS" ? "pesos" : "dólares"}
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}
