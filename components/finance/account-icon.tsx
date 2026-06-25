import { Landmark, Wallet, Banknote, Bitcoin, PiggyBank } from "lucide-react"
import type { Account } from "@/lib/finance-data"

const ICONS = {
  bank: Landmark,
  wallet: Wallet,
  cash: Banknote,
  crypto: Bitcoin,
  savings: PiggyBank,
} as const

export function AccountIcon({ kind, className }: { kind: Account["kind"]; className?: string }) {
  const Icon = ICONS[kind]
  return <Icon className={className} />
}
