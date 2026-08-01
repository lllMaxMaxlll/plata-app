"use client"

import { useRouter } from "next/navigation"
import { StocksView } from "@/components/finance/stocks-view"
import { DesktopPortfolio } from "@/components/finance/desktop-view"

export default function StocksPage() {
  const router = useRouter()
  const dummyMask = (v: string) => v

  return (
    <>
      <div className="md:hidden">
        <StocksView onBack={() => router.push("/more")} />
      </div>
      <div className="hidden md:block">
        <DesktopPortfolio mask={dummyMask} />
      </div>
    </>
  )
}
