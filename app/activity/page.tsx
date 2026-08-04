"use client"

import { useRouter } from "next/navigation"
import { ActivityView } from "@/components/finance/activity-view"
import { useUI } from "@/components/finance/ui-context"

export default function ActivityPage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <ActivityView
      onEditTransaction={ui.handleEditTransaction}
      onOpenExport={ui.handleOpenExport}
      onBack={() => router.push("/more")}
    />
  )
}

