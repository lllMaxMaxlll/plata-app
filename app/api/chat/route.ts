import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { messages, context, model, personality } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing or invalid messages parameter" }, { status: 400 })
    }

    // Get API Key from custom header or fallback to environment variable
    const userApiKey = request.headers.get("x-user-api-key")
    const apiKey = (userApiKey && userApiKey.trim()) || process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not defined in the environment variables and no user key was provided.")
      return NextResponse.json({ error: "API key configuration error. Please provide an API key." }, { status: 500 })
    }

    // Define personality behavior guidelines
    let personalityPrompt = ""
    switch (personality) {
      case "frugal":
        personalityPrompt = `ENFOQUE PRINCIPAL: Ahorro y Frugalidad Extrema.
- Aconseja recortar gastos no esenciales y evitar compras superfluas de manera firme pero constructiva.
- Recomienda la creación o fortalecimiento de un fondo de emergencia sólido (de 3 a 6 meses de gastos).
- Propón retos de ahorro mensual y optimización de servicios contratados (suscripciones, facturas, etc.).
- Enfatiza el valor de vivir por debajo de las posibilidades actuales.`
        break
      case "investor":
        personalityPrompt = `ENFOQUE PRINCIPAL: Inversión, Crecimiento y Riqueza.
- Enfócate en el crecimiento de capital a largo plazo, el poder del interés compuesto y la diversificación de activos.
- Explica los beneficios de invertir en renta variable (acciones, CEDEARs), renta fija (bonos, cuentas remuneradas, plazos fijos) o criptomonedas según el perfil de riesgo de moderado a alto.
- Propicia el pensamiento inversor (ver el dinero ahorrado como capital de trabajo e inversión en lugar de efectivo estático).
- Explica la diferencia entre activos que generan flujo de caja y pasivos que drenan fondos.`
        break
      case "academic":
        personalityPrompt = `ENFOQUE PRINCIPAL: Educación Financiera y Conceptos Teóricos.
- Define términos técnicos de forma sencilla pero rigurosa cuando los utilices (ej: inflación, rendimiento real, CAGR, liquidez, apalancamiento).
- Basa tus recomendaciones en teorías o metodologías financieras de renombre (ej: regla 50/30/20, presupuestos de base cero, diversificación de Markowitz).
- Actúa como un profesor de economía y finanzas personales paciente, estructurando las explicaciones de forma lógica y educativa.`
        break
      case "balanced":
      default:
        personalityPrompt = `ENFOQUE PRINCIPAL: Equilibrado.
- Busca un equilibrio entre el control de gastos cotidianos, el ahorro constante y la inversión inteligente de excedentes.
- Ofrece asesoramiento general enfocado en la salud financiera integral del usuario sin inclinarte al ahorro extremo ni a inversiones de alto riesgo.`
        break
    }

    // Construct the system instruction containing identity, financial context, and personality focus
    const systemInstructionText = `Eres "PLATA AI", un asistente de inteligencia artificial experto en finanzas personales y asesoramiento financiero.
Tu objetivo es dar consejos financieros prácticos, responder preguntas y ayudar al usuario de forma conversacional.

Normas generales de comportamiento:
1. Sé empático, profesional, directo y conciso. Evita respuestas largas y repetitivas.
2. Utiliza siempre el idioma español para tus respuestas.
3. NO repitas listas completas de cuentas, saldos individuales o transacciones que ya están visibles en la app, a menos que el usuario lo pida explícitamente. El usuario ya ve estos datos en la pantalla.
4. Concéntrate en dar perspectivas de alto nivel: balances netos, porcentajes de ahorro, alertas sobre categorías con mucho gasto y consejos prácticos de optimización.
5. Háblale directamente al usuario en segunda persona ("tenés", "gastaste", "tu portafolio").
6. Presenta cifras monetarias redondeadas y formateadas claramente (ej: ARS $10.000 o USD $150).
7. Usa formato Markdown (negrita para énfasis y listas cortas con viñetas) para facilitar la lectura rápida en dispositivos móviles y de escritorio.
8. Mantén tus respuestas en un rango de 2 a 4 párrafos cortos o una combinación breve de texto y 3-4 viñetas.

${personalityPrompt}

CONTEXTO FINANCIERO EN TIEMPO REAL DEL USUARIO:
${context || "No hay datos financieros disponibles actualmente."}`

    const openRouterModel = model || "openrouter/free"

    // Construct request to OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/lllMaxMaxlll/plata-app",
        "X-Title": "Plata App",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          { role: "system", content: systemInstructionText },
          ...messages.map((msg: any) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content || "",
          })),
        ],
        temperature: 0.4,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("OpenRouter API Error Response:", errorText)
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    // Set up standard ReadableStream to parse the event-stream and output plain text tokens to the client
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.close()
          return
        }

        const reader = response.body.getReader()
        let buffer = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue

              // OpenRouter sends data prefixed with "data: "
              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6)
                if (dataStr === "[DONE]") {
                  continue
                }

                try {
                  const parsed = JSON.parse(dataStr)
                  const text = parsed.choices?.[0]?.delta?.content || ""
                  if (text) {
                    controller.enqueue(encoder.encode(text))
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunk lines
                }
              }
            }
          }
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    })
  } catch (error: any) {
    console.error("Error in AI Chat API route:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
