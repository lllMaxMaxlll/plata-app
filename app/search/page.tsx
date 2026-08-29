"use client"

import { SearchView } from "@/components/finance/search-view"
import { useUI } from "@/components/finance/ui-context"

export default function SearchPage() {
  const ui = useUI()

  return <SearchView onEditTransaction={ui.handleEditTransaction} />
}
