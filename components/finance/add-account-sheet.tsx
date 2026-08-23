"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import type { Account, Currency } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { toast } from "sonner"
import { Wallet, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const KINDS: { value: Account["kind"]; label: string }[] = [
  { value: "bank", label: "Banco" },
  { value: "wallet", label: "Billetera" },
  { value: "cash", label: "Efectivo" },
  { value: "crypto", label: "Crypto" },
  { value: "savings", label: "Ahorro" },
]

const PRESETS = [
  "Banco Galicia",
  "Banco Nación",
  "Mercado Pago",
  "Ualá",
  "Brubank",
  "Efectivo",
  "Binance",
  "Colchón",
]

export function AddAccountSheet({
  open,
  onClose,
  account,
}: {
  open: boolean
  onClose: () => void
  account?: Account | null
}) {
  const { addAccount, updateAccount, deleteAccount } = useFinance()
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [kind, setKind] = useState<Account["kind"]>("bank")
  const [balance, setBalance] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (account) {
        setName(account.name)
        setCurrency(account.currency)
        setKind(account.kind)
        setBalance(String(account.balance))
      } else {
        setName("")
        setCurrency("ARS")
        setKind("bank")
        setBalance("")
      }
    }
  }, [account, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Ingresá un nombre para la cuenta.")
      return
    }

    setSubmitting(true)
    try {
      const parsedBalance = Math.round((parseFloat(balance) || 0) * 100) / 100
      if (account) {
        await updateAccount(account.id, {
          name: name.trim(),
          currency,
          kind,
          balance: parsedBalance,
        })
        toast.success(`Cuenta "${name.trim()}" modificada con éxito.`)
      } else {
        await addAccount({
          name: name.trim(),
          currency,
          kind,
          balance: parsedBalance,
        })
        toast.success(`Cuenta "${name.trim()}" creada con éxito.`)
      }
      setName("")
      setBalance("")
      setCurrency("ARS")
      setKind("bank")
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar la cuenta.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!account) return
    const confirmed = window.confirm(
      `¿Estás seguro de que querés eliminar la cuenta "${account.name}"?\n(Las transacciones registradas no se borrarán)`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteAccount(account.id)
      toast.success(`Cuenta "${account.name}" eliminada.`)
      await new Promise((resolve) => setTimeout(resolve, 350))
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar la cuenta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <ResponsiveDialogContent className="w-full sm:max-w-xl max-w-[calc(100vw-2rem)] h-auto max-h-[90vh] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-200">
        <ResponsiveDialogHeader className="text-left pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </span>
            <div>
              <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                {account ? "Editar Cuenta" : "Nueva Cuenta"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-xs text-muted-foreground">
                {account
                  ? "Modificá la información de tu cuenta o elimínala."
                  : "Agregá un banco, billetera digital, efectivo o ahorro."}
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>

        <div className={cn("transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          <form onSubmit={handleSubmit} className="mt-3 flex min-w-0 flex-col gap-4">
          {/* Nombre de la Cuenta */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nombre de la Cuenta
            </Label>
            <Input
              value={name}
              disabled={submitting}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Banco Galicia, Mercado Pago, Efectivo"
              required
              className="h-10 text-sm rounded-xl border-border bg-card/60"
            />

            {/* Presets rápidos */}
            {!account && (
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto py-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => !submitting && setName(p)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${name === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted border-border/50"
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selector de Moneda */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Moneda
            </Label>
            <Tabs
              value={currency}
              onValueChange={(val) => setCurrency(val as Currency)}
              className="w-full min-w-0"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40 border border-border/50">
                <TabsTrigger
                  value="ARS"
                  disabled={submitting}
                  className="rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Pesos (ARS $)
                </TabsTrigger>
                <TabsTrigger
                  value="USD"
                  disabled={submitting}
                  className="rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Dólares (USD US$)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tipo de Cuenta */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tipo de Cuenta
            </Label>
            <div className="grid w-full grid-cols-3 sm:grid-cols-5 gap-2">
              {KINDS.map((k) => {
                const active = kind === k.value
                return (
                  <button
                    key={k.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => setKind(k.value)}
                    className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl p-2.5 transition-all cursor-pointer border ${active
                      ? "bg-primary/15 border-primary text-primary font-bold shadow-sm"
                      : "bg-card/40 border-border/60 text-muted-foreground hover:bg-card/80 hover:text-foreground"
                      }`}
                  >
                    <AccountIcon kind={k.value} className="size-5 shrink-0" />
                    <span className="text-xs leading-none truncate w-full text-center">
                      {k.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Saldo Inicial */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saldo Actual / Inicial
            </Label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-bold text-muted-foreground">
                {currency === "ARS" ? "$" : "US$"}
              </span>
              <Input
                inputMode="decimal"
                value={balance}
                disabled={submitting}
                onChange={(e) => setBalance(e.target.value.replace(/[^0-9.-]/g, ""))}
                placeholder="0.00"
                className="pl-10 h-11 text-sm font-extrabold tabular-nums rounded-xl border-border bg-card/60"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-3 flex items-center gap-3">
            {account && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={submitting}
                onClick={handleDelete}
                className="rounded-xl shrink-0 h-11 w-11 cursor-pointer"
                title="Eliminar cuenta"
                aria-label="Eliminar cuenta"
              >
                <Trash2 className="size-4" />
              </Button>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="flex-1 rounded-xl h-11 font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer"
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : account ? (
                "Guardar Cambios"
              ) : (
                "Crear Cuenta"
              )}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
