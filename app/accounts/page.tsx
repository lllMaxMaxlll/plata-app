"use client"

import { AccountsView } from "@/components/finance/accounts-view"
import { useUI } from "@/components/finance/ui-context"

export default function AccountsPage() {
  const ui = useUI()

  return (
    <AccountsView
      onAddAccount={ui.handleAddAccount}
      onEditAccount={ui.handleEditAccount}
    />
  )
}

