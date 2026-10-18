"use client"

import Link from "next/link"
import { ChevronRight, Download, LogOut, Search, ShieldCheck, Tag, Wallet, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatShort, type Currency } from "@/lib/finance-data"
import { ROUTES } from "@/lib/routes"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { useUI } from "./ui-context"
import { IconTile, pageClass } from "./lucas-ui"
import { Wordmark } from "./app-icon"
import { ThemeToggle } from "./theme-toggle"
import { OptionSelect } from "./option-select"

type Item =
  | { Icon: LucideIcon; label: string; hint: string; tone: string; onClick: () => void }
  | { Icon: LucideIcon; label: string; hint: string; tone: string; href: string }

export function ProfileView({
  onManageCategories,
  onManageSecurity,
}: {
  onManageCategories: () => void
  onManageSecurity: () => void
}) {
  const { user, logout, accounts, transactions, totalsByCurrency } = useFinance()
  const { mask, handleOpenExport } = useUI()

  const items: Item[] = [
    { Icon: Tag, label: "Categorías", hint: "Las que sugiere Anotar", tone: "bg-lime", onClick: onManageCategories },
    { Icon: Wallet, label: ROUTES.accounts.label, hint: "Bancos, billeteras y efectivo", tone: "bg-sky", href: ROUTES.accounts.href },
    { Icon: Search, label: ROUTES.search.label, hint: "Preguntá en tus palabras", tone: "bg-grape", href: ROUTES.search.href },
    { Icon: Download, label: "Exportar", hint: "Excel, PDF o Markdown", tone: "bg-muted text-foreground", onClick: handleOpenExport },
    { Icon: ShieldCheck, label: "Seguridad", hint: "Contraseña y verificación", tone: "bg-muted text-foreground", onClick: onManageSecurity },
  ]

  return (
    <div className={pageClass}>
      <PageHeader route="profile" />

      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="flex items-center gap-3.5 rounded-2xl border-2 border-foreground bg-lime p-4 text-ink shadow-md">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xl font-extrabold">
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{user?.name}</p>
              <p className="truncate font-mono text-xs">{user?.email}</p>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Cuentas" value={String(accounts.length)} />
            <Stat label="Movimientos" value={String(transactions.length)} />
            <Stat label="Dólares" value={mask(formatShort(totalsByCurrency.USD, "USD"))} />
          </div>

          <section className="space-y-3 rounded-2xl border-2 border-foreground bg-card p-4">
            <div>
              <p className="font-bold">Tema</p>
              <p className="text-xs text-muted-foreground">Papel de día, tinta de noche, o lo que diga el sistema.</p>
            </div>
            <ThemeToggle className="w-full" />
          </section>

          <DefaultAccountsSection />
        </div>

        <div className="space-y-5">
          <ul className="overflow-hidden rounded-2xl border-2 border-foreground bg-card">
            {items.map((item) => {
              const content = (
                <>
                  <IconTile Icon={item.Icon} className={item.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </>
              )
              const className =
                "flex w-full cursor-pointer items-center gap-3 border-b-[1.5px] border-dashed border-foreground/15 px-4 py-3 text-left text-sm transition-colors hover:bg-lime/25"
              return (
                <li key={item.label} className="last:[&>*]:border-b-0">
                  {"href" in item ? (
                    <Link href={item.href} className={className}>
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={item.onClick} className={className}>
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <Button variant="destructive" size="lg" onClick={logout} className="h-11 w-full text-sm">
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>

          <p className="flex justify-center text-sm text-muted-foreground">
            <Wordmark />
          </p>
        </div>
      </div>
    </div>
  )
}

const NO_DEFAULT = "none"

/** La cuenta con la que arrancan el formulario, Anotar y el cambio de moneda. */
function DefaultAccountsSection() {
  const { accounts, defaultAccounts, setDefaultAccount } = useFinance()

  return (
    <section className="space-y-3 rounded-2xl border-2 border-foreground bg-card p-4">
      <div>
        <p className="font-bold">Cuentas por defecto</p>
        <p className="text-xs text-muted-foreground">Con estas arranca cada movimiento; las podés cambiar al cargarlo.</p>
      </div>
      {(["ARS", "USD"] as const satisfies readonly Currency[]).map((currency) => {
        const options = accounts.filter((a) => a.currency === currency)
        return (
          <div key={currency} className="flex items-center gap-3">
            <span className="w-10 shrink-0 font-mono text-xs font-semibold">{currency}</span>
            <OptionSelect
              ariaLabel={`Cuenta por defecto en ${currency}`}
              value={defaultAccounts[currency] ?? NO_DEFAULT}
              onValueChange={(value) => setDefaultAccount(currency, value === NO_DEFAULT ? null : value)}
              options={[
                { value: NO_DEFAULT, label: options.length ? "Sin preferencia" : `No tenés cuentas en ${currency}` },
                ...options.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>
        )
      })}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-card p-3 text-center">
      <p className="truncate text-base font-extrabold">{value}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  )
}
