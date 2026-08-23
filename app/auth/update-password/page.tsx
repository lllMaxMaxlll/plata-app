"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppIcon } from "@/components/finance/app-icon"
import { getSupabase } from "@/lib/supabase/client"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

/**
 * Pantalla de contraseña nueva, a donde llega el enlace de recuperación.
 *
 * El enlace del mail pasa por /auth/v1/verify de Supabase, que redirige acá con
 * un `code`. El cliente del browser lo canjea solo por una sesión —por eso uno
 * queda logueado apenas entra—, pero esa sesión existe justamente para poder
 * cambiar la contraseña: sin esta pantalla, el usuario entra y nunca llega a
 * definirla.
 */

const MIN_LENGTH = 8

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = getSupabase()

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Si el enlace venció o ya se usó, Supabase redirige con el error en la URL
    const params = new URLSearchParams(window.location.hash.replace("#", "?") || window.location.search)
    const urlError = params.get("error_description") || params.get("error")

    let alive = true
    // getUser() valida contra el servidor; getSession() confía en lo que haya
    // guardado el navegador, que puede ser una sesión ya revocada.
    supabase.auth.getUser().then(({ data, error: sessionError }) => {
      if (!alive) return
      const valid = Boolean(data.user) && !sessionError
      setHasSession(valid)
      if (!valid && urlError) setError(decodeURIComponent(urlError.replace(/\+/g, " ")))
      setChecking(false)
    })

    // El canje del código puede terminar después del primer render
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      if (session) {
        setHasSession(true)
        setError(null)
        setChecking(false)
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)
      toast.success("Contraseña actualizada. Ya podés usarla para entrar.")
      router.replace("/")
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la contraseña.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 md:max-w-lg md:px-0">
      <Card className="p-8 md:p-10 shadow-2xl rounded-[32px]">
        <div className="flex flex-col items-center gap-3 pb-6 text-center">
          <AppIcon className="size-14 border border-primary/20 shadow-sm" priority />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Elegí tu contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground text-balance">
              Es la que vas a usar de ahora en más para entrar a PLATA.
            </p>
          </div>
        </div>

        {checking ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Validando el enlace...
          </div>
        ) : !hasSession ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
              {error || "El enlace no es válido o ya fue usado."}
            </p>
            <p className="text-sm text-muted-foreground">
              Los enlaces de recuperación sirven una sola vez y por tiempo limitado. Pedí uno nuevo desde
              &ldquo;¿Olvidaste tu contraseña?&rdquo;.
            </p>
            <Button onClick={() => router.replace("/")} size="lg" className="h-11 w-full rounded-xl text-sm">
              Volver al inicio
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">
                Contraseña nueva
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Al menos 8 caracteres"
                  autoComplete="new-password"
                  autoFocus
                  className="h-11 rounded-xl pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmation" className="text-xs font-semibold text-muted-foreground">
                Repetila
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmation"
                  type={visible ? "text" : "password"}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="La misma de arriba"
                  autoComplete="new-password"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="mt-1 h-11 w-full rounded-xl text-sm">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar contraseña"
              )}
            </Button>
          </form>
        )}
      </Card>
    </main>
  )
}
