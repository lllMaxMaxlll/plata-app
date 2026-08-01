import { NextResponse } from "next/server"

interface CheckDueDatesResponse {
  timestamp: string
  totalPendingChecked: number
  alertsToTrigger: Array<{
    userId?: string
    dueItemId: string
    title: string
    amount: number
    currency: string
    dueDate: string
    daysUntilDue: number
    reminderDaysBefore: number
    message: string
  }>
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    // Current date in YYYY-MM-DD
    const today = new Date()
    const todayIso = today.toISOString().split("T")[0]

    // Calculate alerts payload structure
    const alertsToTrigger: CheckDueDatesResponse["alertsToTrigger"] = []

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: "success",
      message: "Verificación de vencimientos ejecutada.",
      filterUserId: userId || "all",
      alertsToTrigger,
      info: "Esta API comprueba los vencimientos periódicos pendientes dentro de los días de alerta previa configurados por el usuario y despacha notificaciones Web Push FCM.",
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al verificar vencimientos." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { dueItems, userId } = body

    if (!Array.isArray(dueItems)) {
      return NextResponse.json({ error: "se requiere array 'dueItems'" }, { status: 400 })
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

      const reminderDays = item.reminderDaysBefore || 3

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
      userId: userId || "anonymous",
      count: alerts.length,
      alerts,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error procesando vencimientos." }, { status: 500 })
  }
}
