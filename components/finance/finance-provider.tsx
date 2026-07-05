"use client"

import { createContext, useContext, useMemo, useState, useEffect, useCallback, type ReactNode } from "react"
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
  type VehicleType,
  type VehicleLogType,
} from "@/lib/finance-data"
import { auth, db } from "@/lib/firebase"
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
        return onSnapshot(stockTxsRef, (snapshot) => {
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

    return () => {
      unsubscribeAccounts()
      unsubscribeTransactions()
      unsubscribeCategories()
      unsubscribeWatchlist()
      unsubscribeStockTxs()
      unsubscribeVehicles()
      unsubscribeVehicleLogs()
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

    const txId = `t-${Date.now()}`
    const txDocRef = doc(db, "users", user.uid, "transactions", txId)

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

        // 2. Calculate new balances
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
 
        // 3. Apply new transaction balance changes
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
      const res = await fetch(`/api/stocks?symbols=${symbols.join(",")}`)
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
      console.warn("Error fetching prices from API, simulating instead:", err)
    }

    // Fallback simulation if API fails or offline
    setStockPrices((prev) => {
      const updated = { ...prev }
      symbols.forEach((sym) => {
        const current = updated[sym] || {
          price: sym === "AAPL" ? 182.3 : sym === "TSLA" ? 184.8 : sym === "MSFT" ? 421.9 : 100,
          change: 0.5,
          name: `${sym} Corp.`,
        }
        const pct = 1 + (Math.random() * 0.003 - 0.0015)
        const newPrice = Number((current.price * pct).toFixed(2))
        const newChange = Number((current.change + (pct - 1) * 100).toFixed(2))
        updated[sym] = {
          price: newPrice,
          change: newChange,
          name: current.name,
        }
      })
      return updated
    })
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

  // Micro-fluctuations every 3 seconds to make the UI look alive
  useEffect(() => {
    const timer = setInterval(() => {
      setStockPrices((prev) => {
        const symbols = Object.keys(prev)
        if (symbols.length === 0) return prev
        const nextPrices = { ...prev }
        symbols.forEach((sym) => {
          const current = nextPrices[sym]
          const changePct = (Math.random() * 0.0008 - 0.0004)
          const newPrice = Number((current.price * (1 + changePct)).toFixed(2))
          nextPrices[sym] = {
            ...current,
            price: newPrice,
            change: Number((current.change + changePct * 100).toFixed(2)),
          }
        })
        return nextPrices
      })
    }, 3000)
    return () => clearInterval(timer)
  }, [])

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

      const priceInfo = stockPrices[symbol] || { price: 100, name: `${symbol} Corp.` }
      const currentPrice = priceInfo.price
      const name = priceInfo.name
      const avgBuyPrice = Number((value.totalCost / value.shares).toFixed(2))
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
      const res = await fetch(`/api/stocks?symbols=${cleanSym}`)
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
    const txId = `st-${Date.now()}`
    const txDocRef = doc(db, "users", user.uid, "stockTransactions", txId)
    const accountRef = doc(db, "users", user.uid, "accounts", input.accountId)

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
        if (!accSnap.exists()) {
          throw new Error("La cuenta seleccionada no existe.")
        }
        const accData = accSnap.data() as Account
        const bal = Number(accData.balance)

        if (input.type === "buy" && bal < totalAmount) {
          throw new Error("Saldo insuficiente en la cuenta seleccionada.")
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

        const finTxId = `t-${Date.now()}`
        const finTxDocRef = doc(db, "users", user.uid, "transactions", finTxId)

        transaction.set(finTxDocRef, {
          id: finTxId,
          type: input.type === "buy" ? "expense" : "income",
          amount: totalAmount,
          accountId: input.accountId,
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

    // We will delete the vehicle doc
    const docRef = doc(db, "users", user.uid, "vehicles", id)
    const { deleteDoc } = await import("firebase/firestore")
    await deleteDoc(docRef)

    // Delete associated logs and transactions
    const associatedLogs = vehicleLogs.filter((vl) => vl.vehicleId === id)
    if (associatedLogs.length > 0) {
      const batch = writeBatch(db)
      associatedLogs.forEach((log) => {
        const logRef = doc(db, "users", user.uid, "vehicleLogs", log.id)
        batch.delete(logRef)
        if (log.transactionId) {
          const txRef = doc(db, "users", user.uid, "transactions", log.transactionId)
          batch.delete(txRef)
        }
      })
      await batch.commit()
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

    const logId = `vl-${Date.now()}`
    const logDocRef = doc(db, "users", user.uid, "vehicleLogs", logId)
    const vehicleRef = doc(db, "users", user.uid, "vehicles", input.vehicleId)

    const hasSync = !!input.accountId && input.amount > 0
    const txId = hasSync ? `t-${Date.now()}` : null
    const txDocRef = txId ? doc(db, "users", user.uid, "transactions", txId) : null
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
        if (accountRef) {
          const accSnap = await transaction.get(accountRef)
          if (!accSnap.exists()) {
            throw new Error("La cuenta seleccionada no existe.")
          }
          const accData = accSnap.data() as Account
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
        const finalTxId = oldLog.transactionId || (input.accountId ? `t-${Date.now()}` : null)
        const finalTxDocRef = finalTxId ? doc(db, "users", user.uid, "transactions", finalTxId) : null

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
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
