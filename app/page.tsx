"use client"

import { useRouter } from "next/navigation"
import { HomeView } from "@/components/finance/home-view"
import { useUI } from "@/components/finance/ui-context"

export default function HomePage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <HomeView
      onAddAccount={ui.handleAddAccount}
      onSeeAll={() => router.push("/activity")}
      onSeeAnalytics={() => router.push("/analytics")}
      onEditTransaction={ui.handleEditTransaction}
      onOpenExchange={ui.handleOpenExchange}
    />
  )
}

