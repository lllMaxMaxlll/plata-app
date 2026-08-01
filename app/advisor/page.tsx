"use client"

import { AdvisorView } from "@/components/finance/advisor-view"

export default function AdvisorPage() {
  return (
    <>
      <div className="md:hidden">
        <AdvisorView />
      </div>
      <div className="hidden md:block">
        <AdvisorView isDesktop />
      </div>
    </>
  )
}
