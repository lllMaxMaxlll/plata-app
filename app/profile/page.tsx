"use client"

import { useRouter } from "next/navigation"
import { ProfileView } from "@/components/finance/profile-view"
import { useUI } from "@/components/finance/ui-context"

export default function ProfilePage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <ProfileView
      onManageCategories={ui.handleOpenCategories}
      onManageSecurity={ui.handleOpenSecurity}
      onBack={() => router.push("/more")}
    />
  )
}

