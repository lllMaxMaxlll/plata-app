"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Camera, Check, ChevronRight, Download, LogOut, Pencil, Search, ShieldCheck, Tag, Wallet, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatShort, type Currency } from "@/lib/finance-data"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import { useUI } from "./ui-context"
import { IconTile, pageClass } from "./lucas-ui"
import { Wordmark } from "./app-icon"
import { ThemeToggle } from "./theme-toggle"
import { OptionSelect } from "./option-select"
import { UserAvatar } from "./user-avatar"

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
  const { logout, accounts, transactions, totalsByCurrency } = useFinance()
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
          <ProfileCard />

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

/** Nombre y foto, editables en el lugar. */
function ProfileCard() {
  const { user, updateProfile } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState<"name" | "photo" | null>(null)

  async function run(kind: "name" | "photo", changes: Parameters<typeof updateProfile>[0], done: string) {
    setBusy(kind)
    try {
      await updateProfile(changes)
      toast.success(done)
      if (kind === "name") setEditingName(false)
    } catch (err) {
      toast.error((err as Error).message || "No se pudo guardar el perfil.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex items-center gap-3.5 rounded-2xl border-2 border-foreground bg-lime p-4 text-ink shadow-md">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          aria-label={user?.avatarUrl ? "Cambiar foto de perfil" : "Agregar foto de perfil"}
          className="group relative block cursor-pointer rounded-full focus-visible:ring-3 focus-visible:ring-ink focus-visible:outline-none"
        >
          <UserAvatar user={user} className={cn("size-16 border-ink bg-white text-2xl", busy === "photo" && "opacity-50")} />
          <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-card text-foreground transition-transform group-hover:scale-110">
            <Camera className="size-3.5" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void run("photo", { avatar: file }, "Foto actualizada.")
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        {editingName ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void run("name", { name }, "Nombre actualizado.")
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={60}
              disabled={busy === "name"}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditingName(false)}
              aria-label="Tu nombre"
              className="h-9 min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-2.5 text-base font-extrabold outline-none focus-visible:ring-3 focus-visible:ring-ink/30"
            />
            <button
              type="submit"
              disabled={busy === "name" || !name.trim()}
              aria-label="Guardar nombre"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-ink bg-ink text-lime disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              aria-label="Cancelar"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-ink bg-white"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(user?.name ?? "")
              setEditingName(true)
            }}
            className="group flex max-w-full cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ink focus-visible:outline-none"
            aria-label="Editar nombre"
          >
            <span className="truncate text-lg font-extrabold">{user?.name}</span>
            <Pencil className="size-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <p className="truncate font-mono text-xs">{user?.email}</p>
        {user?.avatarUrl && !editingName && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("photo", { avatar: null }, "Foto quitada.")}
            className="mt-1 cursor-pointer font-mono text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            quitar foto
          </button>
        )}
      </div>
    </section>
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
