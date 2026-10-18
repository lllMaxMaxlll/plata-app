"use client"

import { AnalyticsView } from "@/components/finance/analytics-view"
import { useUI } from "@/components/finance/ui-context"

export default function AnalyticsPage() {
  const ui = useUI()

  return <AnalyticsView onEditTransaction={ui.handleEditTransaction} />
}
