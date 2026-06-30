"use client"

import { useFinance } from "./finance-provider"
import { DashboardHeader } from "./dashboard-header"
import { WalletCards } from "./wallet-cards"
import { ExpenseChart } from "./expense-chart"
import { TransactionList } from "./transaction-list"
import type { Transaction } from "@/lib/finance-data"

export function HomeView({
  onAddAccount,
  onSeeAll,
  onSeeAnalytics,
  onEditTransaction,
}: {
  onAddAccount: () => void
  onSeeAll: () => void
  onSeeAnalytics: () => void
  onEditTransaction: (tx: Transaction) => void
}) {
  const { transactions } = useFinance()
  const recent = transactions.slice(0, 5)

  return (
    <div>
      <DashboardHeader />
      <WalletCards onAddAccount={onAddAccount} />
      <ExpenseChart onSeeAnalytics={onSeeAnalytics} />

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Movimientos recientes</h2>
          <button onClick={onSeeAll} className="text-xs font-medium text-primary">
            Ver todos
          </button>
        </div>
        <div className="mt-1">
          <TransactionList transactions={recent} onEditTransaction={onEditTransaction} />
        </div>
      </section>
    </div>
  )
}
