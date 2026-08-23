"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Send, Trash2, Bot, User as UserIcon, RefreshCw, ChevronRight, Settings, Key, Eye, EyeOff, Copy, Check, Scale, PiggyBank, Coins, BookOpen } from "lucide-react"
import { useFinance } from "./finance-provider"
import { type Account, type StockHolding, type WatchlistStock, type Transaction, type Vehicle, type VehicleLog } from "@/lib/finance-data"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getApiAuthHeaders } from "@/lib/supabase/client"
import { readUserScoped, writeUserScoped } from "@/lib/user-storage"

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

  const processInline = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-foreground'>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em class='italic text-muted-foreground'>$1</em>")
      .replace(
        /`(.*?)`/g,
        "<code class='bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border text-primary'>$1</code>"
      )

  const resultLines = lines.map((line) => {
    const cleanLine = line.trim()

    // Parse tables
    if (cleanLine.startsWith("|")) {
      const parts = cleanLine
        .split("|")
        .map((p) => p.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)

      if (cleanLine.includes("---")) {
        return ""
      }

      if (!inTable) {
        inTable = true
        tableHeaders = parts
        const headRow = tableHeaders
          .map(
            (h) =>
              `<th class="border border-border px-3 py-1.5 text-left text-[11px] font-semibold bg-muted text-muted-foreground uppercase tracking-wider">${processInline(h)}</th>`
          )
          .join("")
        return `<div class="overflow-x-auto my-3 rounded-xl border border-border bg-card"><table class="w-full border-collapse text-xs text-foreground"><thead><tr class="border-b border-border bg-muted">${headRow}</tr></thead><tbody>`
      } else {
        const cells = parts
          .map((c) => `<td class="border-b border-border px-3 py-2 text-left text-xs font-medium">${processInline(c)}</td>`)
          .join("")
        return `<tr class="hover:bg-muted/10 transition-colors">${cells}</tr>`
      }
    } else if (inTable) {
      inTable = false
      return "</tbody></table></div>" + (cleanLine ? `<p class="my-2.5">${processInline(cleanLine)}</p>` : "")
    }

    if (cleanLine.startsWith("### ")) {
      return `<h4 class="text-xs font-bold mt-4 mb-1 text-primary uppercase tracking-wide">${processInline(
        cleanLine.substring(4)
      )}</h4>`
    }
    if (cleanLine.startsWith("## ")) {
      return `<h3 class="text-sm font-bold mt-5 mb-1.5 text-primary border-b border-border pb-1">${processInline(
        cleanLine.substring(3)
      )}</h3>`
    }
    if (cleanLine.startsWith("# ")) {
      return `<h2 class="text-base font-extrabold mt-6 mb-2 text-primary flex items-center gap-1.5">${processInline(
        cleanLine.substring(2)
      )}</h2>`
    }

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

    if (!cleanLine) {
      return "<div class='h-2'></div>"
    }

    return `<p class="text-sm leading-relaxed text-foreground/90 my-1">${processInline(line)}</p>`
  })

  let parsedHtml = resultLines.join("")

  if (inList) parsedHtml += "</ul>"
  if (inNumList) parsedHtml += "</ol>"
  if (inTable) parsedHtml += "</tbody></table></div>"

  return parsedHtml
}

function buildFinanceContext(
  accounts: Account[],
  transactions: Transaction[],
  holdings: StockHolding[],
  watchlist: WatchlistStock[],
  vehicles: Vehicle[],
  vehicleLogs: VehicleLog[]
): string {
  let context = ""
  const accountNameMap = new Map(accounts.map((a) => [a.id, a.name]))

  context += "SALDOS Y CUENTAS:\n"
  if (accounts.length === 0) {
    context += "- El usuario no tiene cuentas creadas aún.\n"
  } else {
    accounts.forEach((acc) => {
      context += `- Cuenta "${acc.name}": Saldo ${acc.currency} $${acc.balance} [Tipo: ${acc.kind}]\n`
    })
  }

  context += "\nPORTAFOLIO DE INVERSIONES (ACCIONES Y CRIPTO):\n"
  if (holdings.length === 0) {
    context += "- El usuario no tiene tenencias de acciones en su portafolio en este momento.\n"
  } else {
    holdings.forEach((h) => {
      context += `- Stock ${h.symbol} (${h.name}): ${h.shares} acciones | Precio Promedio Compra: USD $${h.avgBuyPrice} | Precio Actual: USD $${h.currentPrice} | Valor Total: USD $${h.currentValue} | Ganancia/Pérdida: USD $${h.profitLoss} (${h.profitLossPercent >= 0 ? "+" : ""}${h.profitLossPercent.toFixed(2)}%)\n`
    })
  }

  context += "\nACCIONES EN WATCHLIST (LISTA DE SEGUIMIENTO):\n"
  if (watchlist.length === 0) {
    context += "- La watchlist está vacía.\n"
  } else {
    context += `- Símbolos en seguimiento: ${watchlist.map((w) => w.symbol).join(", ")}\n`
  }

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
  { id: "openrouter/free", name: "🎁 Free Models Router (Auto)", contextLength: 200000 },
  { id: "google/gemma-4-31b-it:free", name: "🎁 Google: Gemma 4 31B", contextLength: 262144 },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "🎁 Meta: Llama 3.3 70B Instruct", contextLength: 131072 },
  { id: "qwen/qwen3-coder:free", name: "🎁 Qwen: Qwen3 Coder 480B A35B", contextLength: 1048576 },
  { id: "anthropic/claude-3.5-sonnet", name: "💰 Anthropic: Claude 3.5 Sonnet", contextLength: 200000 },
  { id: "openai/gpt-4o", name: "💰 OpenAI: GPT-4o", contextLength: 128000 },
  { id: "google/gemini-flash-1.5", name: "💰 Google: Gemini 1.5 Flash", contextLength: 1000000 },
]

export function AdvisorView({ isDesktop = false }: { isDesktop?: boolean }) {
  const { user, accounts, transactions, holdings, watchlist, vehicles, vehicleLogs } = useFinance()
  // Everything below is persisted per account: the chat quotes balances and the
  // API key is a credential, so a second user on this device must not see them.
  const uid = user?.uid
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

  useEffect(() => {
    const saved = readUserScoped("ai_chat_history", uid)
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse saved chat history", e)
      }
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "¡Hola! Soy **PLATA AI**, tu asistente financiero personal. Puedo analizar tus cuentas, transacciones y portafolio de inversiones para responder tus preguntas y darte consejos para optimizar tus finanzas.\n\n¿En qué te puedo ayudar hoy? Podés escribirme o elegir una de las sugerencias de abajo.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    }

    const savedModel = readUserScoped("ai_selected_model", uid)
    if (savedModel) {
      setSelectedModel(savedModel)
    }

    const savedPersonality = readUserScoped("ai_selected_personality", uid)
    if (savedPersonality) {
      setPersonality(savedPersonality)
    }

    const savedKey = readUserScoped("openrouter_api_key", uid)
    if (savedKey) {
      setCustomApiKey(savedKey)
    }
  }, [uid])

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models")
        if (res.ok) {
          const data = await res.json()

          const mapped = data.data.map((m: any) => {
            const isFree = m.id.endsWith(":free") ||
              (m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0);
            return {
              id: m.id,
              name: `${isFree ? "🎁" : "💰"} ${m.name.replace(" (free)", "")}`,
              contextLength: m.context_length,
              isFree,
            }
          })

          const sorted = mapped.sort((a: any, b: any) => {
            if (a.id === "openrouter/free") return -1
            if (b.id === "openrouter/free") return 1
            if (a.isFree && !b.isFree) return -1
            if (!a.isFree && b.isFree) return 1
            return a.name.localeCompare(b.name)
          })

          const finalList = sorted.find((m: any) => m.id === "openrouter/free")
            ? sorted
            : [
              { id: "openrouter/free", name: "🎁 Free Models Router (Auto)", contextLength: 200000, isFree: true },
              ...sorted,
            ]

          const seen = new Set()
          const uniqueList = finalList.filter((item: any) => {
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

  useEffect(() => {
    writeUserScoped("ai_chat_history", uid, messages.length > 0 ? JSON.stringify(messages) : null)
    scrollToBottom()
  }, [messages, uid])

  useEffect(() => {
    writeUserScoped("ai_selected_model", uid, selectedModel)
  }, [selectedModel, uid])

  useEffect(() => {
    writeUserScoped("ai_selected_personality", uid, personality)
  }, [personality, uid])

  useEffect(() => {
    writeUserScoped("openrouter_api_key", uid, customApiKey.trim() || null)
  }, [customApiKey, uid])

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

    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput("")
    setIsSending(true)

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])

    try {
      const financialContext = buildFinanceContext(accounts, transactions, holdings, watchlist, vehicles, vehicleLogs)

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(await getApiAuthHeaders()),
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
        } catch (_) { }
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

  const containerClasses = isDesktop
    ? "h-[calc(100vh-10rem)] w-full max-w-7xl mx-auto flex flex-col bg-card border border-border/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-200"
    : "fixed inset-x-0 bottom-0 top-0 max-w-md mx-auto z-30 flex flex-col bg-background pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+4.5rem)]"

  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
              PLATA AI
              <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-semibold uppercase">
                Beta
              </Badge>
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">Asistente financiero personal</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-muted-foreground"
            title="Configuración de API Key"
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClearChat}
            className="text-muted-foreground hover:text-destructive"
            title="Borrar chat"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="shrink-0 border-b border-border bg-card p-4">
          <Card className="flex flex-col gap-3 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Key className="size-3.5 text-primary" />
              <span>Configuración de OpenRouter</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Opcional: Si querés usar tus propios créditos o modelos pagos de OpenRouter, ingresá tu API Key acá. Si la dejás vacía, se usará la key gratuita del servidor.
            </p>
            <div className="relative flex items-center mt-1">
              <Input
                type={showApiKey ? "text" : "password"}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="h-10 text-xs font-medium pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 text-muted-foreground"
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Controls Bar: Model & Personality Selector */}
      <div className="shrink-0 border-b border-border bg-card px-5 py-3.5 flex flex-col sm:flex-row gap-3.5 sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:w-1/2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Modelo de IA
          </label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-9 rounded-xl border border-input bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none cursor-pointer pr-8"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-popover text-popover-foreground">
                  {m.name} ({m.contextLength ? `${Math.round(m.contextLength / 1024)}k` : "—"} ctx)
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <ChevronRight className="size-3.5 rotate-90" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 sm:w-1/2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Perfil del Asesor
          </label>
          <div className="flex gap-1 bg-muted p-0.5 rounded-xl border border-border">
            {[
              { id: "balanced", name: "Equilibrado", icon: Scale },
              { id: "frugal", name: "Ahorrador", icon: PiggyBank },
              { id: "investor", name: "Inversor", icon: Coins },
              { id: "academic", name: "Académico", icon: BookOpen },
            ].map((p) => {
              const Icon = p.icon
              const active = personality === p.id
              return (
                <Button
                  key={p.id}
                  variant={active ? "default" : "ghost"}
                  size="xs"
                  onClick={() => setPersonality(p.id)}
                  className="flex-1 gap-1 text-[11px] h-7 px-2 font-medium"
                >
                  <Icon className="size-3 shrink-0" />
                  <span>{p.name}</span>
                </Button>
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
              <div
                className={`flex size-8 shrink-0 select-none items-center justify-center rounded-xl border text-[10px] ${isAI
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-muted border-border text-muted-foreground"
                  }`}
              >
                {isAI ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
              </div>

              <div className="flex flex-col gap-1 group/msg relative">
                <Card
                  className={`px-4 py-3 text-sm shadow-sm transition-all border ${isAI
                      ? "bg-card border-border text-foreground rounded-tl-sm leading-relaxed"
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
                        <div className="flex justify-end mt-2 pt-1 border-t border-border opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleCopyMessage(msg.content, index)}
                            className="h-6 px-1.5 text-[10px]"
                            title="Copiar respuesta"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="size-3 text-green-500 mr-1" />
                                <span className="text-green-500 font-semibold">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3 mr-1" />
                                <span>Copiar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                </Card>
                <span
                  className={`text-[9px] font-semibold tracking-wide text-muted-foreground ${isAI ? "self-start" : "self-end"
                    }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          )
        })}

        {isSending && messages.length > 0 && messages[messages.length - 1].content === "" && (
          <div className="flex gap-3 max-w-[85%] self-start animate-pulse">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary">
              <Bot className="size-4 animate-spin" />
            </div>
            <div className="flex flex-col gap-1">
              <Card className="rounded-2xl rounded-tl-sm px-4.5 py-3 shadow-sm text-sm">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "0ms" }} />
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "150ms" }} />
                  <span className="size-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: "300ms" }} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {messages.length <= 2 && !isSending && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
              Preguntas sugeridas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt.text)}
                  className="flex flex-col text-left items-start p-3.5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-all group cursor-pointer shadow-sm"
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
      <footer className="shrink-0 border-t border-border bg-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage(input)
          }}
          className="relative flex items-center"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder="Preguntame sobre tus gastos, acciones o consejos..."
            className="h-12 rounded-2xl pr-14 text-sm font-medium"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!input.trim() || isSending}
            className="absolute right-2 size-9 rounded-xl"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </footer>
    </div>
  )
}
