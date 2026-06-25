"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Send, Trash2, Bot, User as UserIcon, RefreshCw, ChevronRight } from "lucide-react"
import { useFinance } from "./finance-provider"
import { type Account, type StockHolding, type WatchlistStock, type Transaction } from "@/lib/finance-data"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

// Custom simple & fast markdown-to-HTML parser to display structured AI advice
function parseMarkdown(text: string): string {
  const lines = text.split("\n")
  let inList = false
  let inNumList = false
  let inTable = false
  let tableHeaders: string[] = []

  const resultLines = lines.map((line) => {
    const cleanLine = line.trim()

    // Parse tables
    if (cleanLine.startsWith("|")) {
      const parts = cleanLine
        .split("|")
        .map((p) => p.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)

      // Separator line e.g. |---|---|
      if (cleanLine.includes("---")) {
        return "" // skip separator line
      }

      if (!inTable) {
        inTable = true
        tableHeaders = parts
        const headRow = tableHeaders
          .map(
            (h) =>
              `<th class="border border-border/80 px-3 py-1.5 text-left text-[11px] font-semibold bg-muted/60 text-muted-foreground uppercase tracking-wider">${h}</th>`
          )
          .join("")
        return `<div class="overflow-x-auto my-3 rounded-xl border border-border bg-card/20"><table class="w-full border-collapse text-xs text-foreground"><thead><tr class="border-b border-border/80 bg-muted/30">${headRow}</tr></thead><tbody>`
      } else {
        const cells = parts
          .map((c) => `<td class="border-b border-border/40 px-3 py-2 text-left text-xs font-medium">${c}</td>`)
          .join("")
        return `<tr class="hover:bg-muted/10 transition-colors">${cells}</tr>`
      }
    } else if (inTable) {
      inTable = false
      return "</tbody></table></div>" + (cleanLine ? `<p class="my-2.5">${cleanLine}</p>` : "")
    }

    // Process inline formatting (bold, italic, code, links)
    const processInline = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-foreground'>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em class='italic text-muted-foreground'>$1</em>")
        .replace(
          /`(.*?)`/g,
          "<code class='bg-muted/80 px-1.5 py-0.5 rounded text-[11px] font-mono border border-border/40 text-primary'>$1</code>"
        )
    }

    // Headings
    if (cleanLine.startsWith("### ")) {
      return `<h4 class="text-xs font-bold mt-4 mb-1 text-primary uppercase tracking-wide">${processInline(
        cleanLine.substring(4)
      )}</h4>`
    }
    if (cleanLine.startsWith("## ")) {
      return `<h3 class="text-sm font-bold mt-5 mb-1.5 text-primary border-b border-border/20 pb-1">${processInline(
        cleanLine.substring(3)
      )}</h3>`
    }
    if (cleanLine.startsWith("# ")) {
      return `<h2 class="text-base font-extrabold mt-6 mb-2 text-primary flex items-center gap-1.5">${processInline(
        cleanLine.substring(2)
      )}</h2>`
    }

    // Bullet Lists
    if (cleanLine.startsWith("- ") || cleanLine.startsWith("* ")) {
      const content = processInline(cleanLine.substring(2))
      let prefix = ""
      if (!inList) {
        inList = true
        prefix = "<ul class='list-disc pl-5 my-2 flex flex-col gap-1.5'>"
      }
      return `${prefix}<li class="text-sm text-foreground/90 leading-relaxed">${content}</li>`
    } else if (inList) {
      inList = false
      return "</ul>" + (cleanLine ? `<p class="my-2.5 text-sm leading-relaxed text-foreground/90">${processInline(line)}</p>` : "")
    }

    // Numbered Lists
    const numListMatch = cleanLine.match(/^(\d+)\.\s+(.*)$/)
    if (numListMatch) {
      const content = processInline(numListMatch[2])
      let prefix = ""
      if (!inNumList) {
        inNumList = true
        prefix = "<ol class='list-decimal pl-5 my-2 flex flex-col gap-1.5'>"
      }
      return `${prefix}<li class="text-sm text-foreground/90 leading-relaxed" value="${numListMatch[1]}">${content}</li>`
    } else if (inNumList) {
      inNumList = false
      return "</ol>" + (cleanLine ? `<p class="my-2.5 text-sm leading-relaxed text-foreground/90">${processInline(line)}</p>` : "")
    }

    // Empty lines
    if (!cleanLine) {
      return "<div class='h-2'></div>"
    }

    // Regular paragraph
    return `<p class="text-sm leading-relaxed text-foreground/90 my-1">${processInline(line)}</p>`
  })

  let parsedHtml = resultLines.join("")

  // Close any open blocks
  if (inList) parsedHtml += "</ul>"
  if (inNumList) parsedHtml += "</ol>"
  if (inTable) parsedHtml += "</tbody></table></div>"

  return parsedHtml
}

// Function to construct a text summary of the user's finance profile to feed into the prompt context
function buildFinanceContext(
  accounts: Account[],
  transactions: Transaction[],
  holdings: StockHolding[],
  watchlist: WatchlistStock[]
): string {
  let context = ""

  // Map account IDs to names for human-like understanding
  const accountNameMap = new Map(accounts.map((a) => [a.id, a.name]))

  // 1. Accounts Section
  context += "SALDOS Y CUENTAS:\n"
  if (accounts.length === 0) {
    context += "- El usuario no tiene cuentas creadas aún.\n"
  } else {
    accounts.forEach((acc) => {
      context += `- Cuenta "${acc.name}": Saldo ${acc.currency} $${acc.balance} [Tipo: ${acc.kind}]\n`
    })
  }

  // 2. Stock Holdings Section
  context += "\nPORTAFOLIO DE INVERSIONES (ACCIONES Y CRIPTO):\n"
  if (holdings.length === 0) {
    context += "- El usuario no tiene tenencias de acciones en su portafolio en este momento.\n"
  } else {
    holdings.forEach((h) => {
      context += `- Stock ${h.symbol} (${h.name}): ${h.shares} acciones | Precio Promedio Compra: USD $${h.avgBuyPrice} | Precio Actual: USD $${h.currentPrice} | Valor Total: USD $${h.currentValue} | Ganancia/Pérdida: USD $${h.profitLoss} (${h.profitLossPercent >= 0 ? "+" : ""}${h.profitLossPercent.toFixed(2)}%)\n`
    })
  }

  // 3. Watchlist Section
  context += "\nACCIONES EN WATCHLIST (LISTA DE SEGUIMIENTO):\n"
  if (watchlist.length === 0) {
    context += "- La watchlist está vacía.\n"
  } else {
    context += `- Símbolos en seguimiento: ${watchlist.map((w) => w.symbol).join(", ")}\n`
  }

  // 4. Transactions Section
  context += "\nMOVIMIENTOS FINANCIEROS (ÚLTIMOS 50 REGISTROS):\n"
  if (transactions.length === 0) {
    context += "- No hay transacciones o movimientos registrados en el historial.\n"
  } else {
    const recent = transactions.slice(0, 50)
    recent.forEach((tx) => {
      const dateStr = tx.date ? tx.date.split("T")[0] : "Fecha desconocida"
      const typeStr =
        tx.type === "income" ? "INGRESO" : tx.type === "expense" ? "GASTO" : "TRANSFERENCIA"
      const accName = accountNameMap.get(tx.accountId) || `Cuenta ID ${tx.accountId}`
      const noteStr = tx.note ? ` (Nota: "${tx.note}")` : ""

      if (tx.type === "transfer" && tx.toAccountId) {
        const toAccName = accountNameMap.get(tx.toAccountId) || `Cuenta ID ${tx.toAccountId}`
        context += `- ${dateStr}: TRANSFERENCIA de $${tx.amount} desde "${accName}" hacia "${toAccName}"${noteStr}\n`
      } else {
        context += `- ${dateStr}: ${typeStr} de $${tx.amount} en la categoría "${tx.category}" usando la cuenta "${accName}"${noteStr}\n`
      }
    })
  }

  return context
}

export function AdvisorView({ isDesktop = false }: { isDesktop?: boolean }) {
  const { accounts, transactions, holdings, watchlist } = useFinance()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("plata_ai_chat_history")
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse saved chat history", e)
      }
    } else {
      // Default welcome message
      setMessages([
        {
          role: "assistant",
          content:
            "¡Hola! Soy **PLATA AI**, tu asistente financiero personal. Puedo analizar tus cuentas, transacciones y portafolio de inversiones para responder tus preguntas y darte consejos para optimizar tus finanzas.\n\n¿En qué te puedo ayudar hoy? Podés escribirme o elegir una de las sugerencias de abajo.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    }
  }, [])

  // Save chat history when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("plata_ai_chat_history", JSON.stringify(messages))
    } else {
      localStorage.removeItem("plata_ai_chat_history")
    }
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return

    const userMessage: Message = {
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    try {
      // Build the financial context object based on real-time data in client
      const financialContext = buildFinanceContext(accounts, transactions, holdings, watchlist)

      // Send requests to our secure endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: financialContext,
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la llamada al servidor de chat.")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        role: "assistant",
        content: data.text || "Lo siento, no pude procesar la respuesta.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content:
          "⚠️ **Hubo un problema al conectarme con PLATA AI.** Por favor, verificá tu conexión a internet o intentá de nuevo más tarde.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleClearChat = () => {
    if (window.confirm("¿Estás seguro de que querés borrar el historial del chat?")) {
      setMessages([
        {
          role: "assistant",
          content:
            "Historial borrado. ¡Hola de nuevo! Estoy listo para ayudarte con tus dudas financieras y portafolio de inversiones.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    }
  }

  const SUGGESTED_PROMPTS = [
    {
      title: "Estado Financiero",
      text: "¿Cómo están mis finanzas este mes?",
      desc: "Resumen de saldos, ingresos y gastos.",
    },
    {
      title: "Consejos de Ahorro",
      text: "Dame 3 consejos de ahorro basados en mis movimientos.",
      desc: "Tips personalizados para recortar gastos.",
    },
    {
      title: "Portafolio de Acciones",
      text: "¿Qué tal va mi portafolio de inversiones y tenencias?",
      desc: "Análisis del rendimiento de tus acciones.",
    },
    {
      title: "Control de Gastos",
      text: "¿Cuál fue mi mayor categoría de gasto y cómo reducirla?",
      desc: "Identificación de egresos clave.",
    },
  ]

  // Dynamic CSS classes depending on mobile/desktop presentation
  const containerClasses = isDesktop
    ? "h-[calc(100vh-13rem)] w-full max-w-4xl mx-auto flex flex-col bg-card/40 border border-border/80 backdrop-blur-md rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    : "fixed inset-x-0 bottom-0 top-0 max-w-md mx-auto z-30 flex flex-col bg-background pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+4.5rem)]"

  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/60 bg-card/30 px-5 py-4.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
              PLATA AI
              <span className="inline-flex items-center rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary uppercase">
                Beta
              </span>
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">Asistente financiero personal</p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-destructive transition-all active:scale-95"
          title="Borrar chat"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto px-5 py-6 no-scrollbar flex flex-col gap-5">
        {messages.map((msg, index) => {
          const isAI = msg.role === "assistant"
          return (
            <div
              key={index}
              className={`flex gap-3 max-w-[85%] ${isAI ? "self-start" : "self-end flex-row-reverse"}`}
            >
              {/* Avatar */}
              <div
                className={`flex size-8 shrink-0 select-none items-center justify-center rounded-xl border text-[10px] ${
                  isAI
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {isAI ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
              </div>

              {/* Bubble */}
              <div className="flex flex-col gap-1">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm transition-all border ${
                    isAI
                      ? "bg-card/75 border-border/80 text-foreground rounded-tl-sm leading-relaxed"
                      : "bg-primary text-primary-foreground border-primary/10 rounded-tr-sm font-medium leading-relaxed"
                  }`}
                >
                  {isAI ? (
                    <div
                      className="prose prose-sm prose-invert break-words flex flex-col gap-2 max-w-none text-foreground/95"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                </div>
                <span
                  className={`text-[9px] font-semibold tracking-wide text-muted-foreground/60 ${
                    isAI ? "self-start" : "self-end"
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          )
        })}

        {/* Loading state */}
        {isSending && (
          <div className="flex gap-3 max-w-[85%] self-start">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary">
              <Bot className="size-4 animate-spin" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="rounded-2xl rounded-tl-sm border border-border/80 bg-card/75 px-4.5 py-3.5 shadow-sm text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "0ms" }} />
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "150ms" }} />
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Prompts on Emptyish Chat or Welcome */}
        {messages.length <= 2 && !isSending && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2.5 px-1">
              Preguntas sugeridas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt.text)}
                  className="flex flex-col text-left items-start p-3.5 rounded-2xl border border-border/70 bg-card/25 hover:bg-card/85 hover:border-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all group cursor-pointer"
                >
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    {prompt.title}
                    <ChevronRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-normal">
                    {prompt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <footer className="shrink-0 border-t border-border/60 bg-card/20 p-4.5 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage(input)
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder="Preguntame sobre tus gastos, acciones o consejos..."
            className="w-full rounded-2xl border border-border bg-card/65 px-4.5 py-3.5 pr-14 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:bg-card focus:outline-none disabled:opacity-55 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="absolute right-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow shadow-primary/20 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-0 disabled:scale-90 transition-all pointer-events-auto cursor-pointer"
          >
            <Send className="size-4" />
          </button>
        </form>
      </footer>
    </div>
  )
}
