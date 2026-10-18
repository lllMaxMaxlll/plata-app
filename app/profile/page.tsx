"use client"

import { ProfileView } from "@/components/finance/profile-view"
import { useUI } from "@/components/finance/ui-context"

export default function ProfilePage() {
  const ui = useUI()

  return (
    <ProfileView
      onManageCategories={ui.handleOpenCategories}
      onManageSecurity={ui.handleOpenSecurity}
    />
  )
}

