/**
 * Traducción entre las filas de Postgres y los tipos de dominio de la app.
 *
 * Existe para que la migración no se filtre hacia arriba: los 31 componentes que
 * consumen useFinance() siguen viendo `Account`, `Transaction`, `DueItem`, etc.
 * exactamente como los definía finance-data.ts en la época de Firestore. Postgres
 * usa snake_case y la app camelCase; la costura vive acá y en ningún otro lado.
 */

import type {
  Account,
  Category,
  Currency,
  DueItem,
  StockTransaction,
  Transaction,
  Vehicle,
  VehicleLog,
  WatchlistStock,
} from "@/lib/finance-data"
import type { MacroSettings } from "@/components/finance/finance-provider"
import type { Database } from "@/lib/database.types"

type Updates<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

type Row = Record<string, any>

const nullableNumber = (value: any): number | undefined =>
  value === null || value === undefined ? undefined : Number(value)

/** Viene de la vista account_balances: `balance` es derivado, no un campo guardado. */
export function toAccount(row: Row): Account {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Currency,
    kind: row.kind,
    balance: Number(row.balance ?? 0),
  }
}

export function toTransaction(row: Row): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    accountId: row.account_id ?? "",
    currency: row.currency ?? undefined,
    toAccountId: row.to_account_id ?? undefined,
    toAmount: nullableNumber(row.to_amount),
    exchangeRate: nullableNumber(row.exchange_rate),
    category: row.category,
    note: row.note ?? undefined,
    date: row.occurred_at,
    receiptName: row.receipt_name ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
  }
}

export function toCategory(row: Row): Category {
  return { id: row.id, name: row.name, type: row.type, color: row.color }
}

export function toWatchlistStock(row: Row): WatchlistStock {
  return { id: row.symbol, symbol: row.symbol, name: row.name, addedAt: row.added_at }
}

export function toStockTransaction(row: Row): StockTransaction {
  return {
    id: row.id,
    symbol: row.symbol,
    type: row.side,
    shares: Number(row.shares),
    price: Number(row.price),
    date: row.occurred_at,
    accountId: row.account_id ?? "",
  }
}

export function toVehicle(row: Row): Vehicle {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    year: nullableNumber(row.year),
    plate: row.plate ?? undefined,
    odometer: Number(row.odometer ?? 0),
    fuelCapacity: nullableNumber(row.fuel_capacity),
    createdAt: row.created_at,
  }
}

export function toVehicleLog(row: Row): VehicleLog {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    type: row.type,
    date: row.occurred_at,
    odometer: Number(row.odometer ?? 0),
    amount: Number(row.amount ?? 0),
    note: row.note ?? undefined,
    accountId: row.account_id ?? undefined,
    transactionId: row.transaction_id ?? undefined,
    liters: nullableNumber(row.liters),
    gasStation: row.gas_station ?? undefined,
    pricePerLiter: nullableNumber(row.price_per_liter),
    isFullTank: row.is_full_tank ?? undefined,
    serviceType: row.service_type ?? undefined,
    provider: row.provider ?? undefined,
    nextServiceOdometer: nullableNumber(row.next_service_odometer),
    nextServiceDate: row.next_service_date ?? undefined,
    itemName: row.item_name ?? undefined,
  }
}

/** Los campos sueltos de un VehicleLog que en Postgres viajan como jsonb. */
export function vehicleLogExtras(input: Partial<VehicleLog>) {
  return {
    liters: input.liters ?? null,
    gas_station: input.gasStation ?? null,
    price_per_liter: input.pricePerLiter ?? null,
    is_full_tank: input.isFullTank ?? null,
    service_type: input.serviceType ?? null,
    provider: input.provider ?? null,
    next_service_odometer: input.nextServiceOdometer ?? null,
    next_service_date: input.nextServiceDate ?? null,
    item_name: input.itemName ?? null,
  }
}

export function toDueItem(row: Row): DueItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency as Currency,
    dueDate: row.due_date,
    frequency: row.frequency,
    reminderDaysBefore: Number(row.reminder_days_before ?? 3),
    status: row.status,
    autoRenew: Boolean(row.auto_renew),
    accountId: row.account_id ?? undefined,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

export function toMacroSettings(row: Row): MacroSettings {
  return {
    exchangeRate: Number(row.exchange_rate),
    annualInflation: Number(row.annual_inflation),
    annualDevaluation: Number(row.annual_devaluation),
    annualReturn: Number(row.annual_return),
    lastUpdated: row.updated_at ?? "",
    rates: row.rates ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Dominio -> fila
// ---------------------------------------------------------------------------

export function fromDueItem(input: Partial<DueItem>): Updates<"due_items"> {
  const row: Row = {}
  if (input.title !== undefined) row.title = input.title
  if (input.category !== undefined) row.category = input.category
  if (input.amount !== undefined) row.amount = input.amount
  if (input.currency !== undefined) row.currency = input.currency
  if (input.dueDate !== undefined) row.due_date = input.dueDate
  if (input.frequency !== undefined) row.frequency = input.frequency
  if (input.reminderDaysBefore !== undefined) row.reminder_days_before = input.reminderDaysBefore
  if (input.status !== undefined) row.status = input.status
  if (input.autoRenew !== undefined) row.auto_renew = input.autoRenew
  if (input.accountId !== undefined) row.account_id = input.accountId || null
  if (input.paidAt !== undefined) row.paid_at = input.paidAt
  return row
}

export function fromVehicle(input: Partial<Vehicle>): Updates<"vehicles"> {
  const row: Row = {}
  if (input.name !== undefined) row.name = input.name
  if (input.type !== undefined) row.type = input.type
  if (input.brand !== undefined) row.brand = input.brand || null
  if (input.model !== undefined) row.model = input.model || null
  if (input.year !== undefined) row.year = input.year ?? null
  if (input.plate !== undefined) row.plate = input.plate || null
  if (input.odometer !== undefined) row.odometer = Math.round(input.odometer)
  if (input.fuelCapacity !== undefined) row.fuel_capacity = input.fuelCapacity ?? null
  return row
}

export function fromAccount(input: Partial<Omit<Account, "id">>): Updates<"accounts"> {
  const row: Row = {}
  if (input.name !== undefined) row.name = input.name
  if (input.currency !== undefined) row.currency = input.currency
  if (input.kind !== undefined) row.kind = input.kind
  // `balance` es derivado: lo que se puede fijar es el saldo de arranque
  if (input.balance !== undefined) row.initial_balance = input.balance
  return row
}
