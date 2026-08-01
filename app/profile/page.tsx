"use client"

import { useRouter } from "next/navigation"
import { ProfileView } from "@/components/finance/profile-view"
import { DesktopProfile } from "@/components/finance/desktop-view"
import { useUI } from "@/components/finance/ui-context"

export default function ProfilePage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <>
      <div className="md:hidden">
        <ProfileView
          onManageCategories={ui.handleOpenCategories}
          onManageSecurity={ui.handleOpenSecurity}
          onBack={() => router.push("/more")}
        />
      </div>
      <div className="hidden md:block">
        <DesktopProfile
          onManageCategories={ui.handleOpenCategories}
          onManageSecurity={ui.handleOpenSecurity}
        />
      </div>
    </>
  )
}
