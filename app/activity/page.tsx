"use client"

import { useRouter } from "next/navigation"
import { ActivityView } from "@/components/finance/activity-view"
import { DesktopActivity } from "@/components/finance/desktop-view"
import { useUI } from "@/components/finance/ui-context"

export default function ActivityPage() {
  const router = useRouter()
  const ui = useUI()

  return (
    <>
      <div className="md:hidden">
        <ActivityView
          onEditTransaction={ui.handleEditTransaction}
          onOpenExport={ui.handleOpenExport}
          onBack={() => router.push("/more")}
        />
      </div>
      <div className="hidden md:block">
        <DesktopActivity
          onEditTransaction={ui.handleEditTransaction}
          onOpenExport={ui.handleOpenExport}
        />
      </div>
    </>
  )
}
