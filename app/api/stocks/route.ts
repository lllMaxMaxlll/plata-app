import { NextResponse } from "next/server"

interface CachedQuote {
  price: number
  change: number
  name: string
  timestamp: number
}

// In-memory caches to prevent rate limiting (60 req/min for Finnhub free tier)
const quoteCache = new Map<string, CachedQuote>()
const nameCache = new Map<string, string>()
const CACHE_TTL_MS = 15000 // Cache quotes for 15 seconds

// Standard popular tickers metadata to fallback or use as base
const popularStocks: Record<string, { price: number; change: number; name: string }> = {
  AAPL: { price: 182.3, change: 0.85, name: "Apple Inc." },
  MSFT: { price: 421.9, change: 1.2, name: "Microsoft Corporation" },
  GOOG: { price: 172.5, change: -0.4, name: "Alphabet Inc." },
  GOOGL: { price: 173.1, change: -0.35, name: "Alphabet Inc." },
  TSLA: { price: 184.8, change: -2.1, name: "Tesla, Inc." },
  AMZN: { price: 185.5, change: 1.1, name: "Amazon.com, Inc." },
  NVDA: { price: 875.1, change: 3.45, name: "NVIDIA Corporation" },
  META: { price: 475.2, change: 0.15, name: "Meta Platforms, Inc." },
  NFLX: { price: 610.5, change: -1.2, name: "Netflix, Inc." },
  BTCUSD: { price: 65200, change: 2.5, name: "Bitcoin USD" },
  ETHUSD: { price: 3500, change: 1.8, name: "Ethereum USD" },
}

async function fetchFinnhubQuote(symbol: string, token: string): Promise<{ price: number; change: number; name: string } | null> {
  const now = Date.now()
  const cached = quoteCache.get(symbol)
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached
  }

  try {
    // 1. Fetch current quote
    const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })

    if (!quoteRes.ok) {
      throw new Error(`Finnhub quote API error: ${quoteRes.status}`)
    }

    const quoteData = await quoteRes.json()
    if (!quoteData || quoteData.c === 0 || quoteData.c === null) {
      return null // symbol not found or rate limited
    }

    // 2. Fetch company name (with caching)
    let companyName = nameCache.get(symbol) || ""
    if (!companyName) {
      try {
        const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${token}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData && profileData.name) {
            companyName = profileData.name
            nameCache.set(symbol, companyName)
          }
        }
      } catch (profileError) {
        console.warn(`Could not fetch company name from Finnhub for ${symbol}:`, profileError)
      }
    }

    if (!companyName) {
      companyName = popularStocks[symbol]?.name || `${symbol} Corp.`
    }

    const result = {
      price: quoteData.c,
      change: quoteData.dp ?? 0,
      name: companyName,
      timestamp: now,
    }

    quoteCache.set(symbol, result)
    return result
  } catch (err) {
    console.error(`Error fetching Finnhub quote for ${symbol}:`, err)
    return null
  }
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number; name: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    })
    if (res.ok) {
      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (meta && meta.regularMarketPrice !== undefined) {
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice
        const price = meta.regularMarketPrice
        const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0
        return {
          price,
          change,
          name: popularStocks[symbol]?.name || `${symbol} Inc.`,
        }
      }
    }
  } catch (err) {
    console.error(`Error fetching Yahoo Quote for ${symbol}:`, err)
  }
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")
  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)

  if (symbols.length === 0) {
    return NextResponse.json({})
  }

  const results: Record<string, { price: number; change: number; name: string }> = {}
  const token = process.env.FINNHUB_API_KEY

  // Query each symbol in parallel
  await Promise.all(
    symbols.map(async (sym) => {
      let quote = null

      // 1. Try Finnhub if token is present
      if (token) {
        quote = await fetchFinnhubQuote(sym, token)
      }

      // 2. Fallback to Yahoo Finance
      if (!quote) {
        quote = await fetchYahooQuote(sym)
      }

      // 3. Fallback to popular list or simulation
      if (!quote) {
        if (popularStocks[sym]) {
          quote = popularStocks[sym]
        } else {
          let hash = 0
          for (let i = 0; i < sym.length; i++) {
            hash = sym.charCodeAt(i) + ((hash << 5) - hash)
          }
          const basePrice = Math.abs(hash % 490) + 10
          const randChange = (hash % 500) / 100
          quote = {
            price: basePrice,
            change: randChange,
            name: `${sym} Corp.`,
          }
        }
      }

      results[sym] = {
        price: quote.price,
        change: quote.change,
        name: quote.name,
      }
    })
  )

  return NextResponse.json(results)
}
