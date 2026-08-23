"use client"

import { useFinance } from "./finance-provider"
import { DashboardHeader } from "./dashboard-header"
import { WalletCards } from "./wallet-cards"
import { ExpenseChart } from "./expense-chart"
import { TransactionList } from "./transaction-list"
import type { Transaction } from "@/lib/finance-data"
import { useUI } from "./ui-context"

export function HomeView({
  onAddAccount,
  onAddTransaction,
  onSeeAll,
  onSeeAnalytics,
  onEditTransaction,
  onOpenExchange,
}: {
  onAddAccount: () => void
  onAddTransaction?: () => void
  onSeeAll: () => void
  onSeeAnalytics: () => void
  onEditTransaction: (tx: Transaction) => void
  onOpenExchange: () => void
}) {
  const { transactions } = useFinance()
  const ui = useUI()
  const recent = transactions.slice(0, 5)

  const handleAddTx = onAddTransaction || ui.handleAddTransaction

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-12 font-sans space-y-6">
      {/* Una sola instancia de cada bloque: la grilla reordena en lg en vez de
          montar WalletCards dos veces (una oculta por CSS). */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 xl:col-span-8">
          <DashboardHeader
            onOpenExchange={onOpenExchange}
            onAddAccount={onAddAccount}
            onAddTransaction={handleAddTx}
          />
        </div>

        {/* En mobile queda justo debajo del header; en lg pasa a la columna derecha. */}
        <div className="lg:col-span-5 xl:col-span-4 lg:row-span-2 lg:sticky lg:top-6">
          <WalletCards onAddAccount={onAddAccount} />
        </div>

        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <ExpenseChart onSeeAnalytics={onSeeAnalytics} className="w-full" />

          <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Movimientos Recientes
              </h2>
              <button
                onClick={onSeeAll}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Ver historial completo →
              </button>
            </div>
            <div className="mt-2">
              <TransactionList transactions={recent} onEditTransaction={onEditTransaction} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
