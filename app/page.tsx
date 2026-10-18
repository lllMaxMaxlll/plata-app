"use client"

import { HomeView } from "@/components/finance/home-view"
import { useUI } from "@/components/finance/ui-context"

export default function HomePage() {
  const ui = useUI()

  return <HomeView onEditTransaction={ui.handleEditTransaction} />
}
