"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Nombre</Label>
          <Input
            value={name}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Banco Galicia"
            className="h-10 text-sm"
          />
          {!account && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {PRESETS.map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="cursor-pointer shrink-0 text-xs hover:bg-accent"
                  onClick={() => !submitting && setName(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Moneda</Label>
          <Tabs value={currency} onValueChange={(val) => setCurrency(val as Currency)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ARS" disabled={submitting}>Pesos (ARS)</TabsTrigger>
              <TabsTrigger value="USD" disabled={submitting}>Dólares (USD)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Tipo</Label>
          <div className="grid grid-cols-5 gap-2">
            {KINDS.map((k) => (
              <Button
                key={k.value}
                type="button"
                variant={kind === k.value ? "default" : "outline"}
                disabled={submitting}
                onClick={() => setKind(k.value)}
                className="flex h-14 flex-col items-center justify-center gap-1 p-1 text-[11px]"
              >
                <AccountIcon kind={k.value} className="size-4" />
                <span>{k.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Saldo inicial</Label>
          <Input
            inputMode="decimal"
            value={balance}
            disabled={submitting}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9.-]/g, ""))}
            placeholder="0"
            className="h-10 text-sm tabular-nums"
          />
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={submitting} className="h-11 w-full font-semibold">
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
              className="h-11 w-full"
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
