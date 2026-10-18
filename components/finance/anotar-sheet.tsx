"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeftRight, CalendarRange, ListPlus, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"
import { parseExpenseMessage } from "@/lib/expense-message"
import { dateForDaysAgo, extractRelativeDay, isQuestion } from "@/lib/anotar"
import { formatShort, type Account, type Currency } from "@/lib/finance-data"
import { cn } from "@/lib/utils"
import { useFinance } from "./finance-provider"
import { useUI } from "./ui-context"
import { useCategorySuggestion } from "./use-category-suggestion"
import { useSemanticSearch } from "./use-semantic-search"
import { TransactionList } from "./transaction-list"

type Kind = "expense" | "income"

const DAY_LABEL = ["Hoy", "Ayer", "Anteayer"]

const PANEL_FORM = "anotar-panel"

/**
 * La barra Anotar: una línea para cargar un movimiento o preguntarle al
 * historial.
 *
 * Usa el mismo parser que el bot de Telegram, así "30 lucas super galicia"
 * significa lo mismo en los dos lados. La app no guarda nada hasta que el
 * usuario confirma: lo que muestra es cómo lo entendió, y cada pieza se puede
 * corregir antes de guardar.
 */
export function AnotarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Se arranca de cero cada vez: lo que quedó a medias de la vez anterior es
  // más confuso que útil.
  useEffect(() => {
    if (open) setText("")
  }, [open])

  const question = isQuestion(text)

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-2xl font-extrabold tracking-tight">Anotar</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Escribilo como lo dirías. Si empieza con “cuánto” o “qué”, lo busco en tu historial.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="mt-3">
          {/* El campo pertenece al formulario del panel activo: Enter guarda o busca. */}
          <input
            ref={inputRef}
            form={PANEL_FORM}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint={question ? "search" : "done"}
            placeholder="30 lucas super galicia"
            aria-label="Anotar un movimiento o hacer una pregunta"
            className="w-full rounded-2xl border-2 border-foreground bg-card px-4 py-3.5 text-lg font-semibold shadow-md outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-lime"
          />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            entiendo lucas · k · palos · “ayer” · nombre de la cuenta
          </p>
        </div>

        {text.trim() === "" ? (
          <Starters onPick={(value) => {
            setText(value)
            inputRef.current?.focus()
          }} />
        ) : question ? (
          <QuestionPanel query={text} onClose={onClose} />
        ) : (
          <ExpensePanel text={text} onSaved={onClose} />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

/** Ejemplos con las cuentas reales del usuario: enseñan la sintaxis sin manual. */
function Starters({ onPick }: { onPick: (value: string) => void }) {
  const { accounts } = useFinance()
  const ui = useUI()
  const first = shortAccountName(accounts[0])
  const second = shortAccountName(accounts[1] ?? accounts[0])

  const examples = [
    first && `30 lucas super ${first}`,
    second && `nafta 52k ${second} ayer`,
    "cuánto gasté en el super este mes",
  ].filter((v): v is string => Boolean(v))

  return (
    <div className="mt-5 space-y-4">
      <div>
        <p className="text-sm font-extrabold">Probá con</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onPick(example)}
              className="cursor-pointer rounded-full border-2 border-foreground bg-card px-3 py-1 text-xs font-semibold transition-colors hover:bg-lime hover:text-ink"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => { ui.handleCloseAnotar(); ui.handleAddTransaction() }}>
          <ListPlus />
          Formulario completo
        </Button>
        <Button type="button" variant="outline" onClick={() => { ui.handleCloseAnotar(); ui.handleOpenExchange() }}>
          <ArrowLeftRight />
          Cambio de moneda
        </Button>
      </div>
    </div>
  )
}

function shortAccountName(account?: Account): string {
  return account ? account.name.toLowerCase().split(" ")[0] : ""
}

function ExpensePanel({ text, onSaved }: { text: string; onSaved: () => void }) {
  const { accounts, categories, addTransaction } = useFinance()
  const [kind, setKind] = useState<Kind>("expense")
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null)
  const [pickedCategory, setPickedCategory] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const day = extractRelativeDay(text)
  const parsed = parseExpenseMessage(day.text, accounts)

  const amount = "amount" in parsed ? parsed.amount : null
  const note = "note" in parsed ? parsed.note : ""
  // La cuenta del texto manda; lo elegido a mano sólo cubre lo que el texto no resolvió.
  const account =
    parsed.status === "ok" ? parsed.account : accounts.find((a) => a.id === pickedAccountId)
  const candidates =
    parsed.status === "ambiguous-account" ? parsed.candidates : parsed.status === "no-account" ? accounts : []

  const categoryNames = useMemo(
    () => categories.filter((c) => c.type === kind).map((c) => c.name),
    [categories, kind]
  )
  const { suggestion, loading: suggesting } = useCategorySuggestion({
    note,
    type: kind,
    categories: categoryNames,
    enabled: true,
  })
  const fallbackCategory = categoryNames.find((c) => c === "Otros") ?? categoryNames[0] ?? ""
  const category =
    (pickedCategory && categoryNames.includes(pickedCategory) ? pickedCategory : null) ??
    suggestion?.category ??
    fallbackCategory

  const currency: Currency | undefined = account?.currency
  const exceeds = kind === "expense" && account && amount !== null && amount > account.balance
  const canSave = Boolean(amount && account && category && !exceeds && !saving)

  async function save() {
    if (!canSave || !account || amount === null) return
    setSaving(true)
    try {
      await addTransaction({
        type: kind,
        amount,
        accountId: account.id,
        category,
        note: note || undefined,
        date: dateForDaysAgo(day.daysAgo).toISOString(),
      })
      toast.success("Listo, anotado.", {
        description: `${formatShort(amount, account.currency)} · ${category} · ${account.name}`,
      })
      onSaved()
    } catch (err) {
      toast.error((err as Error).message || "No pude guardarlo. Probá de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  const message =
    parsed.status === "no-amount"
      ? "No encontré el monto. Probá con “30 lucas” o “4500”."
      : parsed.status === "invalid-amount"
      ? `“${parsed.raw}” no me cierra como monto.`
      : null

  return (
    <form
      id={PANEL_FORM}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="mt-5 rounded-2xl border-2 border-foreground bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lo entendí así
        </p>
        <div className="inline-flex overflow-hidden rounded-full border-2 border-foreground" role="group" aria-label="Tipo">
          {(["expense", "income"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value)
                setPickedCategory(null)
              }}
              className={cn(
                "cursor-pointer px-2.5 py-0.5 font-mono text-[11px] font-semibold",
                kind === value ? "bg-foreground text-background" : "bg-card"
              )}
            >
              {value === "expense" ? "gasto" : "ingreso"}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <p className="mt-3 text-sm">{message}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="monto" tone={amount ? "coral" : "missing"}>
            {amount !== null
              ? `${kind === "expense" ? "−" : "+"}${currency ? formatShort(amount, currency) : amount.toLocaleString("es-AR")}`
              : "¿cuánto?"}
          </Chip>
          <Chip label="cuenta" tone={account ? "plain" : "missing"}>
            {account?.name ?? (parsed.status === "ambiguous-account" ? "¿cuál de estas?" : "¿con cuál?")}
          </Chip>
          <Chip label="categoría" tone="plain">
            {suggesting && !pickedCategory ? "pensando…" : category || "—"}
          </Chip>
          <Chip label="cuándo" tone="plain">
            {DAY_LABEL[day.daysAgo] ?? "Hoy"}
          </Chip>
          {note && (
            <Chip label="nota" tone="plain">
              {note}
            </Chip>
          )}
        </div>
      )}

      {!account && candidates.length > 0 && amount !== null && (
        <OptionRow label="Cuenta">
          {candidates.map((a) => (
            <Option key={a.id} active={pickedAccountId === a.id} onClick={() => setPickedAccountId(a.id)}>
              {a.name}
            </Option>
          ))}
        </OptionRow>
      )}

      {amount !== null && categoryNames.length > 0 && (
        <OptionRow label="Categoría">
          {categoryNames.map((name) => (
            <Option key={name} active={name === category} onClick={() => setPickedCategory(name)}>
              {name}
            </Option>
          ))}
        </OptionRow>
      )}

      {account && amount !== null && (
        <p className={cn("mt-3 text-sm", exceeds ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {exceeds
            ? `En ${account.name} hay ${formatShort(account.balance, account.currency)}: no alcanza.`
            : (
              <>
                {account.name} queda en{" "}
                <b className="text-foreground">
                  {formatShort(account.balance + (kind === "expense" ? -amount : amount), account.currency)}
                </b>
              </>
            )}
        </p>
      )}

      <Button type="submit" size="lg" disabled={!canSave} className="mt-4 h-11 w-full text-base font-extrabold">
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  )
}

function QuestionPanel({ query, onClose }: { query: string; onClose: () => void }) {
  const router = useRouter()
  const ui = useUI()
  const { user, transactions, accounts, vehicles } = useFinance()
  const { result, search, searching, sync, syncing, pending, available } = useSemanticSearch({
    uid: user?.uid,
    transactions,
    accounts,
    vehicles: vehicles ?? [],
  })

  // Si se borró la pregunta y se escribió otra, la respuesta vieja ya no aplica.
  const [askedFor, setAskedFor] = useState<string | null>(null)
  const answered = result && askedFor === query

  return (
    <form
      id={PANEL_FORM}
      onSubmit={(e) => {
        e.preventDefault()
        setAskedFor(query)
        void search(query)
      }}
      className="mt-5 rounded-2xl border-2 border-foreground bg-card p-4"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Es una pregunta · busco en tu historial
      </p>

      {!answered ? (
        <Button type="submit" size="lg" disabled={searching} className="mt-3 h-11 w-full text-base font-extrabold">
          <Search />
          {searching ? "Buscando…" : "Buscar"}
        </Button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border-2 border-foreground bg-sky px-2.5 py-1 text-sm font-bold text-ink">
              {result.transactions.length} {result.transactions.length === 1 ? "movimiento" : "movimientos"}
            </span>
            {result.dateRange && (
              <span className="inline-flex items-center gap-1 rounded-xl border-2 border-foreground bg-sky px-2.5 py-1 text-sm font-bold text-ink">
                <CalendarRange className="size-3.5" />
                {result.dateRange.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(result.totals).map(([currency, total]) => (
              <p key={currency} className="text-3xl font-extrabold tracking-tight">
                {ui.mask(formatShort(total, currency as Currency))}
              </p>
            ))}
          </div>

          {result.transactions.length > 0 && (
            <TransactionList
              transactions={result.transactions.slice(0, 4)}
              onEditTransaction={(tx) => {
                onClose()
                ui.handleEditTransaction(tx)
              }}
            />
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onClose()
              router.push(`/search?q=${encodeURIComponent(query)}`)
            }}
          >
            Ver todo en Búsqueda
          </Button>
        </div>
      )}

      {!available && (
        <p className="mt-3 text-xs text-muted-foreground">
          La búsqueda semántica no responde en este entorno; el filtro por fecha sigue funcionando.
        </p>
      )}
      {available && pending > 0 && (
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          <RefreshCw className={cn("size-3", syncing && "animate-spin")} />
          {syncing ? "Indexando…" : `${pending} movimientos sin indexar: indexar ahora`}
        </button>
      )}
    </form>
  )
}

function Chip({
  label,
  tone,
  children,
}: {
  label: string
  tone: "coral" | "plain" | "missing"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "max-w-full rounded-xl border-2 px-2.5 py-1.5 text-sm font-semibold",
        tone === "coral" && "border-foreground bg-coral text-ink",
        tone === "plain" && "border-foreground bg-background",
        tone === "missing" && "border-dashed border-foreground/60 text-muted-foreground"
      )}
    >
      <span className={cn("block font-mono text-[10px] font-normal", tone === "coral" ? "text-ink/70" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="block truncate">{children}</span>
    </span>
  )
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold">{label}</p>
      <div className="no-scrollbar -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1">{children}</div>
    </div>
  )
}

function Option({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border-2 border-foreground px-3 py-1 text-xs font-semibold transition-colors",
        active ? "bg-lime text-ink" : "bg-card hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}
