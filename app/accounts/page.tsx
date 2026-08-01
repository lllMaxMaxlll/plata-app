"use client"

import { AccountsView } from "@/components/finance/accounts-view"
import { DesktopAccounts } from "@/components/finance/desktop-view"
import { useUI } from "@/components/finance/ui-context"

export default function AccountsPage() {
  const ui = useUI()
  const dummyMask = (v: string) => v

  return (
    <>
      <div className="md:hidden">
        <AccountsView
          onAddAccount={ui.handleAddAccount}
          onEditAccount={ui.handleEditAccount}
        />
      </div>
      <div className="hidden md:block">
        <DesktopAccounts
          mask={dummyMask}
          onAddAccount={ui.handleAddAccount}
          onEditAccount={ui.handleEditAccount}
        />
      </div>
    </>
  )
}
