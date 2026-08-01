"use client"

import { VencimientosView } from "@/components/finance/vencimientos-view"

export default function VencimientosAliasPage() {
  return (
    <>
      <div className="md:hidden">
        <VencimientosView />
      </div>
      <div className="hidden md:block">
        <VencimientosView isDesktop />
      </div>
    </>
  )
}
