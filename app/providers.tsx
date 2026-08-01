"use client"

import { ReactNode } from "react"
import { FinanceProvider } from "@/components/finance/finance-provider"
import { UIProvider } from "@/components/finance/ui-context"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FinanceProvider>
      <UIProvider>{children}</UIProvider>
    </FinanceProvider>
  )
}
