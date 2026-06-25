"use client"

import { LogOut, CreditCard, Bell, ShieldCheck, CircleHelp, ChevronRight, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatShort } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"

export function ProfileView({
  onManageCategories,
  onManageSecurity,
}: {
  onManageCategories: () => void
  onManageSecurity: () => void
}) {
  const { user, logout, accounts, transactions, totalsByCurrency } = useFinance()

  const items = [
    { Icon: Tag, label: "Categorías", onClick: onManageCategories },
    { Icon: CreditCard, label: "Cuentas y tarjetas", onClick: () => {} },
    { Icon: Bell, label: "Notificaciones", onClick: () => {} },
    { Icon: ShieldCheck, label: "Seguridad", onClick: onManageSecurity },
    { Icon: CircleHelp, label: "Ayuda", onClick: () => {} },
  ]

  return (
    <section className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="text-xl font-semibold tracking-tight">Perfil</h1>

      <div className="mt-5 flex items-center gap-3.5 rounded-3xl border border-border bg-card p-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {user?.name?.charAt(0) ?? "U"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{user?.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Stat label="Cuentas" value={String(accounts.length)} />
        <Stat label="Movimientos" value={String(transactions.length)} />
        <Stat label="Patrimonio USD" value={formatShort(totalsByCurrency.USD, "USD")} />
      </div>

      <ul className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((item, i) => (
          <li key={item.label}>
            <button
              onClick={item.onClick}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-muted cursor-pointer ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <item.Icon className="size-4.5 text-muted-foreground" />
              <span className="flex-1 font-medium">{item.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>

      <Button
        variant="destructive"
        size="lg"
        onClick={logout}
        className="mt-5 h-12 w-full rounded-xl text-sm"
      >
        <LogOut className="size-4" />
        Cerrar sesión
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">Plata · demo v1.0</p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
