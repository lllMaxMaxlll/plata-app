"use client"

import { useState } from "react"
import { useFinance } from "./finance-provider"
import { AuthView } from "./auth-view"
import { HomeView } from "./home-view"
import { AccountsView } from "./accounts-view"
import { ActivityView } from "./activity-view"
import { ProfileView } from "./profile-view"
import { StocksView } from "./stocks-view"
import { VehiclesView } from "./vehicles-view"
import { BottomNav, type View } from "./bottom-nav"
import { TransactionSheet } from "./transaction-sheet"
import { AddAccountSheet } from "./add-account-sheet"
import { DesktopView } from "./desktop-view"
import { LoadingSkeleton } from "./loading-skeleton"
import { ManageCategoriesSheet } from "./manage-categories-sheet"
import { SecuritySheet } from "./security-sheet"
import { AdvisorView } from "./advisor-view"
import { AnalyticsView } from "./analytics-view"
import { CurrencyExchangeSheet } from "./currency-exchange-sheet"
import type { Account, Transaction } from "@/lib/finance-data"

export function FinanceApp() {
  const { user, loading } = useFinance()
  const [view, setView] = useState<View>("home")
  const [txOpen, setTxOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
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

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!user) {
    return <AuthView />
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden mx-auto min-h-dvh w-full max-w-md bg-background">
        <main className="pb-28">
          {view === "home" && (
            <HomeView
              onAddAccount={handleAddAccount}
              onSeeAll={() => setView("activity")}
              onSeeAnalytics={() => setView("analytics")}
              onEditTransaction={handleEditTransaction}
              onOpenExchange={() => setExchangeOpen(true)}
            />
          )}
          {view === "accounts" && (
            <AccountsView onAddAccount={handleAddAccount} onEditAccount={handleEditAccount} />
          )}
          {view === "vehicles" && (
            <VehiclesView />
          )}
          {view === "stocks" && (
            <StocksView />
          )}
          {view === "activity" && (
            <ActivityView onEditTransaction={handleEditTransaction} />
          )}
          {view === "profile" && (
            <ProfileView
              onManageCategories={() => setCategoriesOpen(true)}
              onManageSecurity={() => setSecurityOpen(true)}
            />
          )}
          {view === "advisor" && (
            <AdvisorView />
          )}
          {view === "analytics" && (
            <AnalyticsView onBack={() => setView("home")} onEditTransaction={handleEditTransaction} />
          )}
        </main>

        <BottomNav active={view} onChange={setView} onAdd={handleAddTransaction} />
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex min-h-screen bg-background">
        <DesktopView
          view={view}
          setView={setView}
          onAddAccount={handleAddAccount}
          onEditAccount={handleEditAccount}
          onAddTransaction={handleAddTransaction}
          onEditTransaction={handleEditTransaction}
          onManageCategories={() => setCategoriesOpen(true)}
          onManageSecurity={() => setSecurityOpen(true)}
          onOpenExchange={() => setExchangeOpen(true)}
        />
      </div>

      {/* Shared Dialogs / sheets */}
      <TransactionSheet
        open={txOpen}
        onClose={() => {
          setTxOpen(false)
          setEditingTransaction(null)
        }}
        transaction={editingTransaction}
      />
      <AddAccountSheet
        open={accountOpen}
        onClose={() => {
          setAccountOpen(false)
          setEditingAccount(null)
        }}
        account={editingAccount}
      />
      <ManageCategoriesSheet
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
      />
      <SecuritySheet
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
      <CurrencyExchangeSheet
        open={exchangeOpen}
        onClose={() => setExchangeOpen(false)}
      />
    </>
  )
}
