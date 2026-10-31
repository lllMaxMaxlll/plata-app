/** Adapted from trader-analyst/facts.py, Jake Schincariol, MIT.
 * Quarterly filed facts only. We deliberately do not derive Q4 EPS or combine
 * concepts across accounting definitions. Missing comparisons stay null. */
export interface FiledFact {
  start?: string; end: string; val: number; filed: string; form: string; accn?: string
}
export interface FundamentalMetric {
  concept: string
  end: string
  value: number
  filed: string
  yoy: number | null
}
export interface MarketFundamentals {
  revenue: FundamentalMetric | null
  eps: FundamentalMetric | null
  source: string
  filings: string
  latestFiling: string | null
  warning: string | null
}
export function quarterlyMetric(concept: string, facts: FiledFact[]): FundamentalMetric | null {
  const periods = new Map<string, FiledFact>()
  for (const fact of facts) {
    if (!fact.start || !['10-Q', '10-K', '10-Q/A', '10-K/A'].includes(fact.form) || !Number.isFinite(fact.val)) continue
    const days = (Date.parse(fact.end) - Date.parse(fact.start)) / 86400000
    if (days < 80 || days > 100 || !Number.isFinite(days)) continue
    const key = `${fact.start}:${fact.end}`
    const previous = periods.get(key)
    if (!previous || fact.filed > previous.filed) periods.set(key, fact)
  }
  const sorted = [...periods.values()].sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))
  const current = sorted[0]
  if (!current) return null
  // Same seasonal quarter, including 52/53-week fiscal years, with comparable
  // duration. Do not compare EPS percentages against a loss or a zero base.
  const prior = sorted.find(f => {
    const gap = (Date.parse(current.end) - Date.parse(f.end)) / 86400000
    const durationsDiffer = Math.abs((Date.parse(current.end) - Date.parse(current.start!)) - (Date.parse(f.end) - Date.parse(f.start!))) / 86400000
    return gap >= 350 && gap <= 380 && durationsDiffer <= 10
  })
  return { concept, end: current.end, value: current.val, filed: current.filed,
    yoy: prior && prior.val > 0 ? (current.val / prior.val - 1) * 100 : null }
}

export function readFundamentals(data: unknown, cik: string, latestFiling: string | null): MarketFundamentals {
  const gaap = (data as { facts?: { 'us-gaap'?: Record<string, { units?: Record<string, FiledFact[]> }> } })?.facts?.['us-gaap'] ?? {}
  const metric = (concepts: string[], unit: string) => {
    const candidates = concepts.map(c => quarterlyMetric(c, gaap[c]?.units?.[unit] ?? [])).filter((m): m is FundamentalMetric => m !== null)
    // Pick the most recent definition; preference order resolves ties.
    return candidates.sort((a, b) => b.end.localeCompare(a.end))[0] ?? null
  }
  const revenue = metric(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'RevenuesNetOfInterestExpense', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet'], 'USD')
  const eps = metric(['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], 'USD/shares')
  const newestFactFiled = [revenue?.filed, eps?.filed].filter((v): v is string => Boolean(v)).sort().at(-1)
  return { revenue, eps, source: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    filings: `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}&owner=exclude`, latestFiling,
    warning: !revenue && !eps ? 'Sin datos trimestrales comparables en XBRL. Consultá el último informe original.'
      : latestFiling && newestFactFiled && latestFiling > newestFactFiled ? 'Hay una presentación más reciente que los datos XBRL disponibles. Leé el informe original antes de decidir.'
      : 'Se muestran trimestres publicados de 80–100 días; no se deriva Q4. Los datos pueden ir detrás del último comunicado.',
  }
}
