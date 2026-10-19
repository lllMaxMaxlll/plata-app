"use client"

import { ReactNode, useEffect } from "react"
import { FinanceProvider } from "@/components/finance/finance-provider"
import { UIProvider } from "@/components/finance/ui-context"
import { ConfirmProvider } from "@/components/finance/confirm-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { startPwa } from "@/lib/pwa"

export function Providers({ children }: { children: ReactNode }) {
  useEffect(startPwa, [])

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

