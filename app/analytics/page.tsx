"use client"

import { useRouter } from "next/navigation"
import { AnalyticsView } from "@/components/finance/analytics-view"
import { useUI } from "@/components/finance/ui-context"

export default function AnalyticsPage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <>
      <div className="md:hidden">
        <AnalyticsView
          onBack={() => router.push("/")}
          onEditTransaction={ui.handleEditTransaction}
        />
      </div>
      <div className="hidden md:block">
        <AnalyticsView
          isDesktop
          onBack={() => router.push("/")}
          onEditTransaction={ui.handleEditTransaction}
        />
      </div>
    </>
  )
}
