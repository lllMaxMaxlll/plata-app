"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Send, Trash2, Bot, User as UserIcon, RefreshCw, ChevronRight, Settings, Key, Eye, EyeOff, Copy, Check, Scale, PiggyBank, Coins, BookOpen } from "lucide-react"
import { useFinance } from "./finance-provider"
import { type Account, type StockHolding, type WatchlistStock, type Transaction, type Vehicle, type VehicleLog } from "@/lib/finance-data"

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
  watchlist: WatchlistStock[],
  vehicles: Vehicle[],
  vehicleLogs: VehicleLog[]
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

  // 4. Vehicles Section
  context += "\nVEHÍCULOS Y GASTOS DE VEHÍCULOS:\n"
  if (vehicles.length === 0) {
    context += "- El usuario no tiene vehículos registrados.\n"
  } else {
    vehicles.forEach((v) => {
      context += `- Vehículo "${v.name}" [Tipo: ${v.type}]: Odómetro actual ${v.odometer} Km | Marca: ${v.brand || "—"} | Modelo: ${v.model || "—"} | Patente: ${v.plate || "—"}\n`
      const vLogs = vehicleLogs.filter((l) => l.vehicleId === v.id)
      if (vLogs.length === 0) {
        context += "  - No hay registros de gastos/bitácora para este vehículo.\n"
      } else {
        context += "  - Historial de bitácora/gastos (últimos 15 registros):\n"
        vLogs.slice(0, 15).forEach((l) => {
          const typeLabel =
            l.type === "fuel" ? "Combustible" : l.type === "service" ? "Service" : l.type === "part" ? "Repuesto" : l.type === "gear" ? "Indumentaria" : l.type === "insurance" ? "Seguro/Patente" : "Otro"
          let details = ""
          if (l.type === "fuel") {
            details = ` (${l.liters || 0} L, ${l.gasStation || ""}, ${l.isFullTank ? "Tanque lleno" : "Carga parcial"})`
          } else if (l.type === "service") {
            details = ` (${l.serviceType || ""}, taller: ${l.provider || ""}, próximo service en ${l.nextServiceOdometer || "—"} Km)`
          } else if (l.type === "part" || l.type === "gear") {
            details = ` (${l.itemName || ""})`
          }
          context += `    * ${l.date.split("T")[0]} - [${typeLabel}] Gasto: $${l.amount} a los ${l.odometer} Km${details}${l.note ? ` Nota: "${l.note}"` : ""}\n`
        })
      }
    })
  }

  // 5. Transactions Section
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

const DEFAULT_MODELS = [
  { id: "openrouter/free", name: "Free Models Router (Auto)", contextLength: 200000 },
  { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B", contextLength: 262144 },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Meta: Llama 3.3 70B Instruct", contextLength: 131072 },
  { id: "qwen/qwen3-coder:free", name: "Qwen: Qwen3 Coder 480B A35B", contextLength: 1048576 },
  { id: "nousresearch/hermes-3-llama-3.1-405b:free", name: "Nous: Hermes 3 405B Instruct", contextLength: 131072 },
  { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Meta: Llama 3.2 3B Instruct", contextLength: 131072 },
]

export function AdvisorView({ isDesktop = false }: { isDesktop?: boolean }) {
  const { accounts, transactions, holdings, watchlist, vehicles, vehicleLogs } = useFinance()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [selectedModel, setSelectedModel] = useState("openrouter/free")
  const [models, setModels] = useState(DEFAULT_MODELS)
  const [personality, setPersonality] = useState("balanced")
  const [customApiKey, setCustomApiKey] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Load chat history and configurations from localStorage on mount
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

    const savedModel = localStorage.getItem("plata_ai_selected_model")
    if (savedModel) {
      setSelectedModel(savedModel)
    }

    const savedPersonality = localStorage.getItem("plata_ai_selected_personality")
    if (savedPersonality) {
      setPersonality(savedPersonality)
    }

    const savedKey = localStorage.getItem("plata_openrouter_api_key")
    if (savedKey) {
      setCustomApiKey(savedKey)
    }
  }, [])

  // Fetch all free models dynamically from OpenRouter API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models")
        if (res.ok) {
          const data = await res.json()
          
          // Filter out models that are free
          const freeModels = data.data.filter((m: any) =>
            m.id.endsWith(":free") ||
            (m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0)
          )

          const mapped = freeModels.map((m: any) => ({
            id: m.id,
            name: m.name.replace(" (free)", ""),
            contextLength: m.context_length,
          }))

          // Make sure 'openrouter/free' is at the top
          const filtered = mapped.filter((m: any) => m.id !== "openrouter/free")
          const finalList = [
            { id: "openrouter/free", name: "Free Models Router (Auto)", contextLength: 200000 },
            ...filtered,
          ]

          // Remove duplicates by ID
          const seen = new Set()
          const uniqueList = finalList.filter((item) => {
            if (seen.has(item.id)) return false
            seen.add(item.id)
            return true
          })

          setModels(uniqueList)
        }
      } catch (e) {
        console.error("Failed to fetch OpenRouter models dynamically:", e)
      }
    }
    fetchModels()
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

  // Save configurations when they change
  useEffect(() => {
    localStorage.setItem("plata_ai_selected_model", selectedModel)
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem("plata_ai_selected_personality", personality)
  }, [personality])

  useEffect(() => {
    if (customApiKey.trim()) {
      localStorage.setItem("plata_openrouter_api_key", customApiKey.trim())
    } else {
      localStorage.removeItem("plata_openrouter_api_key")
    }
  }, [customApiKey])

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

    // Save previous state for appending stream
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput("")
    setIsSending(true)

    // Add empty assistant message that we will stream text into
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])

    try {
      // Build user financial profile context
      const financialContext = buildFinanceContext(accounts, transactions, holdings, watchlist, vehicles, vehicleLogs)

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (customApiKey && customApiKey.trim()) {
        headers["x-user-api-key"] = customApiKey.trim()
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: financialContext,
          model: selectedModel,
          personality: personality,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        let errMessage = "Error en la llamada al servidor de chat."
        try {
          const parsed = JSON.parse(errText)
          errMessage = parsed.error || errMessage
        } catch (_) {}
        throw new Error(errMessage)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No se pudo establecer la conexión de streaming del servidor.")
      }

      const decoder = new TextDecoder()
      let assistantText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantText += chunk

        setMessages((prev) => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: assistantText,
            }
          }
          return updated
        })
      }
    } catch (error: any) {
      console.error("Chat error:", error)
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: `⚠️ **Hubo un problema al conectarme con PLATA AI.**\n\n*Detalle del error:* ${error.message || "Error de red/servidor"}\n\nPor favor, verificá tu conexión a internet o intentá de nuevo.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        }
        return updated
      })
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

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all active:scale-95 ${
              showSettings ? "bg-muted text-foreground" : ""
            }`}
            title="Configuración de API Key"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={handleClearChat}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-destructive transition-all active:scale-95"
            title="Borrar chat"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="shrink-0 border-b border-border/60 bg-card/15 p-4.5 animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/55 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Key className="size-3.5 text-primary" />
              <span>Configuración de OpenRouter</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Opcional: Si querés usar tus propios créditos o modelos pagos de OpenRouter, ingresá tu API Key acá. Si la dejás vacía, se usará la key gratuita del servidor.
            </p>
            <div className="relative flex items-center mt-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl border border-border bg-card/50 px-3.5 py-2.5 pr-10 text-xs font-medium placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:bg-card transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer"
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Bar: Model & Personality Selector */}
      <div className="shrink-0 border-b border-border/40 bg-card/5 px-5 py-3.5 flex flex-col sm:flex-row gap-3.5 sm:items-center sm:justify-between">
        {/* Model Select */}
        <div className="flex flex-col gap-1 sm:w-1/2">
          <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
            Modelo de Inteligencia Artificial
          </label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-xl border border-border bg-card/45 px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:bg-card focus:outline-none transition-all appearance-none cursor-pointer pr-8"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-card">
                  {m.name} ({m.contextLength ? `${Math.round(m.contextLength / 1024)}k` : "—"} ctx)
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <ChevronRight className="size-3.5 rotate-90" />
            </div>
          </div>
        </div>

        {/* Personality Tabs */}
        <div className="flex flex-col gap-1 sm:w-1/2">
          <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
            Perfil del Asesor
          </label>
          <div className="flex gap-1 bg-muted/40 p-0.5 rounded-xl border border-border/40 overflow-x-auto no-scrollbar">
            {[
              { id: "balanced", name: "Equilibrado", icon: Scale },
              { id: "frugal", name: "Ahorrador", icon: PiggyBank },
              { id: "investor", name: "Inversor", icon: Coins },
              { id: "academic", name: "Académico", icon: BookOpen },
            ].map((p) => {
              const Icon = p.icon
              const active = personality === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{p.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

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
              <div className="flex flex-col gap-1 group/msg relative">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm transition-all border ${
                    isAI
                      ? "bg-card/75 border-border/80 text-foreground rounded-tl-sm leading-relaxed"
                      : "bg-primary text-primary-foreground border-primary/10 rounded-tr-sm font-medium leading-relaxed"
                  }`}
                >
                  {isAI ? (
                    <>
                      <div
                        className="prose prose-sm prose-invert break-words flex flex-col gap-2 max-w-none text-foreground/95"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                      />
                      {msg.content && (
                        <div className="flex justify-end mt-2 pt-1 border-t border-border/30 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyMessage(msg.content, index)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors py-0.5 px-1.5 rounded bg-muted/40 hover:bg-muted/80 cursor-pointer"
                            title="Copiar respuesta"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="size-3 text-green-500" />
                                <span className="text-green-500 font-semibold">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
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
        {isSending && messages.length > 0 && messages[messages.length - 1].content === "" && (
          <div className="flex gap-3 max-w-[85%] self-start animate-pulse">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary">
              <Bot className="size-4 animate-spin" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="rounded-2xl rounded-tl-sm border border-border/80 bg-card/75 px-4.5 py-3 shadow-sm text-sm">
                <div className="flex items-center gap-1.5 py-1">
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
