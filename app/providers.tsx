"use client"

import { ReactNode } from "react"
import { FinanceProvider } from "@/components/finance/finance-provider"
import { UIProvider } from "@/components/finance/ui-context"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <FinanceProvider>
        <UIProvider>{children}</UIProvider>
      </FinanceProvider>
    </TooltipProvider>
  )
}

