"use client"

import { useRouter } from "next/navigation"
import { HomeView } from "@/components/finance/home-view"
import { DesktopHome } from "@/components/finance/desktop-view"
import { useUI } from "@/components/finance/ui-context"

export default function HomePage() {
  const router = useRouter()
  const ui = useUI()

  const dummyMask = (v: string) => v

  return (
    <>
      <div className="md:hidden">
        <HomeView
          onAddAccount={ui.handleAddAccount}
          onSeeAll={() => router.push("/activity")}
          onSeeAnalytics={() => router.push("/analytics")}
          onEditTransaction={ui.handleEditTransaction}
          onOpenExchange={ui.handleOpenExchange}
        />
      </div>
      <div className="hidden md:block">
        <DesktopHome
          mask={dummyMask}
          onAddAccount={ui.handleAddAccount}
          onEditAccount={ui.handleEditAccount}
          onEditTransaction={ui.handleEditTransaction}
          onSeeAll={() => router.push("/activity")}
          onSeeAnalytics={() => router.push("/analytics")}
        />
      </div>
    </>
  )
}
