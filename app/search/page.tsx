"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SearchView } from "@/components/finance/search-view"
import { useUI } from "@/components/finance/ui-context"

function SearchWithQuery() {
  const ui = useUI()
  const params = useSearchParams()

  return <SearchView onEditTransaction={ui.handleEditTransaction} initialQuery={params.get("q") ?? ""} />
}

export default function SearchPage() {
  // useSearchParams obliga a un borde de Suspense para no bajar toda la ruta a render dinámico.
  return (
    <Suspense>
      <SearchWithQuery />
    </Suspense>
  )
}
