"use client"

import { useMemo, useState } from "react"
import { buildAgenda } from "@/lib/agenda"
import { transactionCurrency, type Transaction } from "@/lib/finance-data"
import { useFinance } from "./finance-provider"

/**
 * Patrimonio consolidado en las dos monedas. Las acciones cuentan como dólares.
 *
 * Mientras no haya una cotización guardada, el tipo de cambio es un valor por
 * defecto del código: `fxConfigured` avisa para no presentar como real un
 * patrimonio calculado con un dólar inventado.
 */
export function useNetWorth() {
  const { totalsByCurrency, portfolioTotalValue, macroSettings } = useFinance()

  return useMemo(() => {
    const fxRate = macroSettings.exchangeRate || 1250
    const usd = (totalsByCurrency.USD || 0) + (portfolioTotalValue || 0)
    const ars = totalsByCurrency.ARS || 0
    const fxKind = Object.entries(macroSettings.rates ?? {}).find(([, v]) => v === macroSettings.exchangeRate)?.[0]

    return {
      fxRate,
      fxKind,
      fxConfigured: Boolean(macroSettings.lastUpdated),
      lastUpdated: macroSettings.lastUpdated,
      rates: macroSettings.rates,
      ars,
      usd,
      inARS: ars + usd * fxRate,
      inUSD: usd + ars / fxRate,
    }
  }, [totalsByCurrency, portfolioTotalValue, macroSettings])
}

/** Convierte un movimiento a pesos al tipo de cambio actual. */
export function useToARS() {
  const { getAccount } = useFinance()
  const { fxRate } = useNetWorth()
  return useMemo(
    () => (tx: Transaction) =>
      transactionCurrency(tx, getAccount(tx.accountId)) === "USD" ? tx.amount * fxRate : tx.amount,
    [getAccount, fxRate]
  )
}

/** La agenda del día: vencimientos y services, con el mismo "ahora" mientras dure la pantalla. */
export function useAgenda(horizonDays = 30) {
  const { dueItems, vehicles, vehicleLogs } = useFinance()
  const [now] = useState(() => new Date())

  return useMemo(
    () => buildAgenda({ dueItems, vehicles, vehicleLogs, now, horizonDays }),
    [dueItems, vehicles, vehicleLogs, now, horizonDays]
  )
}
