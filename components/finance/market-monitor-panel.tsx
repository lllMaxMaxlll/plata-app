"use client"

import { useEffect, useState } from 'react'
import { getApiAuthHeaders } from '@/lib/supabase/client'
import { marketClock, type MarketReport, type MarketRule, type MarketSettings } from '@/lib/market-monitor'
import type { MarketDelivery } from '@/lib/market-service'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface MonitorState {
  configured: boolean
  storage: boolean
  publicKey: string | null
  telegramAvailable: boolean
  pushDevices: number
  settings: MarketSettings
  report: MarketReport | null
  delivery: MarketDelivery | null
  checkedAt: string | null
}
const newRule = (symbol: string): MarketRule => ({ symbol, stop: null, target: null, dropPercent: 5 })
const dateLabel = (value: string) => new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export function MarketMonitorPanel({ symbols }: { symbols: string[] }) {
  const [state, setState] = useState<MonitorState | null>(null)
  const [draft, setDraft] = useState<MarketSettings | null>(null)
  const [ticker, setTicker] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const response = await fetch('/api/market', { headers: await getApiAuthHeaders() })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar la vigilancia.')
        if (alive) { setState(data); setDraft(data.settings) }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Error de conexión.') }
    }
    void load()
    return () => { alive = false }
  }, [])

  async function api(body: unknown) {
    const response = await fetch('/api/market', { method: 'POST', headers: { ...await getApiAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || data.delivery?.detail || 'No se pudo completar la acción.')
    return data
  }
  async function perform(task: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await task() } catch (e) { setError(e instanceof Error ? e.message : 'Error de conexión.') }
    finally { setBusy(false) }
  }
  function updateRule(index: number, field: 'stop' | 'target' | 'dropPercent', value: string) {
    setDraft(d => d && ({ ...d, rules: d.rules.map((r, i) => i === index ? { ...r, [field]: value === '' ? (field === 'dropPercent' ? 0 : null) : Number(value) } : r) }))
  }
  function addSymbols(list: string[]) {
    setDraft(d => d && ({ ...d, rules: [...d.rules, ...list.map(s => s.trim().toUpperCase()).filter((s, i, all) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(s) && !d.rules.some(r => r.symbol === s) && all.indexOf(s) === i).map(newRule)].slice(0, 10) }))
    setTicker('')
  }
  async function enablePush() {
    if (!state?.publicKey) throw new Error('Falta configurar Web Push en el servidor.')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
      throw new Error('Este navegador no admite push. En iPhone abrí la PWA instalada (iOS 16.4 o posterior), o usá Telegram.')
    // Permission is requested directly from this button's user gesture.
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('No se autorizó el permiso. Podés habilitarlo en Ajustes o usar Telegram.')
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    await navigator.serviceWorker.ready
    const bytes = Uint8Array.from(atob(state.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
    await api({ action: 'subscribe', subscription: subscription.toJSON() })
    setState(s => s && ({ ...s, pushDevices: Math.max(1, s.pushDevices) }))
    setMessage('Este dispositivo quedó suscripto. Guardá la vigilancia y enviá una prueba.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Radar de mercado</CardTitle>
        <CardDescription>Antes de abrir, al cierre y cuando cambia tu riesgo. Acciones de EE. UU.; también podés seguir posiciones reales que tengas fuera de esta app.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {!state || !draft ? (!error && <Skeleton className="h-20 w-full" />) : <>
          <div className="flex flex-wrap gap-2">
            <Badge variant={state.settings.enabled ? 'default' : 'outline'}>{state.settings.enabled ? 'Vigilancia activada' : 'Vigilancia apagada'}</Badge>
            <Badge variant="outline">{state.pushDevices} dispositivos push</Badge>
          </div>
          {!state.configured && <p className="text-sm text-muted-foreground">La vigilancia todavía requiere configurar almacenamiento y Finnhub en Cloudflare. No hay alertas automáticas funcionando hasta completar esa configuración.</p>}
          <p className="text-xs text-muted-foreground">Resumen a las 08:00 de Nueva York y 5 minutos después del cierre (también cierres anticipados). Revisión cada 5 minutos, de 04:00 a 20:00 en días bursátiles. Noticias cada 15 minutos y calendario cada hora. Hasta 10 símbolos. Calendario NYSE 2026–2027.</p>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="market-enabled">Vigilar mis símbolos</FieldLabel>
              <Switch id="market-enabled" checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })} disabled={busy || !state.configured} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="market-telegram">Telegram como respaldo del push</FieldLabel>
              <Switch id="market-telegram" checked={draft.telegram} onCheckedChange={telegram => setDraft({ ...draft, telegram })} disabled={busy || !state.telegramAvailable} />
            </Field>
          </FieldGroup>
          {!state.telegramAvailable && <p className="text-xs text-muted-foreground">Telegram requiere vincular tu usuario al chat en el servidor. No se comparte tu cartera con otros usuarios.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !state.publicKey || !state.storage} onClick={() => void perform(enablePush)}>Activar push en este dispositivo</Button>
            <Button variant="outline" disabled={busy || !state.storage} onClick={() => void perform(async () => {
              const data = await api({ action: 'test' }); setState(s => s && ({ ...s, delivery: data.delivery })); setMessage(data.delivery.detail)
            })}>Enviar prueba</Button>
            <Button variant="ghost" disabled={busy || !state.storage} onClick={() => void perform(async () => {
              const registration = await navigator.serviceWorker?.getRegistration('/')
              const subscription = await registration?.pushManager.getSubscription()
              if (subscription) { await api({ action: 'unsubscribe', endpoint: subscription.endpoint }); await subscription.unsubscribe() }
              setState(s => s && ({ ...s, pushDevices: Math.max(0, s.pushDevices - (subscription ? 1 : 0)) }))
              setMessage('Push desactivado en este dispositivo. Podés apagar toda la vigilancia con el interruptor y Guardar.')
            })}>Desactivar push aquí</Button>
          </div>
          <p className="text-xs text-muted-foreground">En iPhone: instalá la app en la pantalla de inicio, abrila desde su ícono y tocá Activar push. Telegram se usa si no hay un envío push aceptado; un envío aceptado no confirma que hayas leído la alerta.</p>
          <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); addSymbols([ticker]) }}>
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor="market-symbol">Símbolo a vigilar</FieldLabel>
              <Input id="market-symbol" placeholder="INTC" value={ticker} maxLength={15} onChange={e => setTicker(e.target.value)} disabled={busy || draft.rules.length >= 10} />
            </Field>
            <Button type="submit" variant="outline" disabled={busy || !/^[A-Za-z][A-Za-z0-9.-]{0,14}$/.test(ticker.trim()) || draft.rules.length >= 10}>Agregar</Button>
            <Button type="button" variant="ghost" disabled={busy || !symbols.length || draft.rules.length >= 10} onClick={() => addSymbols(symbols)}>Traer cartera y seguimiento</Button>
          </form>
          {draft.rules.map((rule, index) => <fieldset key={rule.symbol} className="flex flex-col gap-3 rounded-lg border p-3" disabled={busy}>
            <legend className="px-1 font-semibold">{rule.symbol}</legend>
            <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([{ key: 'stop', label: 'Stop de referencia · USD' }, { key: 'target', label: 'Objetivo · USD' }, { key: 'dropPercent', label: 'Caída diaria · %' }] as const).map(({ key, label }) => <Field key={key}>
                <FieldLabel htmlFor={`market-${rule.symbol}-${key}`}>{label}</FieldLabel>
                <Input id={`market-${rule.symbol}-${key}`} type="number" inputMode="decimal" min={key === 'dropPercent' ? '0.1' : '0.0001'} max={key === 'dropPercent' ? '100' : '10000000'} step="any" value={rule[key] ?? ''} placeholder="Sin definir" onChange={e => updateRule(index, key, e.target.value)} />
              </Field>)}
            </FieldGroup>
            <FieldDescription>Stop y objetivo son avisos, no órdenes. Se avisa como máximo una vez por nivel y día. Sin stop definido, sólo se controla la caída diaria.</FieldDescription>
            <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}>Quitar {rule.symbol}</Button>
          </fieldset>)}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !state.storage} onClick={() => void perform(async () => {
              const data = await api({ action: 'save', settings: draft }); setDraft(data.settings); setState({ ...state, settings: data.settings, report: null }); setMessage(data.settings.enabled ? 'Configuración guardada. La próxima revisión será en un ciclo de vigilancia.' : 'Configuración guardada. La vigilancia está apagada; podés consultar el análisis manualmente.')
            })}>{busy ? 'Procesando…' : 'Guardar vigilancia'}</Button>
            <Button variant="outline" disabled={busy || !state.configured || !state.settings.rules.length} onClick={() => void perform(async () => {
              const data = await api({ action: 'refresh' }); setState({ ...state, report: data.report }); setMessage('Análisis actualizado para los símbolos guardados.')
            })}>Actualizar análisis</Button>
          </div>
          <p className="text-xs text-muted-foreground">Los cambios se aplican al guardar. Última revisión automática: {state.checkedAt ? dateLabel(state.checkedAt) : 'todavía no registrada'}. {state.delivery && `Último envío: ${dateLabel(state.delivery.at)} · ${state.delivery.detail}`}</p>
          {!marketClock(now).known && <p role="alert" className="text-sm text-destructive">Actualizar calendario NYSE: la vigilancia no funciona para este año.</p>}
          {state.report && <section aria-label="Análisis de mercado" className="flex flex-col gap-4">
            <h3 className="font-semibold">Datos consultados · {dateLabel(state.report.asOf)}</h3>
            {now.getTime() - Date.parse(state.report.asOf) > 1800000 && <p className="text-sm text-destructive">Este análisis tiene más de 30 minutos. Actualizalo antes de decidir.</p>}
            {state.report.stocks.map(stock => <article key={stock.symbol} className="flex flex-col gap-2 rounded-lg border p-3">
              <h4 className="font-semibold">{stock.symbol} · {stock.quote ? `USD ${stock.quote.price.toFixed(2)} (${stock.quote.change.toFixed(2)}%)` : 'Sin cotización verificable'}</h4>
              {stock.quote && <p className="text-xs text-muted-foreground">Cotización indicativa · {dateLabel(new Date(stock.quote.timestamp * 1000).toISOString())}. Puede estar demorada; confirmá en el broker.</p>}
              {stock.warnings.map((warning, i) => <p className="text-sm text-destructive" key={i}>{warning}</p>)}
              <p className="text-sm font-medium">Próximos resultados (7 días)</p>
              {stock.earnings.length ? stock.earnings.map(e => <p className="text-sm" key={`${e.date}-${e.hour}`}>{e.date} · {e.hour === 'amc' ? 'después del cierre' : e.hour === 'bmo' ? 'antes de abrir' : 'horario sin confirmar'}. EPS real: {e.epsActual ?? 'pendiente'}; estimado: {e.epsEstimate ?? 'sin dato'}.</p>) : <p className="text-sm text-muted-foreground">Sin fechas informadas por el proveedor; no confirma que no haya un evento.</p>}
              <p className="text-xs text-muted-foreground">Fuente: calendario Finnhub. La fecha puede cambiar; confirmá en Relaciones con Inversores.</p>
              {stock.fundamentals && <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">Últimos números publicados · SEC EDGAR</p>
                {stock.fundamentals.revenue && <p>Ingresos: USD {stock.fundamentals.revenue.value.toLocaleString('es-AR')} · trimestre al {stock.fundamentals.revenue.end} · {stock.fundamentals.revenue.yoy === null ? 'sin comparación interanual válida' : `${stock.fundamentals.revenue.yoy.toFixed(1)}% interanual`}.</p>}
                {stock.fundamentals.eps && <p>EPS diluido: USD {stock.fundamentals.eps.value} · trimestre al {stock.fundamentals.eps.end} · presentado el {stock.fundamentals.eps.filed}.</p>}
                <p className="text-xs text-muted-foreground">{stock.fundamentals.warning}</p>
                <a className="underline" href={stock.fundamentals.filings} target="_blank" rel="noopener noreferrer">Leer presentaciones y comunicados originales</a>
              </div>}
              <ul className="flex flex-col gap-2">{stock.news.map(news => <li key={news.id} className="text-sm"><a href={news.url} target="_blank" rel="noopener noreferrer" className="underline">{news.headline}</a><p className="text-xs text-muted-foreground">{news.source} · {dateLabel(new Date(news.datetime * 1000).toISOString())}</p></li>)}</ul>
              {!stock.news.length && <p className="text-sm text-muted-foreground">Sin titulares disponibles en los últimos 3 días.</p>}
            </article>)}
          </section>}
          <p className="text-xs text-muted-foreground">Revisá la exposición antes de resultados y cambios de proyecciones. Una caída puede ocurrir fuera de horario o entre revisiones; un stop en el broker tampoco garantiza el precio ante un salto de apertura. Estas alertas no predicen cuándo comprar o vender. El trading registrado en esta app es simulado.</p>
        </>}
      </CardContent>
    </Card>
  )
}
