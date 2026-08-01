"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { Account, Transaction } from "@/lib/finance-data"

interface UIContextType {
  txOpen: boolean
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
}

const UIContext = createContext<UIContextType | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [txOpen, setTxOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

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
