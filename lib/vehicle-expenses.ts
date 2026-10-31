import type { Account, Currency, Transaction, VehicleLog, VehicleLogType } from './finance-data.ts'

export function vehicleLogCurrency(log: VehicleLog, accounts: Account[], transactions: Transaction[]): Currency {
  const tx = log.transactionId ? transactions.find(t => t.id === log.transactionId) : undefined
  return tx?.currency ?? accounts.find(a => a.id === log.accountId)?.currency ?? 'ARS'
}

/** Keep original currencies and only consolidate with an explicit FX rate. */
export function vehicleExpenses(logs: VehicleLog[], accounts: Account[], transactions: Transaction[], fxRate?: number) {
  const original = { ARS: 0, USD: 0 }
  const byType = { fuel: 0, service: 0, part: 0, gear: 0, insurance: 0, other: 0 } satisfies Record<VehicleLogType, number>
  let missingExchangeRate = false
  for (const log of logs) {
    const currency = vehicleLogCurrency(log, accounts, transactions)
    original[currency] += log.amount
    if (currency === 'USD' && log.amount > 0 && !(fxRate && Number.isFinite(fxRate) && fxRate > 0)) {
      missingExchangeRate = true
      continue
    }
    byType[log.type] += log.amount * (currency === 'USD' ? (fxRate ?? 0) : 1)
  }
  return { original, byType, missingExchangeRate, totalARS: missingExchangeRate ? null : Object.values(byType).reduce((a, b) => a + b, 0) }
}
