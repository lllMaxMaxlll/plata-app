"use client"

import { createContext, useContext, useMemo, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  formatCurrency,
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
  type VehicleType,
  type VehicleLogType,
  type DueItem,
  type DueFrequency,
  type DueItemStatus,
} from "@/lib/finance-data"
import { auth, db, getApiAuthHeaders } from "@/lib/firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth"
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  writeBatch,
} from "firebase/firestore"

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

interface FinanceContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password?: string, isSignUp?: boolean) => Promise<void>
  loginWithGoogle: () => Promise<void>
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
  saveFCMToken: (token: string) => Promise<void>

  macroSettings: MacroSettings
  updateMacroSettings: (settings: Partial<MacroSettings>) => Promise<void>
  syncMacroFromApi: () => Promise<MacroSettings>
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
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

  const DEFAULT_MACRO_SETTINGS: MacroSettings = {
    exchangeRate: 1250,
    annualInflation: 45,
    annualDevaluation: 40,
    annualReturn: 12,
    lastUpdated: "",
    rates: { blue: 1250, oficial: 980, mep: 1240, ccl: 1255 },
  }

  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS)

  // 1. Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
          email: firebaseUser.email || "",
          emailVerified: firebaseUser.emailVerified,
          providerId: firebaseUser.providerData[0]?.providerId || null,
        })
      } else {
        setUser(null)
        setAccounts([])
        setTransactions([])
        setCategories([])
        setWatchlist([])
        setStockTransactions([])
        setStockPrices({})
        setVehicles([])
        setVehicleLogs([])
        setDueItems([])
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // Seeding helper for default categories
  async function seedDefaultCategories(uid: string) {
    try {
      const batch = writeBatch(db)
      const defaults: Omit<Category, "id">[] = [
        // Expenses
        { name: "Comida", type: "expense", color: "var(--chart-1)" },
        { name: "Servicios", type: "expense", color: "var(--chart-2)" },
        { name: "Transporte", type: "expense", color: "var(--chart-3)" },
        { name: "Alquiler", type: "expense", color: "var(--chart-4)" },
        { name: "Otros", type: "expense", color: "var(--chart-5)" },
        // Income
        { name: "Salario", type: "income", color: "oklch(0.76 0.16 156)" },
        { name: "Efectivo", type: "income", color: "oklch(0.78 0.15 75)" },
        { name: "Inversiones", type: "income", color: "oklch(0.7 0.13 230)" },
        { name: "Trabajo Extra", type: "income", color: "oklch(0.66 0.18 350)" },
      ]
      
      defaults.forEach((cat) => {
        const newRef = doc(collection(db, "users", uid, "categories"))
        batch.set(newRef, { id: newRef.id, ...cat })
      })
      
      await batch.commit()
    } catch (err) {
      console.error("Error seeding categories:", err)
    }
  }

  // 2. Real-time subscriptions for logged-in user data
  useEffect(() => {
    if (!user) return

    // Sync accounts subcollection
    const accountsRef = collection(db, "users", user.uid, "accounts")
    const unsubscribeAccounts = onSnapshot(accountsRef, (snapshot) => {
      const accList: Account[] = []
      snapshot.forEach((doc) => {
        accList.push({ id: doc.id, ...doc.data() } as Account)
      })
      setAccounts(accList)
    })

    // Sync transactions subcollection (ordered by date descending)
    const txsRef = collection(db, "users", user.uid, "transactions")
    const txsQuery = query(txsRef, orderBy("date", "desc"))
    const unsubscribeTransactions = onSnapshot(txsQuery, (snapshot) => {
      const txList: Transaction[] = []
      snapshot.forEach((doc) => {
        txList.push({ id: doc.id, ...doc.data() } as Transaction)
      })
      setTransactions(txList)
    })

    // Sync categories subcollection
    const categoriesRef = collection(db, "users", user.uid, "categories")
    const unsubscribeCategories = onSnapshot(categoriesRef, (snapshot) => {
      if (snapshot.empty) {
        seedDefaultCategories(user.uid)
        return
      }
      const catList: Category[] = []
      snapshot.forEach((doc) => {
        catList.push({ id: doc.id, ...doc.data() } as Category)
      })
      setCategories(catList)
    })

    // Sync watchlist subcollection
    const watchlistRef = collection(db, "users", user.uid, "watchlist")
    const unsubscribeWatchlist = onSnapshot(watchlistRef, (snapshot) => {
      const wlList: WatchlistStock[] = []
      snapshot.forEach((doc) => {
        wlList.push({ id: doc.id, ...doc.data() } as WatchlistStock)
      })
      setWatchlist(wlList)
    })

    // Sync stock transactions subcollection (ordered by date descending)
    const stockTxsRef = collection(db, "users", user.uid, "stockTransactions")
    const stockTxsQuery = query(stockTxsRef, orderBy("date", "desc"))
    // If the ordered query fails (missing index), listen unordered and sort here.
    // The fallback listener is tracked so the cleanup below can detach it too.
    let unsubscribeStockTxsFallback: (() => void) | null = null
    const unsubscribeStockTxs = onSnapshot(
      stockTxsQuery,
      (snapshot) => {
        const stList: StockTransaction[] = []
        snapshot.forEach((doc) => {
          stList.push({ id: doc.id, ...doc.data() } as StockTransaction)
        })
        setStockTransactions(stList)
      },
      (err) => {
        console.warn("Stock transactions query error, falling back:", err)
        unsubscribeStockTxsFallback?.()
        unsubscribeStockTxsFallback = onSnapshot(stockTxsRef, (snapshot) => {
          const stList: StockTransaction[] = []
          snapshot.forEach((doc) => {
            stList.push({ id: doc.id, ...doc.data() } as StockTransaction)
          })
          stList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          setStockTransactions(stList)
        })
      }
    )

    // Sync vehicles subcollection (ordered by createdAt descending)
    const vehiclesRef = collection(db, "users", user.uid, "vehicles")
    const vehiclesQuery = query(vehiclesRef, orderBy("createdAt", "desc"))
    const unsubscribeVehicles = onSnapshot(vehiclesQuery, (snapshot) => {
      const vList: Vehicle[] = []
      snapshot.forEach((doc) => {
        vList.push({ id: doc.id, ...doc.data() } as Vehicle)
      })
      setVehicles(vList)
    })

    // Sync vehicle logs subcollection (ordered by date descending)
    const vehicleLogsRef = collection(db, "users", user.uid, "vehicleLogs")
    const vehicleLogsQuery = query(vehicleLogsRef, orderBy("date", "desc"))
    const unsubscribeVehicleLogs = onSnapshot(vehicleLogsQuery, (snapshot) => {
      const vlList: VehicleLog[] = []
      snapshot.forEach((doc) => {
        vlList.push({ id: doc.id, ...doc.data() } as VehicleLog)
      })
      setVehicleLogs(vlList)
    })

    // Sync dueItems subcollection (ordered by dueDate ascending)
    const dueItemsRef = collection(db, "users", user.uid, "dueItems")
    const dueItemsQuery = query(dueItemsRef, orderBy("dueDate", "asc"))
    const unsubscribeDueItems = onSnapshot(dueItemsQuery, (snapshot) => {
      const dList: DueItem[] = []
      snapshot.forEach((doc) => {
        dList.push({ id: doc.id, ...doc.data() } as DueItem)
      })
      setDueItems(dList)
    })

    // Sync macro settings document
    const macroRef = doc(db, "users", user.uid, "settings", "macro")
    const unsubscribeMacro = onSnapshot(macroRef, (docSnap) => {
      if (docSnap.exists()) {
        setMacroSettings((prev) => ({ ...prev, ...docSnap.data() }))
      }
    })

    return () => {
      unsubscribeAccounts()
      unsubscribeTransactions()
      unsubscribeCategories()
      unsubscribeWatchlist()
      unsubscribeStockTxs()
      unsubscribeStockTxsFallback?.()
      unsubscribeVehicles()
      unsubscribeVehicleLogs()
      unsubscribeDueItems()
      unsubscribeMacro()
    }
  }, [user])

  async function login(email: string, password?: string, isSignUp?: boolean) {
    if (!password) {
      throw new Error("La contraseña es requerida.")
    }
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, password)
    } else {
      await signInWithEmailAndPassword(auth, email, password)
    }
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: "select_account" })
    await signInWithPopup(auth, provider)
  }

  async function logout() {
    await signOut(auth)
  }

  async function sendPasswordResetLink(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function changePassword(currentPassword?: string, newPassword?: string) {
    if (!auth.currentUser) throw new Error("Usuario no autenticado.")
    if (!newPassword) throw new Error("La nueva contraseña es requerida.")

    const isPasswordUser = auth.currentUser.providerData.some(
      (p) => p.providerId === "password"
    )
    if (isPasswordUser) {
      if (!currentPassword) throw new Error("La contraseña actual es requerida para reautenticar.")
      const email = auth.currentUser.email
      if (!email) throw new Error("El usuario no tiene un correo electrónico asociado.")
      const credential = EmailAuthProvider.credential(email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
    }

    await updatePassword(auth.currentUser, newPassword)
  }

  async function sendEmailVerificationLink() {
    if (!auth.currentUser) throw new Error("Usuario no autenticado.")
    await sendEmailVerification(auth.currentUser)
  }

  async function reloadUser() {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    const firebaseUser = auth.currentUser
    setUser({
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
      email: firebaseUser.email || "",
      emailVerified: firebaseUser.emailVerified,
      providerId: firebaseUser.providerData[0]?.providerId || null,
    })
  }

  /**
   * Server-side counterpart of the checks the transaction sheet does: the client
   * can be bypassed (offline queue, another tab, the SDK straight from a console),
   * so every debit is re-validated inside the Firestore transaction.
   */
  function assertValidTransactionInput(input: NewTransactionInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("El monto debe ser un número mayor a 0.")
    }
    if (input.type === "transfer") {
      if (!input.toAccountId) {
        throw new Error("La transferencia requiere una cuenta de destino.")
      }
      if (input.toAccountId === input.accountId) {
        throw new Error("La cuenta de origen y destino deben ser distintas.")
      }
      if (input.toAmount !== undefined && (!Number.isFinite(input.toAmount) || input.toAmount <= 0)) {
        throw new Error("El monto acreditado en destino no es válido.")
      }
    }
  }

  function assertSufficientBalance(account: Pick<Account, "name" | "currency">, available: number, amount: number) {
    if (available < amount) {
      throw new Error(
        `Saldo insuficiente en "${account.name}". Disponible: ${formatCurrency(available, account.currency)}.`
      )
    }
  }

  const getAccount = useCallback(
    (id: string) => {
      return accounts.find((a) => a.id === id)
    },
    [accounts],
  )

  async function addAccount(input: Omit<Account, "id">) {
    if (!user) throw new Error("Usuario no autenticado.")
    const newAccRef = doc(collection(db, "users", user.uid, "accounts"))
    await setDoc(newAccRef, { id: newAccRef.id, ...input })
  }

  async function updateAccount(id: string, input: Partial<Omit<Account, "id">>) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "accounts", id)
    await setDoc(docRef, input, { merge: true })
  }

  async function deleteAccount(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "accounts", id)
    const { deleteDoc } = await import("firebase/firestore")
    await deleteDoc(docRef)
  }

  async function addTransaction(input: NewTransactionInput) {
    if (!user) throw new Error("Usuario no autenticado.")
    assertValidTransactionInput(input)

    // Auto-generated ids: a timestamp collides when two writes land in the same
    // millisecond, and transaction.set() would silently overwrite the first one.
    const txDocRef = doc(collection(db, "users", user.uid, "transactions"))
    const txId = txDocRef.id

    const primaryAccRef = doc(db, "users", user.uid, "accounts", input.accountId)
    const secondaryAccRef = input.toAccountId
      ? doc(db, "users", user.uid, "accounts", input.toAccountId)
      : null

    const originalAccounts = [...accounts]

    // Optimistically update local account balances
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === input.accountId) {
          const bal = Number(acc.balance)
          const newBal = Math.round((input.type === "income" ? bal + input.amount : bal - input.amount) * 100) / 100
          return { ...acc, balance: newBal }
        }
        if (secondaryAccRef && acc.id === input.toAccountId) {
          const bal = Number(acc.balance)
          const newBal = Math.round((bal + (input.toAmount ?? input.amount)) * 100) / 100
          return { ...acc, balance: newBal }
        }
        return acc
      })
    )

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Read accounts
        const primarySnap = await transaction.get(primaryAccRef)
        if (!primarySnap.exists()) {
          throw new Error("La cuenta de origen no existe.")
        }
        const primaryData = primarySnap.data() as Account
        let newPrimaryBalance = Number(primaryData.balance)

        let newSecondaryBalance = 0
        let secondaryData: Account | null = null
        if (secondaryAccRef) {
          const secondarySnap = await transaction.get(secondaryAccRef)
          if (!secondarySnap.exists()) {
            throw new Error("La cuenta de destino no existe.")
          }
          secondaryData = secondarySnap.data() as Account
          newSecondaryBalance = Number(secondaryData.balance)
        }

        // 2. Calculate new balances, refusing to overdraw the source account
        if (input.type !== "income") {
          assertSufficientBalance(primaryData, newPrimaryBalance, input.amount)
        }
        if (input.type === "income") {
          newPrimaryBalance = Math.round((newPrimaryBalance + input.amount) * 100) / 100
        } else if (input.type === "expense") {
          newPrimaryBalance = Math.round((newPrimaryBalance - input.amount) * 100) / 100
        } else if (input.type === "transfer" && secondaryData) {
          newPrimaryBalance = Math.round((newPrimaryBalance - input.amount) * 100) / 100
          newSecondaryBalance = Math.round((newSecondaryBalance + (input.toAmount ?? input.amount)) * 100) / 100
        }

        // 3. Write transaction document
        transaction.set(txDocRef, {
          id: txId,
          type: input.type,
          amount: Math.round(input.amount * 100) / 100,
          accountId: input.accountId,
          currency: primaryData.currency,
          toAccountId: input.toAccountId || null,
          toAmount: input.toAmount ? Math.round(input.toAmount * 100) / 100 : null,
          exchangeRate: input.exchangeRate ? Math.round(input.exchangeRate * 100) / 100 : null,
          category: input.category,
          note: input.note || null,
          date: input.date || new Date().toISOString(),
          receiptName: input.receiptName || null,
        })

        // 4. Update balances
        transaction.update(primaryAccRef, { balance: newPrimaryBalance })
        if (secondaryAccRef) {
          transaction.update(secondaryAccRef, { balance: newSecondaryBalance })
        }
      })
    } catch (err) {
      setAccounts(originalAccounts)
      throw err
    }
  }

  async function updateTransaction(id: string, input: NewTransactionInput) {
    if (!user) throw new Error("Usuario no autenticado.")
    assertValidTransactionInput(input)

    const txDocRef = doc(db, "users", user.uid, "transactions", id)
    const oldTx = transactions.find((t) => t.id === id)
    if (!oldTx) throw new Error("El movimiento no existe.")

    const originalAccounts = [...accounts]
    // Optimistically update account balances
    setAccounts((prev) => {
      // 1. Revert old transaction balances
      const reverted = prev.map((acc) => {
        if (acc.id === oldTx.accountId) {
          const bal = Number(acc.balance)
          const revertedBal = Math.round((oldTx.type === "income" ? bal - oldTx.amount : bal + oldTx.amount) * 100) / 100
          return { ...acc, balance: revertedBal }
        }
        if (oldTx.type === "transfer" && oldTx.toAccountId && acc.id === oldTx.toAccountId) {
          const bal = Number(acc.balance)
          const revertedBal = Math.round((bal - (oldTx.toAmount ?? oldTx.amount)) * 100) / 100
          return { ...acc, balance: revertedBal }
        }
        return acc
      })
 
      // 2. Apply new transaction balances
      return reverted.map((acc) => {
        if (acc.id === input.accountId) {
          const bal = Number(acc.balance)
          const newBal = Math.round((input.type === "income" ? bal + input.amount : bal - input.amount) * 100) / 100
          return { ...acc, balance: newBal }
        }
        if (input.type === "transfer" && input.toAccountId && acc.id === input.toAccountId) {
          const bal = Number(acc.balance)
          const newBal = Math.round((bal + (input.toAmount ?? input.amount)) * 100) / 100
          return { ...acc, balance: newBal }
        }
        return acc
      })
    })

    try {
      await runTransaction(db, async (transaction) => {
        // READS FIRST:
        const txSnap = await transaction.get(txDocRef)
        if (!txSnap.exists()) throw new Error("El movimiento no existe.")
        const currentOldTx = txSnap.data() as Transaction

        const oldPrimaryAccRef = doc(db, "users", user.uid, "accounts", currentOldTx.accountId)
        const oldPrimarySnap = await transaction.get(oldPrimaryAccRef)
        if (!oldPrimarySnap.exists()) throw new Error("Cuenta original de origen no existe.")

        let oldSecondarySnap = null
        if (currentOldTx.type === "transfer" && currentOldTx.toAccountId) {
          const oldSecondaryAccRef = doc(db, "users", user.uid, "accounts", currentOldTx.toAccountId)
          oldSecondarySnap = await transaction.get(oldSecondaryAccRef)
        }

        const newPrimaryAccRef = doc(db, "users", user.uid, "accounts", input.accountId)
        let newPrimarySnap: any = oldPrimarySnap
        if (input.accountId !== currentOldTx.accountId) {
          newPrimarySnap = await transaction.get(newPrimaryAccRef)
          if (!newPrimarySnap.exists()) throw new Error("Nueva cuenta de origen no existe.")
        }

        let newSecondarySnap = null
        if (input.type === "transfer" && input.toAccountId) {
          if (currentOldTx.type === "transfer" && input.toAccountId === currentOldTx.toAccountId) {
            newSecondarySnap = oldSecondarySnap
          } else {
            const newSecondaryAccRef = doc(db, "users", user.uid, "accounts", input.toAccountId)
            newSecondarySnap = await transaction.get(newSecondaryAccRef)
            if (!newSecondarySnap.exists()) throw new Error("Nueva cuenta de destino no existe.")
          }
        }

        // WRITES:
        // 1. Reverse old balance changes
        let oldPrimaryBalance = Number(oldPrimarySnap.data()?.balance ?? 0)
        if (currentOldTx.type === "income") {
          oldPrimaryBalance = Math.round((oldPrimaryBalance - currentOldTx.amount) * 100) / 100
        } else if (currentOldTx.type === "expense") {
          oldPrimaryBalance = Math.round((oldPrimaryBalance + currentOldTx.amount) * 100) / 100
        } else if (currentOldTx.type === "transfer") {
          oldPrimaryBalance = Math.round((oldPrimaryBalance + currentOldTx.amount) * 100) / 100
        }
 
        let oldSecondaryBalance = 0
        if (oldSecondarySnap && oldSecondarySnap.exists()) {
          oldSecondaryBalance = Math.round((Number(oldSecondarySnap.data()?.balance ?? 0) - (currentOldTx.toAmount ?? currentOldTx.amount)) * 100) / 100
        }
 
        // 2. Set base reversed balances for target accounts
        let newPrimaryBalance = Number(newPrimarySnap.data()?.balance ?? 0)
        if (input.accountId === currentOldTx.accountId) {
          newPrimaryBalance = oldPrimaryBalance
        } else if (currentOldTx.type === "transfer" && input.accountId === currentOldTx.toAccountId) {
          newPrimaryBalance = oldSecondaryBalance
        }
 
        let newSecondaryBalance = 0
        if (input.type === "transfer" && input.toAccountId && newSecondarySnap) {
          newSecondaryBalance = Number(newSecondarySnap.data()?.balance ?? 0)
          if (input.toAccountId === currentOldTx.accountId) {
            newSecondaryBalance = oldPrimaryBalance
          } else if (currentOldTx.type === "transfer" && input.toAccountId === currentOldTx.toAccountId) {
            newSecondaryBalance = oldSecondaryBalance
          }
        }
 
        // 3. Apply new transaction balance changes, refusing to overdraw the source
        if (input.type !== "income") {
          assertSufficientBalance(
            newPrimarySnap.data() as Account,
            newPrimaryBalance,
            input.amount
          )
        }
        if (input.type === "income") {
          newPrimaryBalance = Math.round((newPrimaryBalance + input.amount) * 100) / 100
        } else if (input.type === "expense") {
          newPrimaryBalance = Math.round((newPrimaryBalance - input.amount) * 100) / 100
        } else if (input.type === "transfer") {
          newPrimaryBalance = Math.round((newPrimaryBalance - input.amount) * 100) / 100
          newSecondaryBalance = Math.round((newSecondaryBalance + (input.toAmount ?? input.amount)) * 100) / 100
        }
 
        // 4. Update Firestore documents
        transaction.set(txDocRef, {
          id: id,
          type: input.type,
          amount: Math.round(input.amount * 100) / 100,
          accountId: input.accountId,
          currency: (newPrimarySnap.data() as Account).currency,
          toAccountId: input.toAccountId || null,
          toAmount: input.toAmount ? Math.round(input.toAmount * 100) / 100 : null,
          exchangeRate: input.exchangeRate ? Math.round(input.exchangeRate * 100) / 100 : null,
          category: input.category,
          note: input.note || null,
          date: input.date || currentOldTx.date,
          receiptName: input.receiptName || null,
        })

        // Update primary accounts
        if (input.accountId === currentOldTx.accountId) {
          transaction.update(oldPrimaryAccRef, { balance: newPrimaryBalance })
        } else {
          transaction.update(oldPrimaryAccRef, { balance: oldPrimaryBalance })
          transaction.update(newPrimaryAccRef, { balance: newPrimaryBalance })
        }

        // Update secondary accounts
        if (oldSecondarySnap) {
          if (newSecondarySnap && input.toAccountId === currentOldTx.toAccountId) {
            transaction.update(newSecondarySnap.ref, { balance: newSecondaryBalance })
          } else {
            transaction.update(oldSecondarySnap.ref, { balance: oldSecondaryBalance })
            if (newSecondarySnap) {
              transaction.update(newSecondarySnap.ref, { balance: newSecondaryBalance })
            }
          }
        } else if (newSecondarySnap) {
          transaction.update(newSecondarySnap.ref, { balance: newSecondaryBalance })
        }
      })
    } catch (err) {
      setAccounts(originalAccounts)
      throw err
    }
  }

  async function deleteTransaction(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")

    const txDocRef = doc(db, "users", user.uid, "transactions", id)
    const oldTx = transactions.find((t) => t.id === id)
    if (!oldTx) throw new Error("El movimiento no existe.")

    const originalAccounts = [...accounts]

    // Optimistically update account balances by reversing transaction
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === oldTx.accountId) {
          const bal = Number(acc.balance)
          const revertedBal = Math.round((oldTx.type === "income" ? bal - oldTx.amount : bal + oldTx.amount) * 100) / 100
          return { ...acc, balance: revertedBal }
        }
        if (oldTx.type === "transfer" && oldTx.toAccountId && acc.id === oldTx.toAccountId) {
          const bal = Number(acc.balance)
          const revertedBal = Math.round((bal - (oldTx.toAmount ?? oldTx.amount)) * 100) / 100
          return { ...acc, balance: revertedBal }
        }
        return acc
      })
    )

    try {
      await runTransaction(db, async (transaction) => {
        const txSnap = await transaction.get(txDocRef)
        if (!txSnap.exists()) {
          throw new Error("El movimiento no existe.")
        }
        const txData = txSnap.data() as Transaction

        // 1. Get primary account
        const primaryAccRef = doc(db, "users", user.uid, "accounts", txData.accountId)
        const primarySnap = await transaction.get(primaryAccRef)
        if (primarySnap.exists()) {
          const primaryData = primarySnap.data() as Account
          let newPrimaryBalance = Number(primaryData.balance)

          // 2. Reverse balance changes
          if (txData.type === "income") {
            newPrimaryBalance = Math.round((newPrimaryBalance - txData.amount) * 100) / 100
          } else if (txData.type === "expense") {
            newPrimaryBalance = Math.round((newPrimaryBalance + txData.amount) * 100) / 100
          } else if (txData.type === "transfer") {
            newPrimaryBalance = Math.round((newPrimaryBalance + txData.amount) * 100) / 100
          }
          transaction.update(primaryAccRef, { balance: newPrimaryBalance })
        }

        // 3. Reverse secondary balance if transfer
        if (txData.type === "transfer" && txData.toAccountId) {
          const secondaryAccRef = doc(db, "users", user.uid, "accounts", txData.toAccountId)
          const secondarySnap = await transaction.get(secondaryAccRef)
          if (secondarySnap.exists()) {
            const secondaryData = secondarySnap.data() as Account
            const newSecondaryBalance = Math.round((Number(secondaryData.balance) - (txData.toAmount ?? txData.amount)) * 100) / 100
            transaction.update(secondaryAccRef, { balance: newSecondaryBalance })
          }
        }

        // 4. Delete the transaction doc
        transaction.delete(txDocRef)
      })
    } catch (err) {
      setAccounts(originalAccounts)
      throw err
    }
  }

  async function addCategory(name: string, type: "income" | "expense", color: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const newCatRef = doc(collection(db, "users", user.uid, "categories"))
    await setDoc(newCatRef, { id: newCatRef.id, name, type, color })
  }

  async function updateCategory(id: string, name: string, color: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "categories", id)
    await setDoc(docRef, { name, color }, { merge: true })
  }

  async function deleteCategory(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "categories", id)
    const { deleteDoc } = await import("firebase/firestore")
    await deleteDoc(docRef)
  }

  // --- Stocks Portfolio Management ---

  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return

    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(",")}`, {
        headers: await getApiAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setStockPrices((prev) => {
          const updated = { ...prev }
          Object.keys(data).forEach((sym) => {
            updated[sym] = data[sym]
          })
          return updated
        })
        return
      }
    } catch (err) {
      console.warn("Error fetching market prices:", err)
    }
  }, [])

  // Poll price updates from Yahoo Finance API every 30 seconds
  useEffect(() => {
    const symbols = Array.from(
      new Set([
        ...watchlist.map((w) => w.symbol),
        ...stockTransactions.map((t) => t.symbol),
      ])
    )
    if (symbols.length === 0) return

    fetchPrices(symbols)

    const interval = setInterval(() => {
      fetchPrices(symbols)
    }, 30000)

    return () => clearInterval(interval)
  }, [watchlist, stockTransactions, fetchPrices])

  // Calculate user holdings from history of buy/sell transactions
  const holdings = useMemo(() => {
    const map = new Map<string, { shares: number; totalCost: number }>()
    const sortedTxs = [...stockTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    for (const tx of sortedTxs) {
      const current = map.get(tx.symbol) || { shares: 0, totalCost: 0 }
      if (tx.type === "buy") {
        const nextShares = current.shares + tx.shares
        const nextCost = current.totalCost + (tx.shares * tx.price)
        map.set(tx.symbol, { shares: nextShares, totalCost: nextCost })
      } else {
        const nextShares = Math.max(0, current.shares - tx.shares)
        const nextCost = nextShares === 0 ? 0 : current.totalCost * (nextShares / current.shares)
        map.set(tx.symbol, { shares: nextShares, totalCost: nextCost })
      }
    }

    const list: StockHolding[] = []
    map.forEach((value, symbol) => {
      if (value.shares <= 0) return

      const avgBuyPrice = Number((value.totalCost / value.shares).toFixed(2))
      const priceInfo = stockPrices[symbol]
      const currentPrice = priceInfo?.price ?? avgBuyPrice
      const name = priceInfo?.name ?? symbol
      const currentValue = Number((value.shares * currentPrice).toFixed(2))
      const profitLoss = Number((currentValue - value.totalCost).toFixed(2))
      const profitLossPercent = value.totalCost > 0 ? Number(((profitLoss / value.totalCost) * 100).toFixed(2)) : 0

      list.push({
        symbol,
        name,
        shares: value.shares,
        avgBuyPrice,
        totalCost: Number(value.totalCost.toFixed(2)),
        currentPrice,
        currentValue,
        profitLoss,
        profitLossPercent,
      })
    })

    return list
  }, [stockTransactions, stockPrices])

  const portfolioTotalValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0)
  }, [holdings])

  const portfolioTotalProfitLoss = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.profitLoss, 0)
  }, [holdings])

  const portfolioTotalProfitLossPercent = useMemo(() => {
    const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0)
    return totalCost > 0 ? Number(((portfolioTotalProfitLoss / totalCost) * 100).toFixed(2)) : 0
  }, [holdings, portfolioTotalProfitLoss])

  async function addWatchlistStock(symbol: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const cleanSym = symbol.trim().toUpperCase()
    if (!cleanSym) return

    let name = `${cleanSym} Corp.`
    try {
      const res = await fetch(`/api/stocks?symbols=${cleanSym}`, {
        headers: await getApiAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data[cleanSym]) {
          name = data[cleanSym].name
          setStockPrices((prev) => ({ ...prev, [cleanSym]: data[cleanSym] }))
        }
      }
    } catch (e) {
      console.warn("Could not fetch stock name:", e)
    }

    const docRef = doc(db, "users", user.uid, "watchlist", cleanSym)
    await setDoc(docRef, {
      id: cleanSym,
      symbol: cleanSym,
      name,
      addedAt: new Date().toISOString(),
    })
  }

  async function removeWatchlistStock(symbol: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "watchlist", symbol)
    const { deleteDoc } = await import("firebase/firestore")
    await deleteDoc(docRef)
  }

  async function executeStockTransaction(input: {
    symbol: string
    type: "buy" | "sell"
    shares: number
    price: number
    date: string
    accountId: string
  }) {
    if (!user) throw new Error("Usuario no autenticado.")

    const symbol = input.symbol.trim().toUpperCase()
    if (!symbol || !Number.isFinite(input.shares) || input.shares <= 0 || !Number.isFinite(input.price) || input.price <= 0) {
      throw new Error("Los datos de la operación no son válidos.")
    }
    const txDocRef = doc(collection(db, "users", user.uid, "stockTransactions"))
    const txId = txDocRef.id
    const accountRef = doc(db, "users", user.uid, "accounts", input.accountId)
    const positionRef = doc(db, "users", user.uid, "stockPositions", symbol)

    const existingShares = stockTransactions
      .filter((tx) => tx.symbol === symbol)
      .reduce((total, tx) => total + (tx.type === "buy" ? tx.shares : -tx.shares), 0)

    const totalAmount = Math.round(input.shares * input.price * 100) / 100

    const originalAccounts = [...accounts]
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === input.accountId) {
          const bal = Number(acc.balance)
          const newBal = Math.round((input.type === "buy" ? bal - totalAmount : bal + totalAmount) * 100) / 100
          return { ...acc, balance: newBal }
        }
        return acc
      })
    )

    try {
      await runTransaction(db, async (transaction) => {
        const accSnap = await transaction.get(accountRef)
        const positionSnap = await transaction.get(positionRef)
        if (!accSnap.exists()) {
          throw new Error("La cuenta seleccionada no existe.")
        }
        const accData = accSnap.data() as Account
        if (accData.currency !== "USD") {
          throw new Error("Las operaciones bursátiles requieren una cuenta en USD.")
        }
        const bal = Number(accData.balance)
        const currentShares = positionSnap.exists()
          ? Number(positionSnap.data().shares ?? 0)
          : Math.max(0, existingShares)

        if (input.type === "buy" && bal < totalAmount) {
          throw new Error("Saldo insuficiente en la cuenta seleccionada.")
        }
        if (input.type === "sell" && currentShares < input.shares) {
          throw new Error("No tenés suficientes acciones para realizar esta venta.")
        }

        const newBal = Math.round((input.type === "buy" ? bal - totalAmount : bal + totalAmount) * 100) / 100

        transaction.set(txDocRef, {
          id: txId,
          symbol,
          type: input.type,
          shares: input.shares,
          price: Math.round(input.price * 100) / 100,
          date: input.date,
          accountId: input.accountId,
        })

        transaction.update(accountRef, { balance: newBal })
        transaction.set(positionRef, {
          symbol,
          shares: Math.round((currentShares + (input.type === "buy" ? input.shares : -input.shares)) * 1e8) / 1e8,
          updatedAt: new Date().toISOString(),
        })

        const finTxDocRef = doc(collection(db, "users", user.uid, "transactions"))
        const finTxId = finTxDocRef.id

        transaction.set(finTxDocRef, {
          id: finTxId,
          type: input.type === "buy" ? "expense" : "income",
          amount: totalAmount,
          accountId: input.accountId,
          currency: "USD",
          toAccountId: null,
          toAmount: null,
          exchangeRate: null,
          category: "Inversiones",
          note: `${input.type === "buy" ? "Compra" : "Venta"} de ${input.shares} acciones de ${symbol} @ $${input.price}`,
          date: input.date,
          receiptName: null,
        })
      })
    } catch (err) {
      setAccounts(originalAccounts)
      throw err
    }
  }

  // --- Vehicles and Vehicle Logs Management ---

  async function addVehicle(input: Omit<Vehicle, "id" | "createdAt">) {
    if (!user) throw new Error("Usuario no autenticado.")
    const newVehRef = doc(collection(db, "users", user.uid, "vehicles"))
    await setDoc(newVehRef, {
      id: newVehRef.id,
      ...input,
      createdAt: new Date().toISOString(),
    })
  }

  async function updateVehicle(id: string, input: Partial<Omit<Vehicle, "id" | "createdAt">>) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "vehicles", id)
    await setDoc(docRef, input, { merge: true })
  }

  async function deleteVehicle(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")

    const uid = user.uid
    const vehicleRef = doc(db, "users", uid, "vehicles", id)
    const associatedLogs = vehicleLogs.filter((vl) => vl.vehicleId === id)

    // Logs synced to an account must give their money back, same as deleteVehicleLog
    const refundableLogs = associatedLogs.filter((log) => log.accountId && log.transactionId)
    const refundByAccount = new Map<string, number>()
    refundableLogs.forEach((log) => {
      const accountId = log.accountId as string
      refundByAccount.set(accountId, (refundByAccount.get(accountId) ?? 0) + (Number(log.amount) || 0))
    })
    const accountIds = Array.from(refundByAccount.keys())

    // Firestore caps a transaction at 500 writes (vehicle + logs + txs + accounts)
    const writeCount = 1 + associatedLogs.length + refundableLogs.length + accountIds.length
    if (writeCount > 450) {
      throw new Error(
        "El vehículo tiene demasiados registros para eliminarse de una sola vez. Borrá algunos registros y volvé a intentarlo."
      )
    }

    const originalAccounts = [...accounts]
    const originalVehicles = [...vehicles]

    // Optimistically drop the vehicle and restore the balances it had discounted
    setVehicles((prev) => prev.filter((v) => v.id !== id))
    setAccounts((prev) =>
      prev.map((acc) => {
        const refund = refundByAccount.get(acc.id)
        if (!refund) return acc
        return { ...acc, balance: Math.round((Number(acc.balance) + refund) * 100) / 100 }
      })
    )

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const accountSnaps = await Promise.all(
          accountIds.map((accountId) => transaction.get(doc(db, "users", uid, "accounts", accountId)))
        )

        // 2. WRITES: refund each account, then remove logs, their transactions and the vehicle
        accountSnaps.forEach((snap, index) => {
          if (!snap.exists()) return
          const refund = refundByAccount.get(accountIds[index]) ?? 0
          const balance = Number(snap.data().balance)
          transaction.update(snap.ref, { balance: Math.round((balance + refund) * 100) / 100 })
        })

        associatedLogs.forEach((log) => {
          transaction.delete(doc(db, "users", uid, "vehicleLogs", log.id))
          if (log.transactionId) {
            transaction.delete(doc(db, "users", uid, "transactions", log.transactionId))
          }
        })

        transaction.delete(vehicleRef)
      })
    } catch (err) {
      setAccounts(originalAccounts)
      setVehicles(originalVehicles)
      throw err
    }
  }

  async function addVehicleLog(rawInput: Omit<VehicleLog, "id" | "transactionId">) {
    if (!user) throw new Error("Usuario no autenticado.")

    const input = { ...rawInput } as any
    Object.keys(input).forEach((key) => {
      if (input[key] === undefined) {
        input[key] = null
      }
    })

    const logDocRef = doc(collection(db, "users", user.uid, "vehicleLogs"))
    const logId = logDocRef.id
    const vehicleRef = doc(db, "users", user.uid, "vehicles", input.vehicleId)

    const hasSync = !!input.accountId && input.amount > 0
    const txDocRef = hasSync ? doc(collection(db, "users", user.uid, "transactions")) : null
    const txId = txDocRef?.id ?? null
    const accountRef = input.accountId ? doc(db, "users", user.uid, "accounts", input.accountId) : null

    const originalAccounts = [...accounts]
    const originalVehicles = [...vehicles]

    // Optimistically update account balances
    if (hasSync && input.accountId) {
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === input.accountId) {
            return { ...acc, balance: Number(acc.balance) - input.amount }
          }
          return acc
        })
      )
    }

    // Optimistically update vehicle odometer
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === input.vehicleId && input.odometer > v.odometer) {
          return { ...v, odometer: input.odometer }
        }
        return v
      })
    )

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const vehSnap = await transaction.get(vehicleRef)
        if (!vehSnap.exists()) {
          throw new Error("El vehículo no existe.")
        }
        const vehData = vehSnap.data() as Vehicle
        const currentOdometer = Number(vehData.odometer)

        let newBalance = 0
        let accountCurrency: Currency | null = null
        if (accountRef) {
          const accSnap = await transaction.get(accountRef)
          if (!accSnap.exists()) {
            throw new Error("La cuenta seleccionada no existe.")
          }
          const accData = accSnap.data() as Account
          accountCurrency = accData.currency
          newBalance = Number(accData.balance) - input.amount
        }

        // 2. WRITES
        // Save vehicle log
        transaction.set(logDocRef, {
          id: logId,
          ...input,
          transactionId: txId || null,
        })

        // Update vehicle odometer if higher
        if (input.odometer > currentOdometer) {
          transaction.update(vehicleRef, { odometer: input.odometer })
        }

        // Create transaction and update account balance if synced
        if (txDocRef && accountRef) {
          let note = `[${vehData.name}] `
          if (input.type === "fuel") {
            note += `Combustible ${input.gasStation || ""} (${input.liters || 0} L)`
          } else if (input.type === "service") {
            note += `Service: ${input.serviceType || ""}`
          } else if (input.type === "part") {
            note += `Repuesto: ${input.itemName || ""}`
          } else if (input.type === "gear") {
            note += `Indumentaria: ${input.itemName || ""}`
          } else if (input.type === "insurance") {
            note += `Seguro / Patente`
          } else {
            note += `Gasto`
          }
          if (input.note) {
            note += ` - ${input.note}`
          }

          transaction.set(txDocRef, {
            id: txId,
            type: "expense",
            amount: input.amount,
            accountId: input.accountId,
            currency: accountCurrency,
            toAccountId: null,
            toAmount: null,
            exchangeRate: null,
            category: "Transporte",
            note: note,
            date: input.date,
            receiptName: null,
            vehicleId: input.vehicleId || null,
          })

          transaction.update(accountRef, { balance: newBalance })
        }
      })
    } catch (err) {
      setAccounts(originalAccounts)
      setVehicles(originalVehicles)
      throw err
    }
  }

  async function updateVehicleLog(id: string, rawInput: Omit<VehicleLog, "id">) {
    if (!user) throw new Error("Usuario no autenticado.")

    const input = { ...rawInput } as any
    Object.keys(input).forEach((key) => {
      if (input[key] === undefined) {
        input[key] = null
      }
    })

    const logDocRef = doc(db, "users", user.uid, "vehicleLogs", id)
    const oldLog = vehicleLogs.find((vl) => vl.id === id)
    if (!oldLog) throw new Error("El registro no existe.")

    const vehicleRef = doc(db, "users", user.uid, "vehicles", input.vehicleId)

    const originalAccounts = [...accounts]
    const originalVehicles = [...vehicles]

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const vehSnap = await transaction.get(vehicleRef)
        if (!vehSnap.exists()) throw new Error("El vehículo no existe.")
        const vehData = vehSnap.data() as Vehicle
        const currentOdometer = Number(vehData.odometer)

        let oldAccSnap = null
        if (oldLog.accountId) {
          const oldAccRef = doc(db, "users", user.uid, "accounts", oldLog.accountId)
          oldAccSnap = await transaction.get(oldAccRef)
        }

        let newAccSnap = null
        if (input.accountId) {
          if (oldLog.accountId === input.accountId) {
            newAccSnap = oldAccSnap
          } else {
            const newAccRef = doc(db, "users", user.uid, "accounts", input.accountId)
            newAccSnap = await transaction.get(newAccRef)
          }
        }

        // 2. WRITES
        let oldAccFinalBalance = oldAccSnap && oldAccSnap.exists() ? Math.round((Number(oldAccSnap.data().balance) + oldLog.amount) * 100) / 100 : 0
        let newAccFinalBalance = 0

        if (input.accountId && newAccSnap && newAccSnap.exists()) {
          if (oldLog.accountId === input.accountId) {
            newAccFinalBalance = Math.round((oldAccFinalBalance - input.amount) * 100) / 100
            oldAccFinalBalance = newAccFinalBalance
          } else {
            newAccFinalBalance = Math.round((Number(newAccSnap.data().balance) - input.amount) * 100) / 100
          }
        }

        // Apply account balance updates
        if (oldLog.accountId && oldAccSnap && oldAccSnap.exists()) {
          const oldAccRef = doc(db, "users", user.uid, "accounts", oldLog.accountId)
          transaction.update(oldAccRef, { balance: oldAccFinalBalance })
        }
        if (input.accountId && newAccSnap && newAccSnap.exists() && oldLog.accountId !== input.accountId) {
          const newAccRef = doc(db, "users", user.uid, "accounts", input.accountId)
          transaction.update(newAccRef, { balance: newAccFinalBalance })
        }

        // Manage transaction document (link, update, or unlink)
        const finalTxDocRef = oldLog.transactionId
          ? doc(db, "users", user.uid, "transactions", oldLog.transactionId)
          : input.accountId
            ? doc(collection(db, "users", user.uid, "transactions"))
            : null
        const finalTxId = finalTxDocRef?.id ?? null

        if (oldLog.transactionId && !input.accountId) {
          const oldTxRef = doc(db, "users", user.uid, "transactions", oldLog.transactionId)
          transaction.delete(oldTxRef)
        } else if (finalTxDocRef && input.accountId) {
          let note = `[${vehData.name}] `
          if (input.type === "fuel") {
            note += `Combustible ${input.gasStation || ""} (${input.liters || 0} L)`
          } else if (input.type === "service") {
            note += `Service: ${input.serviceType || ""}`
          } else if (input.type === "part") {
            note += `Repuesto: ${input.itemName || ""}`
          } else if (input.type === "gear") {
            note += `Indumentaria: ${input.itemName || ""}`
          } else if (input.type === "insurance") {
            note += `Seguro / Patente`
          } else {
            note += `Gasto`
          }
          if (input.note) {
            note += ` - ${input.note}`
          }

          transaction.set(finalTxDocRef, {
            id: finalTxId,
            type: "expense",
            amount: input.amount,
            accountId: input.accountId,
            currency: (newAccSnap!.data() as Account).currency,
            toAccountId: null,
            toAmount: null,
            exchangeRate: null,
            category: "Transporte",
            note: note,
            date: input.date,
            receiptName: null,
            vehicleId: input.vehicleId || null,
          })
        }

        // Update vehicle log doc
        transaction.set(logDocRef, {
          id: id,
          ...input,
          transactionId: finalTxId || null,
        })

        // Update odometer if higher
        if (input.odometer > currentOdometer) {
          transaction.update(vehicleRef, { odometer: input.odometer })
        }
      })
    } catch (err) {
      setAccounts(originalAccounts)
      setVehicles(originalVehicles)
      throw err
    }
  }

  async function deleteVehicleLog(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")

    const logDocRef = doc(db, "users", user.uid, "vehicleLogs", id)
    const oldLog = vehicleLogs.find((vl) => vl.id === id)
    if (!oldLog) throw new Error("El registro no existe.")

    const originalAccounts = [...accounts]

    try {
      await runTransaction(db, async (transaction) => {
        if (oldLog.accountId && oldLog.transactionId) {
          const accRef = doc(db, "users", user.uid, "accounts", oldLog.accountId)
          const accSnap = await transaction.get(accRef)
          if (accSnap.exists()) {
            const accData = accSnap.data() as Account
            transaction.update(accRef, { balance: Math.round((Number(accData.balance) + oldLog.amount) * 100) / 100 })
          }

          const txRef = doc(db, "users", user.uid, "transactions", oldLog.transactionId)
          transaction.delete(txRef)
        }

        transaction.delete(logDocRef)
      })
    } catch (err) {
      setAccounts(originalAccounts)
      throw err
    }
  }

  // --- Due Dates & Recurring Services Management ---

  function calcNextDueDate(currentDueDate: string, frequency: DueFrequency): string {
    const parts = currentDueDate.split("-").map(Number)
    if (parts.length !== 3 || parts.some(isNaN)) {
      const d = new Date()
      return d.toISOString().split("T")[0]
    }
    const [y, m, d] = parts
    const date = new Date(Date.UTC(y, m - 1, d))

    if (frequency === "monthly") {
      const targetMonth = m
      const targetYear = y + Math.floor(targetMonth / 12)
      const normalizedMonth = targetMonth % 12
      const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
      date.setUTCFullYear(targetYear, normalizedMonth, Math.min(d, lastDay))
    } else if (frequency === "yearly") {
      const lastDay = new Date(Date.UTC(y + 1, m, 0)).getUTCDate()
      date.setUTCFullYear(y + 1, m - 1, Math.min(d, lastDay))
    } else if (frequency === "biweekly") {
      date.setUTCDate(date.getUTCDate() + 14)
    }
    return date.toISOString().split("T")[0]
  }

  async function addDueItem(input: Omit<DueItem, "id" | "createdAt">) {
    if (!user) throw new Error("Usuario no autenticado.")
    const newRef = doc(collection(db, "users", user.uid, "dueItems"))
    await setDoc(newRef, {
      id: newRef.id,
      ...input,
      status: input.status || "pending",
      createdAt: new Date().toISOString(),
    })
  }

  async function updateDueItem(id: string, input: Partial<Omit<DueItem, "id">>) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "dueItems", id)
    await setDoc(docRef, { ...input, updatedAt: new Date().toISOString() }, { merge: true })
  }

  async function deleteDueItem(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "dueItems", id)
    const { deleteDoc } = await import("firebase/firestore")
    await deleteDoc(docRef)
  }

  async function markDueItemAsPaid(
    id: string,
    registerTx?: { accountId: string; amount?: number; category?: string; note?: string }
  ) {
    if (!user) throw new Error("Usuario no autenticado.")
    const expectedItem = dueItems.find((item) => item.id === id)
    if (!expectedItem) throw new Error("El vencimiento no existe.")
    const nowIso = new Date().toISOString()
    const docRef = doc(db, "users", user.uid, "dueItems", id)
    const accountRef = registerTx?.accountId
      ? doc(db, "users", user.uid, "accounts", registerTx.accountId)
      : null
    const txRef = doc(collection(db, "users", user.uid, "transactions"))
    const txId = txRef.id

    await runTransaction(db, async (transaction) => {
      const itemSnap = await transaction.get(docRef)
      if (!itemSnap.exists()) throw new Error("El vencimiento no existe.")
      const item = { id: itemSnap.id, ...itemSnap.data() } as DueItem
      if (item.status === "paid") throw new Error("El vencimiento ya fue pagado.")
      if (item.dueDate !== expectedItem.dueDate) {
        throw new Error("Este vencimiento ya fue procesado o actualizado.")
      }

      const accountSnap = accountRef ? await transaction.get(accountRef) : null
      if (accountRef && !accountSnap?.exists()) throw new Error("La cuenta seleccionada no existe.")

      if (accountRef && accountSnap) {
        const amount = registerTx?.amount ?? item.amount
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe no es válido.")
        const accountData = accountSnap.data() as Account
        if (item.currency && accountData.currency !== item.currency) {
          throw new Error(
            `El vencimiento está en ${item.currency} y la cuenta seleccionada es en ${accountData.currency}. Elegí una cuenta en ${item.currency}.`
          )
        }
        const balance = Number(accountData.balance)
        transaction.update(accountRef, { balance: Math.round((balance - amount) * 100) / 100 })
        transaction.set(txRef, {
          id: txId,
          type: "expense",
          amount: Math.round(amount * 100) / 100,
          accountId: registerTx!.accountId,
          currency: accountData.currency,
          toAccountId: null,
          toAmount: null,
          exchangeRate: null,
          category: registerTx?.category || item.category || "Servicios",
          note: registerTx?.note || `Pago de vencimiento: ${item.title}`,
          date: nowIso,
          receiptName: null,
        })
      }

      const recurring = item.autoRenew && item.frequency !== "one_time"
      transaction.update(docRef, {
        ...(recurring ? { dueDate: calcNextDueDate(item.dueDate, item.frequency) } : {}),
        status: recurring ? "pending" : "paid",
        paidAt: nowIso,
        updatedAt: nowIso,
      })
    })
  }

  async function markDueItemAsPending(id: string) {
    if (!user) throw new Error("Usuario no autenticado.")
    const docRef = doc(db, "users", user.uid, "dueItems", id)
    await setDoc(
      docRef,
      {
        status: "pending",
        paidAt: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  async function saveFCMToken(token: string) {
    if (!user || !token) return
    const tokenRef = doc(db, "users", user.uid, "fcmTokens", token)
    await setDoc(tokenRef, {
      token,
      updatedAt: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    })
  }

  async function updateMacroSettings(settings: Partial<MacroSettings>) {
    const updated = {
      ...macroSettings,
      ...settings,
      lastUpdated: new Date().toISOString(),
    }
    setMacroSettings(updated)
    if (user) {
      const macroRef = doc(db, "users", user.uid, "settings", "macro")
      await setDoc(macroRef, updated, { merge: true })
    }
  }

  async function syncMacroFromApi(): Promise<MacroSettings> {
    try {
      const res = await fetch("/api/macro", { headers: await getApiAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        const newSettings: MacroSettings = {
          exchangeRate: data.recommendedExchangeRate ?? 1250,
          annualInflation: data.annualInflation ?? 45,
          annualDevaluation: data.annualDevaluation ?? 40,
          annualReturn: data.annualReturn ?? 12,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          rates: data.rates,
        }
        await updateMacroSettings(newSettings)
        return newSettings
      }
    } catch (e) {
      console.error("Error syncing macro data from API:", e)
    }
    return macroSettings
  }

  const totalsByCurrency = useMemo(() => {
    return accounts.reduce(
      (acc, a) => {
        acc[a.currency] = (acc[a.currency] ?? 0) + Number(a.balance)
        return acc
      },
      { ARS: 0, USD: 0 } as Record<Currency, number>,
    )
  }, [accounts])

  const value: FinanceContextValue = {
    user,
    loading,
    login,
    loginWithGoogle,
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
    saveFCMToken,
    macroSettings,
    updateMacroSettings,
    syncMacroFromApi,
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
