"use client"

import { useRouter } from "next/navigation"
import { StocksView } from "@/components/finance/stocks-view"

export default function StocksPage() {
  const router = useRouter()

  return (
    <StocksView onBack={() => router.push("/more")} />
  )
}

