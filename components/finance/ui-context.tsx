"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Account, Transaction } from "@/lib/finance-data"
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  storeThemePreference,
  type Theme,
  type ThemePreference,
} from "@/lib/theme"

interface UIContextType {
  txOpen: boolean
  anotarOpen: boolean
  accountOpen: boolean
  exchangeOpen: boolean
  exportOpen: boolean
  categoriesOpen: boolean
  securityOpen: boolean
  editingAccount: Account | null
  editingTransaction: Transaction | null
  handleAddAccount: () => void
  handleEditAccount: (acc: Account) => void
  handleAddTransaction: () => void
  /** Abre la barra Anotar: carga en una línea o pregunta al historial. */
  handleOpenAnotar: () => void
  handleCloseAnotar: () => void
  handleEditTransaction: (tx: Transaction) => void
  handleOpenExchange: () => void
  handleCloseExchange: () => void
  handleOpenExport: () => void
  handleCloseExport: () => void
  handleOpenCategories: () => void
  handleCloseCategories: () => void
  handleOpenSecurity: () => void
  handleCloseSecurity: () => void
  handleCloseTxSheet: () => void
  handleCloseAccountSheet: () => void
  balancesHidden: boolean
  toggleBalancesHidden: () => void
  /** Reemplaza un importe por puntos cuando el usuario ocultó los saldos. */
  mask: (value: string) => string
  /** Lo que eligió el usuario; "system" sigue al sistema operativo. */
  themePreference: ThemePreference
  /** El tema que se ve ahora. */
  theme: Theme
  setThemePreference: (preference: ThemePreference) => void
}

const UIContext = createContext<UIContextType | null>(null)

const BALANCES_HIDDEN_KEY = "plata:balances-hidden"

export function UIProvider({ children }: { children: ReactNode }) {
  const [txOpen, setTxOpen] = useState(false)
  const [anotarOpen, setAnotarOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [balancesHidden, setBalancesHidden] = useState(false)
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system")
  const [theme, setTheme] = useState<Theme>("light")

  // Se lee después de montar para no desincronizar el HTML del servidor.
  useEffect(() => {
    try {
      setBalancesHidden(localStorage.getItem(BALANCES_HIDDEN_KEY) === "1")
    } catch {}
  }, [])

  // El script del <head> ya pintó el tema correcto; acá sólo se sincroniza el
  // estado y, si sigue al sistema, se escucha cuando el sistema cambia.
  useEffect(() => {
    setThemePreferenceState(readThemePreference())
  }, [])

  useEffect(() => {
    applyTheme(themePreference)
    setTheme(resolveTheme(themePreference))
    if (themePreference !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      applyTheme("system")
      setTheme(resolveTheme("system"))
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [themePreference])

  const setThemePreference = useCallback((preference: ThemePreference) => {
    storeThemePreference(preference)
    setThemePreferenceState(preference)
  }, [])

  function toggleBalancesHidden() {
    setBalancesHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(BALANCES_HIDDEN_KEY, next ? "1" : "0")
      } catch {}
      return next
    })
  }

  const mask = (value: string) => (balancesHidden ? "••••••" : value)

  function handleAddAccount() {
    setEditingAccount(null)
    setAccountOpen(true)
  }

  function handleEditAccount(acc: Account) {
    setEditingAccount(acc)
    setAccountOpen(true)
  }

  function handleAddTransaction() {
    setEditingTransaction(null)
    setTxOpen(true)
  }

  // Estable: el shell lo engancha a un atajo de teclado global.
  const handleOpenAnotar = useCallback(() => setAnotarOpen(true), [])

  function handleCloseAnotar() {
    setAnotarOpen(false)
  }

  function handleEditTransaction(tx: Transaction) {
    setEditingTransaction(tx)
    setTxOpen(true)
  }

  function handleOpenExchange() {
    setExchangeOpen(true)
  }

  function handleCloseExchange() {
    setExchangeOpen(false)
  }

  function handleOpenExport() {
    setExportOpen(true)
  }

  function handleCloseExport() {
    setExportOpen(false)
  }

  function handleOpenCategories() {
    setCategoriesOpen(true)
  }

  function handleCloseCategories() {
    setCategoriesOpen(false)
  }

  function handleOpenSecurity() {
    setSecurityOpen(true)
  }

  function handleCloseSecurity() {
    setSecurityOpen(false)
  }

  function handleCloseTxSheet() {
    setTxOpen(false)
    setEditingTransaction(null)
  }

  function handleCloseAccountSheet() {
    setAccountOpen(false)
    setEditingAccount(null)
  }

  return (
    <UIContext.Provider
      value={{
        txOpen,
        anotarOpen,
        accountOpen,
        exchangeOpen,
        exportOpen,
        categoriesOpen,
        securityOpen,
        editingAccount,
        editingTransaction,
        handleAddAccount,
        handleEditAccount,
        handleAddTransaction,
        handleOpenAnotar,
        handleCloseAnotar,
        handleEditTransaction,
        handleOpenExchange,
        handleCloseExchange,
        handleOpenExport,
        handleCloseExport,
        handleOpenCategories,
        handleCloseCategories,
        handleOpenSecurity,
        handleCloseSecurity,
        handleCloseTxSheet,
        handleCloseAccountSheet,
        balancesHidden,
        toggleBalancesHidden,
        mask,
        themePreference,
        theme,
        setThemePreference,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error("useUI must be used within a UIProvider")
  }
  return context
}
