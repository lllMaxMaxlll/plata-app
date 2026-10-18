"use client"

import { ReactNode } from "react"
import { FinanceProvider } from "@/components/finance/finance-provider"
import { UIProvider } from "@/components/finance/ui-context"
import { ConfirmProvider } from "@/components/finance/confirm-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <FinanceProvider>
        <UIProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </UIProvider>
      </FinanceProvider>
    </TooltipProvider>
  )
}

