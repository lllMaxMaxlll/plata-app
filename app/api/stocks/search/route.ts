import { NextResponse } from "next/server"

const popularStocks = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOG", name: "Alphabet Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "META", name: "Meta Platforms, Inc." },
  { symbol: "NFLX", name: "Netflix, Inc." },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  if (!query) {
    return NextResponse.json([])
  }

  const cleanQuery = query.trim().toUpperCase()
  if (!cleanQuery) {
    return NextResponse.json([])
  }

  const token = process.env.FINNHUB_API_KEY

  if (token) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${token}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
        }
      )
      if (res.ok) {
        const data = await res.json()
        const list = data?.result || []
        // Format to array of { symbol, name }
        const formatted = list
          .filter((item: any) => item.symbol && !item.symbol.includes(".")) // Filter out complex listings
          .map((item: any) => ({
            symbol: item.symbol,
            name: item.description || item.symbol,
          }))
          .slice(0, 7) // Return top 7 recommendations

        if (formatted.length > 0) {
          return NextResponse.json(formatted)
        }
      }
    } catch (err) {
      console.error("Finnhub search error:", err)
    }
  }

  // Fallback: search in popular stocks list
  const filtered = popularStocks
    .filter(
      (s) =>
        s.symbol.includes(cleanQuery) ||
        s.name.toUpperCase().includes(cleanQuery)
    )
    .slice(0, 5)

  return NextResponse.json(filtered)
}
