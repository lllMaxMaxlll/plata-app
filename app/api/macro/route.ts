import { NextResponse } from "next/server"

export interface MacroApiResponse {
  rates: {
    blue: number
    oficial: number
    mep: number
    ccl: number
  }
  recommendedExchangeRate: number
  annualInflation: number
  annualDevaluation: number
  annualReturn: number
  lastUpdated: string
}

export async function GET() {
  try {
    // 1. Fetch Dollar rates from DolarApi.com (Free & Public API for Argentina)
    const res = await fetch("https://dolarapi.com/v1/dolares", {
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    let rates = {
      blue: 1250,
      oficial: 980,
      mep: 1240,
      ccl: 1255,
    }

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        const blueData = data.find((d: any) => d.casa === "blue")
        const oficialData = data.find((d: any) => d.casa === "oficial")
        const mepData = data.find((d: any) => d.casa === "bolsa")
        const cclData = data.find((d: any) => d.casa === "contadoconliqui")

        if (blueData?.venta) rates.blue = Number(blueData.venta)
        if (oficialData?.venta) rates.oficial = Number(oficialData.venta)
        if (mepData?.venta) rates.mep = Number(mepData.venta)
        if (cclData?.venta) rates.ccl = Number(cclData.venta)
      }
    }

    // Recommended exchange rate for personal finance is Dólar Blue / MEP
    const recommendedExchangeRate = rates.blue || rates.mep || 1250

    // Inflation and Devaluation estimates based on consensus REM/BCRA benchmarks
    const annualInflation = 45 // 45% annual expectation
    const annualDevaluation = 40 // 40% annual expectation
    const annualReturn = 12 // 12% annual USD investment return benchmark

    const responseData: MacroApiResponse = {
      rates,
      recommendedExchangeRate,
      annualInflation,
      annualDevaluation,
      annualReturn,
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching macro data:", error)
    return NextResponse.json(
      {
        rates: { blue: 1250, oficial: 980, mep: 1240, ccl: 1255 },
        recommendedExchangeRate: 1250,
        annualInflation: 45,
        annualDevaluation: 40,
        annualReturn: 12,
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
