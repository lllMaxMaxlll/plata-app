"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  type Account,
  type Currency,
  type Transaction,
  type TransactionType,
  type Category,
  type WatchlistStock,
  type StockTransaction,
  type StockHolding,
  type Vehicle,
  type VehicleLog,
  type DueItem,
  type Goal,
} from "@/lib/finance-data"
import { getApiAuthHeaders, getSupabase } from "@/lib/supabase/client"
import {
  fromAccount,
  fromDueItem,
  fromVehicle,
  toAccount,
  toCategory,
  toDueItem,
  toGoal,
  fromGoal,
  toMacroSettings,
  toProjectionSettings,
  fromProjectionSettings,
  toStockTransaction,
  toTransaction,
  toVehicle,
  toVehicleLog,
  toWatchlistStock,
  vehicleLogExtras,
} from "@/lib/supabase/mappers"

export interface User {
  uid: string
  name: string
  email: string
  emailVerified: boolean
  providerId: string | null
}

export interface NewTransactionInput {
  type: TransactionType
  amount: number
  accountId: string
  toAccountId?: string
  toAmount?: number
  exchangeRate?: number
  category: string
  note?: string
  receiptName?: string
  date?: string
}

export interface MacroSettings {
  exchangeRate: number
  annualInflation: number
  annualDevaluation: number
  annualReturn: number
  lastUpdated: string
  rates?: {
    blue: number
    oficial: number
    mep: number
    ccl: number
  }
}

/** Parámetros del simulador de Proyecciones. Uno por usuario, en user_settings. */
export interface ProjectionSettings {
  horizonMonths: number
  displayCurrency: Currency
  isRealTerms: boolean
  useRealAccounts: boolean
  monthlySavingsARS: number
  monthlySavingsUSD: number
  /**
   * 'auto': el ahorro sale del historial de movimientos y se recalcula solo.
   * 'manual': lo fijó el usuario y la app no lo toca.
   */
  monthlySavingsSource: "auto" | "manual"
  /** null = todavía no lo tocó; la UI cae al saldo real de las cuentas. */
  manualInitialARS: number | null
  manualInitialUSD: number | null
  annualReturnARS: number
  annualReturnUSD: number
}

interface FinanceContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password?: string, isSignUp?: boolean) => Promise<void>
  logout: () => Promise<void>
  sendPasswordResetLink: (email: string) => Promise<void>
  changePassword: (currentPassword?: string, newPassword?: string) => Promise<void>
  sendEmailVerificationLink: () => Promise<void>
  reloadUser: () => Promise<void>

  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]

  addTransaction: (input: NewTransactionInput) => Promise<void>
  updateTransaction: (id: string, input: NewTransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addAccount: (input: Omit<Account, "id">) => Promise<void>
  updateAccount: (id: string, input: Partial<Omit<Account, "id">>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addCategory: (name: string, type: "income" | "expense", color: string) => Promise<void>
  updateCategory: (id: string, name: string, color: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  getAccount: (id: string) => Account | undefined
  totalsByCurrency: Record<Currency, number>

  watchlist: WatchlistStock[]
  stockTransactions: StockTransaction[]
  stockPrices: Record<string, { price: number; change: number; name: string }>
  holdings: StockHolding[]
  portfolioTotalValue: number
  portfolioTotalProfitLoss: number
  portfolioTotalProfitLossPercent: number
  addWatchlistStock: (symbol: string) => Promise<void>
  removeWatchlistStock: (symbol: string) => Promise<void>
  executeStockTransaction: (input: {
    symbol: string
    type: "buy" | "sell"
    shares: number
    price: number
    date: string
    accountId: string
  }) => Promise<void>

  vehicles: Vehicle[]
  vehicleLogs: VehicleLog[]
  addVehicle: (input: Omit<Vehicle, "id" | "createdAt">) => Promise<void>
  updateVehicle: (id: string, input: Partial<Omit<Vehicle, "id" | "createdAt">>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>
  addVehicleLog: (input: Omit<VehicleLog, "id" | "transactionId">) => Promise<void>
  updateVehicleLog: (id: string, input: Omit<VehicleLog, "id">) => Promise<void>
  deleteVehicleLog: (id: string) => Promise<void>

  dueItems: DueItem[]
  addDueItem: (input: Omit<DueItem, "id" | "createdAt">) => Promise<void>
  updateDueItem: (id: string, input: Partial<Omit<DueItem, "id">>) => Promise<void>
  deleteDueItem: (id: string) => Promise<void>
  markDueItemAsPaid: (
    id: string,
    registerTx?: { accountId: string; amount?: number; category?: string; note?: string }
  ) => Promise<void>
  markDueItemAsPending: (id: string) => Promise<void>

  macroSettings: MacroSettings
  /** true una vez que se leyó user_settings; antes, macroSettings son defaults. */
  settingsLoaded: boolean
  /**
   * true cuando ya se leyeron cuentas y movimientos. Sin esto, una pantalla que
   * derive algo de los saldos lo calcula sobre un array vacío y guarda ceros.
   */
  dataLoaded: boolean
  updateMacroSettings: (settings: Partial<MacroSettings>) => Promise<void>
  syncMacroFromApi: () => Promise<MacroSettings>

  projectionSettings: ProjectionSettings
  updateProjectionSettings: (settings: Partial<ProjectionSettings>) => void

  goals: Goal[]
  addGoal: (goal: Omit<Goal, "id" | "priority">) => Promise<void>
  updateGoal: (id: string, changes: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  reorderGoals: (orderedIds: string[]) => Promise<void>
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

const SETTINGS_PERSIST_DELAY_MS = 600

const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
  horizonMonths: 36,
  displayCurrency: "USD",
  isRealTerms: true,
  useRealAccounts: true,
  monthlySavingsARS: 0,
  monthlySavingsUSD: 0,
  monthlySavingsSource: "auto",
  manualInitialARS: null,
  manualInitialUSD: null,
  annualReturnARS: 45,
  annualReturnUSD: 8,
}

const DEFAULT_MACRO_SETTINGS: MacroSettings = {
  exchangeRate: 1250,
  annualInflation: 45,
  annualDevaluation: 40,
  annualReturn: 12,
  lastUpdated: "",
  rates: { blue: 1250, oficial: 980, mep: 1240, ccl: 1255 },
}

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Comida", type: "expense", color: "var(--chart-1)" },
  { name: "Servicios", type: "expense", color: "var(--chart-2)" },
  { name: "Transporte", type: "expense", color: "var(--chart-3)" },
  { name: "Alquiler", type: "expense", color: "var(--chart-4)" },
  { name: "Otros", type: "expense", color: "var(--chart-5)" },
  { name: "Salario", type: "income", color: "oklch(0.76 0.16 156)" },
  { name: "Efectivo", type: "income", color: "oklch(0.78 0.15 75)" },
  { name: "Inversiones", type: "income", color: "oklch(0.7 0.13 230)" },
  { name: "Trabajo Extra", type: "income", color: "oklch(0.66 0.18 350)" },
]

/** Postgres devuelve mensajes útiles; los errores de red no. */
function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

const isJwtError = (error: { message?: string; code?: string } | null) =>
  Boolean(error && (/jwt/i.test(error.message ?? "") || error.code === "PGRST301"))

/**
 * Reintenta una lectura cuando el token es rechazado.
 *
 * El token lo emite GoTrue y lo valida PostgREST: son servicios distintos, y si
 * el que valida va unos segundos atrás, un token recién emitido le parece "del
 * futuro" y lo rechaza. Dura lo que tarda en alinearse, pero sin reintento deja
 * una tabla vacía hasta el próximo evento de realtime — en una app de finanzas,
 * una pantalla a medio cargar es peor que una lenta.
 *
 * Si el token está vencido hay que pedir uno nuevo; si es del futuro, pedir otro
 * lo empeora (vendría con una fecha todavía más adelantada), así que sólo se
 * espera y se reintenta con el mismo.
 */
async function withAuthRetry<T>(
  supabase: ReturnType<typeof getSupabase>,
  run: () => PromiseLike<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const first = await run()
  if (!isJwtError(first.error)) return first

  if (/expired/i.test(first.error?.message ?? "")) {
    await supabase.auth.refreshSession()
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
  return run()
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([])
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([])
  const [stockPrices, setStockPrices] = useState<Record<string, { price: number; change: number; name: string }>>({})
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([])
  const [dueItems, setDueItems] = useState<DueItem[]>([])
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [projectionSettings, setProjectionSettings] = useState<ProjectionSettings>(
    DEFAULT_PROJECTION_SETTINGS
  )
  const [goals, setGoals] = useState<Goal[]>([])

  // Espejo síncrono de las preferencias. La fila que sube a Supabase se arma a
  // partir del estado anterior; leyéndolo del closure, dos cambios seguidos (un
  // slider, por ejemplo) subían el segundo pisando al primero.
  const macroSettingsRef = useRef<MacroSettings>(DEFAULT_MACRO_SETTINGS)
  const projectionSettingsRef = useRef<ProjectionSettings>(DEFAULT_PROJECTION_SETTINGS)

  const applyMacroSettings = useCallback((next: MacroSettings) => {
    macroSettingsRef.current = next
    setMacroSettings(next)
  }, [])

  const applyProjectionSettings = useCallback((next: ProjectionSettings) => {
    projectionSettingsRef.current = next
    setProjectionSettings(next)
  }, [])

  const uid = user?.uid

  // persistSettings corre desde un timer y desde el cleanup del efecto de
  // visibilidad, donde el closure puede estar viejo.
  const uidRef = useRef<string | undefined>(uid)
  useEffect(() => {
    uidRef.current = uid
  }, [uid])

  // ---------------------------------------------------------------------------
  // Autenticación
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let alive = true

    const mapUser = (u: any): User | null => {
      if (!u) return null
      return {
        uid: u.id,
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Usuario",
        email: u.email || "",
        emailVerified: Boolean(u.email_confirmed_at || u.confirmed_at),
        providerId: u.app_metadata?.provider ?? null,
      }
    }

    // getSession() sólo lee lo que hay guardado en el navegador: una sesión
    // revocada, vencida o de un usuario borrado la da por buena. getUser() la
    // valida contra el servidor, que es lo único que sirve para decidir si
    // alguien está realmente adentro.
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!alive) return
      if (error || !data.user) {
        const { data: local } = await supabase.auth.getSession()
        if (local.session) await supabase.auth.signOut()
        if (alive) setUser(null)
      } else {
        setUser(mapUser(data.user))
      }
      if (alive) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      setUser(mapUser(session?.user))
      setLoading(false)

      // El enlace de recuperación crea una sesión válida, así que sin esto el
      // usuario entra a la app y nunca llega a elegir contraseña. Redirigimos
      // acá y no sólo con el redirectTo del mail, porque si la URL no está en la
      // lista de Redirect URLs del proyecto, Supabase la ignora y manda al inicio.
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        if (!window.location.pathname.startsWith("/auth/update-password")) {
          window.location.assign("/auth/update-password")
        }
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  // ---------------------------------------------------------------------------
  // Carga de datos
  //
  // Con un par de cientos de filas, releer una tabla entera cuando cambia sale
  // más barato —y es mucho menos frágil— que reconstruir el estado a partir de
  // los eventos fila por fila. Los saldos, además, salen de una vista: Postgres
  // no publica vistas, así que ante cualquier movimiento hay que releerlos igual.
  // ---------------------------------------------------------------------------

  const loadAccounts = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("account_balances").select("*").order("name")
    )
    if (error) return console.error("No se pudieron leer las cuentas:", error.message)
    setAccounts((data ?? []).map(toAccount))
  }, [supabase])

  const loadTransactions = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("transactions").select("*").order("occurred_at", { ascending: false })
    )
    if (error) return console.error("No se pudieron leer los movimientos:", error.message)
    setTransactions((data ?? []).map(toTransaction))
  }, [supabase])

  const loadCategories = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("categories").select("*").order("name")
    )
    if (error) return console.error("No se pudieron leer las categorías:", error.message)
    setCategories((data ?? []).map(toCategory))
    return data ?? []
  }, [supabase])

  const loadVehicles = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("vehicles").select("*").order("created_at", { ascending: false })
    )
    if (error) return console.error("No se pudieron leer los vehículos:", error.message)
    setVehicles((data ?? []).map(toVehicle))
  }, [supabase])

  const loadVehicleLogs = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("vehicle_logs").select("*").order("occurred_at", { ascending: false })
    )
    if (error) return console.error("No se pudieron leer los registros de vehículo:", error.message)
    setVehicleLogs((data ?? []).map(toVehicleLog))
  }, [supabase])

  const loadDueItems = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("due_items").select("*").order("due_date")
    )
    if (error) return console.error("No se pudieron leer los vencimientos:", error.message)
    setDueItems((data ?? []).map(toDueItem))
  }, [supabase])

  const loadStockTrades = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("stock_trades").select("*").order("occurred_at", { ascending: false })
    )
    if (error) return console.error("No se pudieron leer las operaciones:", error.message)
    setStockTransactions((data ?? []).map(toStockTransaction))
  }, [supabase])

  const loadWatchlist = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("watchlist").select("*").order("symbol")
    )
    if (error) return console.error("No se pudo leer la watchlist:", error.message)
    setWatchlist((data ?? []).map(toWatchlistStock))
  }, [supabase])

  const loadSettings = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("user_settings").select("*").maybeSingle()
    )
    if (error) return console.error("No se pudieron leer las preferencias:", error.message)
    if (data) {
      applyMacroSettings({ ...macroSettingsRef.current, ...toMacroSettings(data) })
      applyProjectionSettings(toProjectionSettings(data))
    }
    setSettingsLoaded(true)
  }, [supabase, applyMacroSettings, applyProjectionSettings])

  const loadGoals = useCallback(async () => {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase
        .from("goals")
        .select("*")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
    )
    if (error) return console.error("No se pudieron leer las metas:", error.message)
    setGoals((data ?? []).map(toGoal))
  }, [supabase])

  // Alta de las categorías por defecto la primera vez
  const seedCategories = useCallback(async () => {
    if (!uid) return
    const { error } = await supabase
      .from("categories")
      .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: uid })))
    if (error) console.error("No se pudieron crear las categorías por defecto:", error.message)
    else await loadCategories()
  }, [supabase, uid, loadCategories])

  useEffect(() => {
    if (!uid) {
      setAccounts([])
      setTransactions([])
      setCategories([])
      setWatchlist([])
      setStockTransactions([])
      setStockPrices({})
      setVehicles([])
      setVehicleLogs([])
      setDueItems([])
      applyMacroSettings(DEFAULT_MACRO_SETTINGS)
      applyProjectionSettings(DEFAULT_PROJECTION_SETTINGS)
      setGoals([])
      setSettingsLoaded(false)
      setDataLoaded(false)
      return
    }

    let alive = true

    Promise.all([
      loadAccounts(),
      loadTransactions(),
      loadCategories(),
      loadVehicles(),
      loadVehicleLogs(),
      loadDueItems(),
      loadStockTrades(),
      loadWatchlist(),
      loadSettings(),
      loadGoals(),
    ]).then((results) => {
      if (!alive) return
      setDataLoaded(true)
      const cats = results[2] as unknown as any[] | undefined
      if (Array.isArray(cats) && cats.length === 0) seedCategories()
    })

    return () => {
      alive = false
    }
  }, [
    uid,
    loadAccounts,
    loadTransactions,
    loadCategories,
    loadVehicles,
    loadVehicleLogs,
    loadDueItems,
    loadStockTrades,
    loadWatchlist,
    loadSettings,
    loadGoals,
    seedCategories,
    applyMacroSettings,
    applyProjectionSettings,
  ])

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!uid) return

    const filter = `user_id=eq.${uid}`
    const on = (table: string, handler: () => void) => ({
      event: "*" as const,
      schema: "public",
      table,
      filter,
      handler,
    })

    // Un movimiento cambia el saldo, que sale de una vista: hay que releer las dos
    const subscriptions = [
      on("accounts", () => void loadAccounts()),
      on("transactions", () => {
        void loadTransactions()
        void loadAccounts()
      }),
      on("categories", () => void loadCategories()),
      on("vehicles", () => void loadVehicles()),
      on("vehicle_logs", () => void loadVehicleLogs()),
      on("due_items", () => void loadDueItems()),
      on("stock_trades", () => {
        void loadStockTrades()
        void loadAccounts()
      }),
      on("watchlist", () => void loadWatchlist()),
      on("user_settings", () => void loadSettings()),
    ]

    let channel = supabase.channel(`plata:${uid}`)
    for (const sub of subscriptions) {
      channel = channel.on(
        "postgres_changes" as any,
        { event: sub.event, schema: sub.schema, table: sub.table, filter: sub.filter },
        sub.handler
      )
    }
    channel.subscribe()

    // El stream puede perder eventos si el dispositivo estuvo dormido o sin red:
    // al volver al foco se relee todo antes de confiar en lo que hay en pantalla.
    const resync = () => {
      if (document.visibilityState !== "visible") return
      void loadAccounts()
      void loadTransactions()
      void loadVehicleLogs()
      void loadDueItems()
      void loadStockTrades()
    }
    document.addEventListener("visibilitychange", resync)

    return () => {
      document.removeEventListener("visibilitychange", resync)
      void supabase.removeChannel(channel)
    }
  }, [
    supabase,
    uid,
    loadAccounts,
    loadTransactions,
    loadCategories,
    loadVehicles,
    loadVehicleLogs,
    loadDueItems,
    loadStockTrades,
    loadWatchlist,
    loadSettings,
  ])

  // ---------------------------------------------------------------------------
  // Sesión
  // ---------------------------------------------------------------------------

  const login = useCallback(
    async (email: string, password?: string, isSignUp?: boolean) => {
      if (!password) throw new Error("La contraseña es requerida.")
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (error) fail(error, "No se pudo iniciar sesión.")
    },
    [supabase]
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    const { clearUserScopedStorage } = await import("@/lib/user-storage")
    clearUserScopedStorage()
  }, [supabase])

  const sendPasswordResetLink = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/update-password` : undefined,
      })
      if (error) fail(error, "No se pudo enviar el correo de recuperación.")
    },
    [supabase]
  )

  const changePassword = useCallback(
    async (currentPassword?: string, newPassword?: string) => {
      if (!newPassword) throw new Error("La nueva contraseña es requerida.")
      if (!user?.email) throw new Error("Usuario no autenticado.")

      // Supabase no tiene reautenticación con contraseña: se verifica iniciando
      // sesión otra vez antes de permitir el cambio.
      if (currentPassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        })
        if (error) throw new Error("La contraseña actual no es correcta.")
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) fail(error, "No se pudo cambiar la contraseña.")
    },
    [supabase, user]
  )

  const sendEmailVerificationLink = useCallback(async () => {
    if (!user?.email) throw new Error("Usuario no autenticado.")
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email })
    if (error) fail(error, "No se pudo reenviar la verificación.")
  }, [supabase, user])

  const reloadUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return
    setUser((prev) =>
      prev ? { ...prev, emailVerified: Boolean(data.user.email_confirmed_at), email: data.user.email || prev.email } : prev
    )
  }, [supabase])

  // ---------------------------------------------------------------------------
  // Cuentas
  // ---------------------------------------------------------------------------

  const getAccount = useCallback((id: string) => accounts.find((a) => a.id === id), [accounts])

  const addAccount = useCallback(
    async (input: Omit<Account, "id">) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const { error } = await supabase.from("accounts").insert({
        user_id: uid,
        name: input.name,
        currency: input.currency,
        kind: input.kind,
        initial_balance: input.balance,
      })
      if (error) fail(error, "No se pudo crear la cuenta.")
      await loadAccounts()
    },
    [supabase, uid, loadAccounts]
  )

  const updateAccount = useCallback(
    async (id: string, input: Partial<Omit<Account, "id">>) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const row = fromAccount(input)

      // El saldo es derivado: para que la cuenta muestre el número que el usuario
      // escribió, hay que corregir el saldo de arranque por la diferencia.
      if (input.balance !== undefined) {
        const actual = accounts.find((a) => a.id === id)
        const { data } = await supabase.from("accounts").select("initial_balance").eq("id", id).single()
        const movimientos = (actual?.balance ?? 0) - Number(data?.initial_balance ?? 0)
        row.initial_balance = Math.round((input.balance - movimientos) * 100) / 100
      }

      const { error } = await supabase.from("accounts").update(row).eq("id", id)
      if (error) fail(error, "No se pudo actualizar la cuenta.")
      await loadAccounts()
    },
    [supabase, uid, accounts, loadAccounts]
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id)
      if (error) fail(error, "No se pudo eliminar la cuenta.")
      await Promise.all([loadAccounts(), loadTransactions()])
    },
    [supabase, loadAccounts, loadTransactions]
  )

  // ---------------------------------------------------------------------------
  // Movimientos
  // ---------------------------------------------------------------------------

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      const { error } = await supabase.rpc("create_transaction", {
        p_type: input.type,
        p_amount: input.amount,
        p_account_id: input.accountId,
        p_category: input.category,
        p_occurred_at: input.date ?? new Date().toISOString(),
        p_to_account_id: input.toAccountId ?? undefined,
        p_to_amount: input.toAmount ?? undefined,
        p_exchange_rate: input.exchangeRate ?? undefined,
        p_note: input.note ?? undefined,
        p_receipt_name: input.receiptName ?? undefined,
        p_vehicle_id: undefined,
      })
      if (error) fail(error, "No se pudo registrar el movimiento.")
      await Promise.all([loadTransactions(), loadAccounts()])
    },
    [supabase, loadTransactions, loadAccounts]
  )

  const updateTransaction = useCallback(
    async (id: string, input: NewTransactionInput) => {
      const previa = transactions.find((t) => t.id === id)
      const { error } = await supabase.rpc("update_transaction", {
        p_id: id,
        p_type: input.type,
        p_amount: input.amount,
        p_account_id: input.accountId,
        p_category: input.category,
        p_occurred_at: input.date ?? previa?.date ?? new Date().toISOString(),
        p_to_account_id: input.toAccountId ?? undefined,
        p_to_amount: input.toAmount ?? undefined,
        p_exchange_rate: input.exchangeRate ?? undefined,
        p_note: input.note ?? undefined,
        p_receipt_name: input.receiptName ?? undefined,
        p_vehicle_id: previa?.vehicleId ?? undefined,
      })
      if (error) fail(error, "No se pudo modificar el movimiento.")
      await Promise.all([loadTransactions(), loadAccounts()])
    },
    [supabase, transactions, loadTransactions, loadAccounts]
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Sin código de reversión: el saldo se deriva de los movimientos
      const { error } = await supabase.from("transactions").delete().eq("id", id)
      if (error) fail(error, "No se pudo eliminar el movimiento.")
      await Promise.all([loadTransactions(), loadAccounts()])
    },
    [supabase, loadTransactions, loadAccounts]
  )

  // ---------------------------------------------------------------------------
  // Categorías
  // ---------------------------------------------------------------------------

  const addCategory = useCallback(
    async (name: string, type: "income" | "expense", color: string) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const { error } = await supabase.from("categories").insert({ user_id: uid, name, type, color })
      if (error) fail(error, "No se pudo crear la categoría.")
      await loadCategories()
    },
    [supabase, uid, loadCategories]
  )

  const updateCategory = useCallback(
    async (id: string, name: string, color: string) => {
      const { error } = await supabase.from("categories").update({ name, color }).eq("id", id)
      if (error) fail(error, "No se pudo actualizar la categoría.")
      await loadCategories()
    },
    [supabase, loadCategories]
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id)
      if (error) fail(error, "No se pudo eliminar la categoría.")
      await loadCategories()
    },
    [supabase, loadCategories]
  )

  // ---------------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------------

  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(",")}`, { headers: await getApiAuthHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setStockPrices((prev) => ({ ...prev, ...data }))
    } catch (err) {
      console.warn("Error fetching market prices:", err)
    }
  }, [])

  useEffect(() => {
    const symbols = Array.from(
      new Set([...watchlist.map((w) => w.symbol), ...stockTransactions.map((t) => t.symbol)])
    )
    if (symbols.length === 0) return

    fetchPrices(symbols)
    const interval = setInterval(() => fetchPrices(symbols), 30000)
    return () => clearInterval(interval)
  }, [watchlist, stockTransactions, fetchPrices])

  const holdings = useMemo(() => {
    const map = new Map<string, { shares: number; totalCost: number }>()
    const sorted = [...stockTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const tx of sorted) {
      const current = map.get(tx.symbol) || { shares: 0, totalCost: 0 }
      if (tx.type === "buy") {
        map.set(tx.symbol, {
          shares: current.shares + tx.shares,
          totalCost: current.totalCost + tx.shares * tx.price,
        })
      } else {
        const nextShares = Math.max(0, current.shares - tx.shares)
        map.set(tx.symbol, {
          shares: nextShares,
          totalCost: nextShares === 0 ? 0 : current.totalCost * (nextShares / current.shares),
        })
      }
    }

    const list: StockHolding[] = []
    map.forEach((value, symbol) => {
      if (value.shares <= 0) return
      const avgBuyPrice = Number((value.totalCost / value.shares).toFixed(2))
      const priceInfo = stockPrices[symbol]
      const currentPrice = priceInfo?.price ?? avgBuyPrice
      const currentValue = Number((value.shares * currentPrice).toFixed(2))
      const profitLoss = Number((currentValue - value.totalCost).toFixed(2))
      list.push({
        symbol,
        name: priceInfo?.name ?? symbol,
        shares: value.shares,
        avgBuyPrice,
        totalCost: Number(value.totalCost.toFixed(2)),
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPercent: value.totalCost > 0 ? Number(((profitLoss / value.totalCost) * 100).toFixed(2)) : 0,
      })
    })
    return list
  }, [stockTransactions, stockPrices])

  const portfolioTotalValue = useMemo(() => holdings.reduce((sum, h) => sum + h.currentValue, 0), [holdings])
  const portfolioTotalProfitLoss = useMemo(() => holdings.reduce((sum, h) => sum + h.profitLoss, 0), [holdings])
  const portfolioTotalProfitLossPercent = useMemo(() => {
    const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0)
    return totalCost > 0 ? Number(((portfolioTotalProfitLoss / totalCost) * 100).toFixed(2)) : 0
  }, [holdings, portfolioTotalProfitLoss])

  const addWatchlistStock = useCallback(
    async (symbol: string) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const clean = symbol.trim().toUpperCase()
      if (!clean) return

      let name = `${clean} Corp.`
      try {
        const res = await fetch(`/api/stocks?symbols=${clean}`, { headers: await getApiAuthHeaders() })
        if (res.ok) {
          const data = await res.json()
          if (data[clean]) {
            name = data[clean].name
            setStockPrices((prev) => ({ ...prev, [clean]: data[clean] }))
          }
        }
      } catch {
        // el nombre es cosmético: si la cotización no responde, se guarda igual
      }

      const { error } = await supabase.from("watchlist").upsert({ user_id: uid, symbol: clean, name })
      if (error) fail(error, "No se pudo agregar el símbolo.")
      await loadWatchlist()
    },
    [supabase, uid, loadWatchlist]
  )

  const removeWatchlistStock = useCallback(
    async (symbol: string) => {
      const { error } = await supabase.from("watchlist").delete().eq("symbol", symbol.toUpperCase())
      if (error) fail(error, "No se pudo quitar el símbolo.")
      await loadWatchlist()
    },
    [supabase, loadWatchlist]
  )

  const executeStockTransaction = useCallback(
    async (input: { symbol: string; type: "buy" | "sell"; shares: number; price: number; date: string; accountId: string }) => {
      const { error } = await supabase.rpc("execute_stock_trade", {
        p_symbol: input.symbol,
        p_side: input.type,
        p_shares: input.shares,
        p_price: input.price,
        p_account_id: input.accountId,
        p_occurred_at: input.date,
      })
      if (error) fail(error, "No se pudo registrar la operación.")
      await Promise.all([loadStockTrades(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadStockTrades, loadTransactions, loadAccounts]
  )

  // ---------------------------------------------------------------------------
  // Vehículos
  // ---------------------------------------------------------------------------

  const addVehicle = useCallback(
    async (input: Omit<Vehicle, "id" | "createdAt">) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const { error } = await supabase.from("vehicles").insert({
        user_id: uid,
        name: input.name,
        type: input.type,
        brand: input.brand ?? null,
        model: input.model ?? null,
        year: input.year ?? null,
        plate: input.plate ?? null,
        odometer: Math.round(input.odometer ?? 0),
        fuel_capacity: input.fuelCapacity ?? null,
      })
      if (error) fail(error, "No se pudo crear el vehículo.")
      await loadVehicles()
    },
    [supabase, uid, loadVehicles]
  )

  const updateVehicle = useCallback(
    async (id: string, input: Partial<Omit<Vehicle, "id" | "createdAt">>) => {
      const { error } = await supabase.from("vehicles").update(fromVehicle(input)).eq("id", id)
      if (error) fail(error, "No se pudo actualizar el vehículo.")
      await loadVehicles()
    },
    [supabase, loadVehicles]
  )

  const deleteVehicle = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_vehicle", { p_id: id })
      if (error) fail(error, "No se pudo eliminar el vehículo.")
      await Promise.all([loadVehicles(), loadVehicleLogs(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadVehicles, loadVehicleLogs, loadTransactions, loadAccounts]
  )

  const addVehicleLog = useCallback(
    async (input: Omit<VehicleLog, "id" | "transactionId">) => {
      const { error } = await supabase.rpc("create_vehicle_log", {
        p_vehicle_id: input.vehicleId,
        p_type: input.type,
        p_occurred_at: input.date,
        p_odometer: Math.round(input.odometer ?? 0),
        p_amount: input.amount ?? 0,
        p_account_id: input.accountId ?? undefined,
        p_note: input.note ?? undefined,
        p_extra: vehicleLogExtras(input),
      })
      if (error) fail(error, "No se pudo registrar el gasto del vehículo.")
      await Promise.all([loadVehicleLogs(), loadVehicles(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadVehicleLogs, loadVehicles, loadTransactions, loadAccounts]
  )

  const updateVehicleLog = useCallback(
    async (id: string, input: Omit<VehicleLog, "id">) => {
      // Editar un registro es borrarlo y volver a crearlo: así el gasto asociado
      // se recalcula por el mismo camino que una alta, sin lógica duplicada.
      const { error: deleteError } = await supabase.rpc("delete_vehicle_log", { p_id: id })
      if (deleteError) fail(deleteError, "No se pudo actualizar el registro.")

      const { error } = await supabase.rpc("create_vehicle_log", {
        p_vehicle_id: input.vehicleId,
        p_type: input.type,
        p_occurred_at: input.date,
        p_odometer: Math.round(input.odometer ?? 0),
        p_amount: input.amount ?? 0,
        p_account_id: input.accountId ?? undefined,
        p_note: input.note ?? undefined,
        p_extra: vehicleLogExtras(input),
      })
      if (error) fail(error, "No se pudo actualizar el registro.")
      await Promise.all([loadVehicleLogs(), loadVehicles(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadVehicleLogs, loadVehicles, loadTransactions, loadAccounts]
  )

  const deleteVehicleLog = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_vehicle_log", { p_id: id })
      if (error) fail(error, "No se pudo eliminar el registro.")
      await Promise.all([loadVehicleLogs(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadVehicleLogs, loadTransactions, loadAccounts]
  )

  // ---------------------------------------------------------------------------
  // Vencimientos
  // ---------------------------------------------------------------------------

  const addDueItem = useCallback(
    async (input: Omit<DueItem, "id" | "createdAt">) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      const { error } = await supabase.from("due_items").insert({
        user_id: uid,
        title: input.title,
        category: input.category,
        amount: input.amount,
        currency: input.currency,
        due_date: input.dueDate,
        frequency: input.frequency,
        reminder_days_before: input.reminderDaysBefore,
        auto_renew: input.autoRenew,
        account_id: input.accountId || null,
        status: input.status || "pending",
      })
      if (error) fail(error, "No se pudo crear el vencimiento.")
      await loadDueItems()
    },
    [supabase, uid, loadDueItems]
  )

  const updateDueItem = useCallback(
    async (id: string, input: Partial<Omit<DueItem, "id">>) => {
      const { error } = await supabase
        .from("due_items")
        .update({ ...fromDueItem(input), updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) fail(error, "No se pudo actualizar el vencimiento.")
      await loadDueItems()
    },
    [supabase, loadDueItems]
  )

  const deleteDueItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("due_items").delete().eq("id", id)
      if (error) fail(error, "No se pudo eliminar el vencimiento.")
      await loadDueItems()
    },
    [supabase, loadDueItems]
  )

  const markDueItemAsPaid = useCallback(
    async (id: string, registerTx?: { accountId: string; amount?: number; category?: string; note?: string }) => {
      const { error } = await supabase.rpc("pay_due_item", {
        p_id: id,
        p_account_id: registerTx?.accountId ?? undefined,
        p_amount: registerTx?.amount ?? undefined,
        p_category: registerTx?.category ?? undefined,
        p_note: registerTx?.note ?? undefined,
      })
      if (error) fail(error, "No se pudo registrar el pago.")
      await Promise.all([loadDueItems(), loadTransactions(), loadAccounts()])
    },
    [supabase, loadDueItems, loadTransactions, loadAccounts]
  )

  const markDueItemAsPending = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("due_items")
        .update({ status: "pending", paid_at: null, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) fail(error, "No se pudo actualizar el vencimiento.")
      await loadDueItems()
    },
    [supabase, loadDueItems]
  )

  // ---------------------------------------------------------------------------
  // Preferencias y notificaciones
  // ---------------------------------------------------------------------------

  // La fila de user_settings se arma siempre entera a partir de los dos refs.
  // Si todavía no existe, el upsert la inserta completa en vez de dejar que las
  // columnas que no mandamos caigan en el default y pisen lo que hay en memoria.
  const persistSettings = useCallback(async () => {
    if (!uidRef.current) return
    const macro = macroSettingsRef.current
    const { error } = await supabase.from("user_settings").upsert({
      user_id: uidRef.current,
      exchange_rate: macro.exchangeRate,
      annual_inflation: macro.annualInflation,
      annual_devaluation: macro.annualDevaluation,
      annual_return: macro.annualReturn,
      rates: macro.rates ?? null,
      updated_at: macro.lastUpdated || new Date().toISOString(),
      ...fromProjectionSettings(projectionSettingsRef.current),
    })
    if (error) console.error("No se pudieron guardar las preferencias:", error.message)
  }, [supabase])

  // Arrastrar un slider dispara un onChange por paso. Sin esto, mover la
  // inflación de 45 a 120 eran ~75 upserts.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSettings = useCallback(() => {
    if (persistTimerRef.current === null) return
    clearTimeout(persistTimerRef.current)
    persistTimerRef.current = null
    void persistSettings()
  }, [persistSettings])

  const schedulePersistSettings = useCallback(() => {
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null
      void persistSettings()
    }, SETTINGS_PERSIST_DELAY_MS)
  }, [persistSettings])

  // Que cerrar la pestaña o mandar la PWA al fondo no se coma el último cambio.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSettings()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flushSettings)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flushSettings)
      flushSettings()
    }
  }, [flushSettings])

  const updateMacroSettings = useCallback(
    async (settings: Partial<MacroSettings>) => {
      applyMacroSettings({
        ...macroSettingsRef.current,
        ...settings,
        lastUpdated: new Date().toISOString(),
      })
      schedulePersistSettings()
    },
    [applyMacroSettings, schedulePersistSettings]
  )

  const updateProjectionSettings = useCallback(
    (settings: Partial<ProjectionSettings>) => {
      applyProjectionSettings({ ...projectionSettingsRef.current, ...settings })
      schedulePersistSettings()
    },
    [applyProjectionSettings, schedulePersistSettings]
  )

  // Trae del mercado sólo lo que es un dato observado: la cotización del dólar.
  // La inflación, la devaluación y el retorno son supuestos de planificación que
  // elige el usuario; /api/macro los devuelve nada más que como sugerencia, y
  // escribirlos acá le borraba su configuración cada vez que entraba a
  // Proyecciones (la página sincronizaba sola al montar).
  const syncMacroFromApi = useCallback(async (): Promise<MacroSettings> => {
    try {
      const res = await fetch("/api/macro", { headers: await getApiAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        const next: Partial<MacroSettings> = {}

        const rate = Number(data.recommendedExchangeRate)
        if (Number.isFinite(rate) && rate > 0) next.exchangeRate = rate
        if (data.rates) next.rates = data.rates

        await updateMacroSettings(next)
      }
    } catch (err) {
      console.error("Error syncing macro data from API:", err)
    }
    return macroSettingsRef.current
  }, [updateMacroSettings])

  // ---------------------------------------------------------------------------
  // Metas del planificador
  // ---------------------------------------------------------------------------

  const addGoal = useCallback(
    async (input: Omit<Goal, "id" | "priority">) => {
      if (!uid) throw new Error("Usuario no autenticado.")
      // Al final de la cascada: la meta nueva se persigue después de las que ya
      // están cargadas.
      const nextPriority = goals.reduce((max, g) => Math.max(max, g.priority), 0) + 1
      const { error } = await supabase.from("goals").insert({
        user_id: uid,
        name: input.name,
        amount: input.amount,
        currency: input.currency,
        kind: input.kind,
        priority: nextPriority,
      })
      if (error) fail(error, "No se pudo crear la meta.")
      await loadGoals()
    },
    [supabase, uid, goals, loadGoals]
  )

  const updateGoal = useCallback(
    async (id: string, changes: Partial<Goal>) => {
      const { error } = await supabase
        .from("goals")
        .update({ ...fromGoal(changes), updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) fail(error, "No se pudo actualizar la meta.")
      await loadGoals()
    },
    [supabase, loadGoals]
  )

  const deleteGoal = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id)
      if (error) fail(error, "No se pudo eliminar la meta.")
      await loadGoals()
    },
    [supabase, loadGoals]
  )

  /** Reescribe las prioridades para que queden densas y en el orden recibido. */
  const reorderGoals = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(goals.map((g) => [g.id, g]))
      const changed = orderedIds
        .map((id, index) => ({ goal: byId.get(id), priority: index + 1 }))
        .filter((entry): entry is { goal: Goal; priority: number } =>
          Boolean(entry.goal) && entry.goal!.priority !== entry.priority
        )
      if (changed.length === 0) return

      // Pintamos el orden nuevo antes de ir a la red: reordenar tiene que
      // sentirse instantáneo aunque la escritura tarde.
      setGoals(orderedIds.map((id, index) => ({ ...byId.get(id)!, priority: index + 1 })))

      const updatedAt = new Date().toISOString()
      const results = await Promise.all(
        changed.map(({ goal, priority }) =>
          supabase.from("goals").update({ priority, updated_at: updatedAt }).eq("id", goal.id)
        )
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        await loadGoals()
        fail(failed.error, "No se pudo reordenar las metas.")
      }
    },
    [supabase, goals, loadGoals]
  )

  const totalsByCurrency = useMemo(
    () =>
      accounts.reduce(
        (acc, a) => {
          acc[a.currency] = (acc[a.currency] ?? 0) + Number(a.balance)
          return acc
        },
        { ARS: 0, USD: 0 } as Record<Currency, number>
      ),
    [accounts]
  )

  const value: FinanceContextValue = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      sendPasswordResetLink,
      changePassword,
      sendEmailVerificationLink,
      reloadUser,
      accounts,
      transactions,
      categories,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addAccount,
      updateAccount,
      deleteAccount,
      addCategory,
      updateCategory,
      deleteCategory,
      getAccount,
      totalsByCurrency,
      watchlist,
      stockTransactions,
      stockPrices,
      holdings,
      portfolioTotalValue,
      portfolioTotalProfitLoss,
      portfolioTotalProfitLossPercent,
      addWatchlistStock,
      removeWatchlistStock,
      executeStockTransaction,
      vehicles,
      vehicleLogs,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      addVehicleLog,
      updateVehicleLog,
      deleteVehicleLog,
      dueItems,
      addDueItem,
      updateDueItem,
      deleteDueItem,
      markDueItemAsPaid,
      markDueItemAsPending,
      macroSettings,
      settingsLoaded,
      dataLoaded,
      updateMacroSettings,
      syncMacroFromApi,
      projectionSettings,
      updateProjectionSettings,
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      reorderGoals,
    }),
    [
      user,
      loading,
      login,
      logout,
      sendPasswordResetLink,
      changePassword,
      sendEmailVerificationLink,
      reloadUser,
      accounts,
      transactions,
      categories,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addAccount,
      updateAccount,
      deleteAccount,
      addCategory,
      updateCategory,
      deleteCategory,
      getAccount,
      totalsByCurrency,
      watchlist,
      stockTransactions,
      stockPrices,
      holdings,
      portfolioTotalValue,
      portfolioTotalProfitLoss,
      portfolioTotalProfitLossPercent,
      addWatchlistStock,
      removeWatchlistStock,
      executeStockTransaction,
      vehicles,
      vehicleLogs,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      addVehicleLog,
      updateVehicleLog,
      deleteVehicleLog,
      dueItems,
      addDueItem,
      updateDueItem,
      deleteDueItem,
      markDueItemAsPaid,
      markDueItemAsPending,
      macroSettings,
      settingsLoaded,
      dataLoaded,
      updateMacroSettings,
      syncMacroFromApi,
      projectionSettings,
      updateProjectionSettings,
      goals,
      addGoal,
      updateGoal,
      deleteGoal,
      reorderGoals,
    ]
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
