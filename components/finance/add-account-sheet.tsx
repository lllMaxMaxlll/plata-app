"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Account, Currency } from "@/lib/finance-data"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { AccountIcon } from "./account-icon"
import { toast } from "sonner"

const KINDS: { value: Account["kind"]; label: string }[] = [
  { value: "bank", label: "Banco" },
  { value: "wallet", label: "Billetera" },
  { value: "cash", label: "Efectivo" },
  { value: "crypto", label: "Crypto" },
  { value: "savings", label: "Ahorro" },
]

const PRESETS = ["Banco Galicia", "Banco Nación", "Mercado Pago", "Ualá", "Brubank", "Efectivo", "Binance", "Colchón"]

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

  // Pre-fill fields if editing an existing account
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
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const parsedBalance = Math.round((parseFloat(balance) || 0) * 100) / 100
      if (account) {
        // Edit mode
        await updateAccount(account.id, {
          name: name.trim(),
          currency,
          kind,
          balance: parsedBalance,
        })
        toast.success(`Cuenta "${name.trim()}" modificada con éxito.`)
      } else {
        // Create mode
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
    const confirmed = window.confirm(`¿Estás seguro de que querés eliminar la cuenta "${account.name}"?\n(Las transacciones registradas no se borrarán)`)
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteAccount(account.id)
      toast.success(`Cuenta "${account.name}" eliminada.`)
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar la cuenta.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={account ? "Editar cuenta" : "Nueva cuenta"}
      description={account ? "Modificá o eliminá esta cuenta." : "Agregá un banco, billetera o ahorro."}
    >
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Nombre</p>
          <input
            value={name}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Banco Galicia"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
          />
          {!account && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={submitting}
                  onClick={() => setName(p)}
                  className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Moneda</p>
          <div className="flex rounded-full bg-muted p-1">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={submitting}
                onClick={() => setCurrency(c)}
                className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                  currency === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                } disabled:opacity-50`}
              >
                {c === "ARS" ? "Pesos (ARS)" : "Dólares (USD)"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipo</p>
          <div className="grid grid-cols-5 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                disabled={submitting}
                onClick={() => setKind(k.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-colors ${
                  kind === k.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
              >
                <AccountIcon kind={k.value} className="size-4" />
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Saldo</p>
          <input
            inputMode="decimal"
            value={balance}
            disabled={submitting}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9.-]/g, ""))}
            placeholder="0"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-ring disabled:opacity-50"
          />
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full rounded-xl text-sm">
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : account ? (
              "Guardar cambios"
            ) : (
              "Crear cuenta"
            )}
          </Button>

          {account && (
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={handleDelete}
              className="h-12 w-full rounded-xl text-sm"
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                "Eliminar cuenta"
              )}
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  )
}
