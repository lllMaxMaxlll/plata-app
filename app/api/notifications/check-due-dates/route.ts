import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/server-api"

export async function GET(request: Request) {
  const authResult = await authorizeApiRequest(request, "due-date-check", 10)
  if (authResult.error) return authResult.error
  return NextResponse.json(
    { error: "La ejecución programada requiere Firebase Admin/FCM y todavía no está configurada." },
    { status: 501 }
  )
}

export async function POST(request: Request) {
  try {
    const authResult = await authorizeApiRequest(request, "due-date-preview", 20)
    if (authResult.error) return authResult.error
    const body = await request.json().catch(() => ({}))
    const { dueItems } = body

    if (!Array.isArray(dueItems)) {
      return NextResponse.json({ error: "se requiere array 'dueItems'" }, { status: 400 })
    }
    if (dueItems.length > 500) {
      return NextResponse.json({ error: "demasiados vencimientos" }, { status: 413 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const alerts: Array<{
      dueItemId: string
      title: string
      amount: number
      currency: string
      dueDate: string
      daysUntilDue: number
      message: string
    }> = []

    for (const item of dueItems) {
      if (item.status === "paid") continue

      const parts = (item.dueDate || "").split("-").map(Number)
      if (parts.length !== 3 || parts.some(isNaN)) continue

      const targetDate = new Date(parts[0], parts[1] - 1, parts[2])
      targetDate.setHours(0, 0, 0, 0)

      const diffTime = targetDate.getTime() - today.getTime()
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      const reminderDays = Number.isFinite(item.reminderDaysBefore) ? item.reminderDaysBefore : 3

      // Trigger if overdue or due within reminderDays
      if (daysUntilDue <= reminderDays) {
        let msg = ""
        if (daysUntilDue < 0) {
          msg = `Tu factura de ${item.title} por ${item.currency} $${item.amount} venció hace ${Math.abs(daysUntilDue)} días.`
        } else if (daysUntilDue === 0) {
          msg = `Tu factura de ${item.title} por ${item.currency} $${item.amount} vence HOY.`
        } else {
          msg = `Tu factura de ${item.title} por ${item.currency} $${item.amount} vence en ${daysUntilDue} días.`
        }

        alerts.push({
          dueItemId: item.id,
          title: item.title,
          amount: item.amount,
          currency: item.currency,
          dueDate: item.dueDate,
          daysUntilDue,
          message: msg,
        })
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      userId: authResult.userId,
      count: alerts.length,
      alerts,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error procesando vencimientos." }, { status: 500 })
  }
}
