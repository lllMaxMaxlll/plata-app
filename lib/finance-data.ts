// ---------------------------------------------------------------------------
// Domain types — kept framework-agnostic so they map cleanly to Firestore docs
// ---------------------------------------------------------------------------

export type Currency = "ARS" | "USD"

export type TransactionType = "income" | "expense" | "transfer"

export interface Account {
  id: string
  name: string
  currency: Currency
  balance: number
  /** key used to pick an accent color / icon */
  kind: "bank" | "wallet" | "cash" | "crypto" | "savings"
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  /** primary account: source for expense/transfer, destination for income */
  accountId: string
  /** destination account for transfers */
  toAccountId?: string
  /** amount credited to destination (transfers across currencies) */
  toAmount?: number
  exchangeRate?: number
  category: string
  note?: string
  date: string // ISO string
  receiptName?: string
}

export interface Category {
  id: string
  name: string
  type: "income" | "expense"
  color: string
}

export const DEFAULT_COLORS = [
  "oklch(0.76 0.16 156)", // Emerald
  "oklch(0.7 0.13 230)",  // Blue
  "oklch(0.78 0.15 75)",   // Yellow/Gold
  "oklch(0.66 0.18 350)",  // Orange/Rose
  "oklch(0.64 0.21 22)",   // Red
  "oklch(0.65 0.2 290)",   // Purple
  "oklch(0.7 0.18 330)",   // Pink
  "oklch(0.75 0.14 190)",  // Teal
]

export const INCOME_CATEGORIES = ["Salario", "Efectivo", "Inversiones", "Trabajo Extra"]
export const EXPENSE_CATEGORIES = ["Comida", "Servicios", "Transporte", "Alquiler", "Otros"]


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = "$"
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Math.abs(amount))
  return `${amount < 0 ? "-" : ""}${currency} ${symbol}${formatted}`
}

export function formatShort(amount: number, currency: Currency): string {
  const symbol = currency === "USD" ? "US$" : "$"
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Math.abs(amount))
  return `${amount < 0 ? "-" : ""}${symbol}${formatted}`
}

export const ACCENT_BY_KIND: Record<Account["kind"], string> = {
  bank: "oklch(0.7 0.13 230)",
  wallet: "oklch(0.78 0.15 75)",
  cash: "oklch(0.76 0.16 156)",
  crypto: "oklch(0.78 0.15 75)",
  savings: "oklch(0.66 0.18 350)",
}

export const CATEGORY_COLORS: Record<string, string> = {
  Comida: "var(--chart-1)",
  Servicios: "var(--chart-2)",
  Transporte: "var(--chart-3)",
  Alquiler: "var(--chart-4)",
  Otros: "var(--chart-5)",
}

// ---------------------------------------------------------------------------
// Stocks and Investments Data Types
// ---------------------------------------------------------------------------

export interface WatchlistStock {
  id: string // matches symbol
  symbol: string
  name: string
  addedAt: string
}

export interface StockTransaction {
  id: string
  symbol: string
  type: "buy" | "sell"
  shares: number
  price: number // USD per share
  date: string // ISO string
  accountId: string // linked USD account ID
}

export interface StockHolding {
  symbol: string
  name: string
  shares: number
  avgBuyPrice: number
  totalCost: number
  currentPrice: number
  currentValue: number
  profitLoss: number
  profitLossPercent: number
}

// ---------------------------------------------------------------------------
// Vehicles and Vehicle Expenses Data Types
// ---------------------------------------------------------------------------

export type VehicleType = "motorcycle" | "car" | "truck" | "other"

export interface Vehicle {
  id: string
  name: string
  type: VehicleType
  brand?: string
  model?: string
  year?: number
  plate?: string
  odometer: number // Current odometer reading in km
  fuelCapacity?: number // Tank size in liters (optional)
  createdAt: string
}

export type VehicleLogType = "fuel" | "service" | "part" | "gear" | "insurance" | "other"

export interface VehicleLog {
  id: string
  vehicleId: string
  type: VehicleLogType
  date: string // ISO string
  odometer: number // Km reading at the time of log
  amount: number // Cost
  note?: string

  // Optional link to general transaction/account
  accountId?: string
  transactionId?: string

  // Fuel specific
  liters?: number
  gasStation?: string
  pricePerLiter?: number
  isFullTank?: boolean

  // Service specific
  serviceType?: string
  provider?: string
  nextServiceOdometer?: number
  nextServiceDate?: string

  // Gear / Parts / Other specific
  itemName?: string
}


