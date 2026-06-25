import { FinanceProvider } from "@/components/finance/finance-provider"
import { FinanceApp } from "@/components/finance/finance-app"

export default function Page() {
  return (
    <FinanceProvider>
      <FinanceApp />
    </FinanceProvider>
  )
}
