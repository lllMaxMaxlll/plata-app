import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { messages, context } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing or invalid messages parameter" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in the environment variables.")
      return NextResponse.json({ error: "API key configuration error" }, { status: 500 })
    }

    // Map chat history to Gemini structure
    // Client role 'assistant' maps to Gemini 'model'
    const contents = messages.map((msg: any) => {
      const role = msg.role === "assistant" ? "model" : "user"
      return {
        role,
        parts: [{ text: msg.content || "" }],
      }
    })

    // Construct the system instruction containing identity and financial context
    const systemInstructionText = `Eres "Plata AI", un asistente de inteligencia artificial experto en finanzas personales y asesoramiento financiero.
Tu objetivo es dar consejos financieros prácticos, responder preguntas y ayudar al usuario de forma conversacional.

Normas de comportamiento:
1. Sé empático, profesional, directo y conciso. Evita respuestas largas y repetitivas.
2. Utiliza siempre el idioma español para tus respuestas.
3. NO repitas listas completas de cuentas, saldos individuales o transacciones que ya están visibles en la app, a menos que el usuario lo pida explícitamente. El usuario ya ve estos datos en la pantalla.
4. Concéntrate en dar perspectivas de alto nivel: balances netos, porcentajes de ahorro, alertas sobre categorías con mucho gasto y consejos prácticos de optimización.
5. Háblale directamente al usuario en segunda persona ("tenés", "gastaste", "tu portafolio").
6. Presenta cifras monetarias redondeadas y formateadas claramente (ej: ARS $10.000 o USD $150).
7. Usa formato Markdown (negrita para énfasis y listas cortas con viñetas) para facilitar la lectura rápida en dispositivos móviles y de escritorio.
8. Mantén tus respuestas en un rango de 2 a 4 párrafos cortos o una combinación breve de texto y 3-4 viñetas.

CONTEXTO FINANCIERO EN TIEMPO REAL DEL USUARIO:
${context || "No hay datos financieros disponibles actualmente."}`

    // MODEL CONFIGURATION: To change the AI model, replace the model name segment 
    // ("gemma-4-31b-it") in the URL below with another valid model ID (e.g. "gemini-2.5-flash").
    const modelName = "gemma-4-31b-it"
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API Error Response:", errorText)
      return NextResponse.json({ error: `Gemini API error: ${response.statusText}` }, { status: response.status })
    }

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      console.error("Unexpected Gemini API response structure:", JSON.stringify(data))
      return NextResponse.json({ error: "Failed to generate response text from AI" }, { status: 500 })
    }

    return NextResponse.json({ text: responseText })
  } catch (error: any) {
    console.error("Error in AI Chat API route:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
