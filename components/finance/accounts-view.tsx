"use client"

import { Plus } from "lucide-react"
import { ACCENT_BY_KIND, formatShort, type Account, type Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"

export function AccountsView({
  onAddAccount,
  onEditAccount,
}: {
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
}) {
  const { accounts, totalsByCurrency } = useFinance()

  const groups: { currency: Currency; label: string }[] = [
    { currency: "ARS", label: "Pesos argentinos" },
    { currency: "USD", label: "Dólares" },
  ]

  if (accounts.length === 0) {
    return (
      <section className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Cuentas</h1>
          <button
            onClick={onAddAccount}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="size-3.5" />
            Nueva
          </button>
        </div>
        <div className="mt-20 flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AccountIcon kind="bank" className="size-6" />
          </div>
          <p className="text-sm font-medium">No tenés cuentas creadas</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[240px]">
            Agregá una cuenta para empezar a registrar tus ingresos y gastos.
          </p>
          <button
            onClick={onAddAccount}
            className="mt-4 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground"
          >
            Crear cuenta
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Cuentas</h1>
        <button
          onClick={onAddAccount}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" />
          Nueva
        </button>
      </div>

      {groups.map((g) => {
        const list = accounts.filter((a) => a.currency === g.currency)
        if (list.length === 0) return null
        return (
          <div key={g.currency} className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </p>
              <p className="text-xs font-semibold tabular-nums">
                {formatShort(totalsByCurrency[g.currency], g.currency)}
              </p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {list.map((acc) => (
                <li
                  key={acc.id}
                  onClick={() => onEditAccount(acc)}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/30"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{ background: ACCENT_BY_KIND[acc.kind], color: "oklch(0.18 0.02 264)" }}
                  >
                    <AccountIcon kind={acc.kind} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.kind}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatShort(acc.balance, acc.currency)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
