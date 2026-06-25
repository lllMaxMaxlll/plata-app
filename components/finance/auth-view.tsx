"use client"

import { useState } from "react"
import { Wallet, Mail, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "./finance-provider"

export function AuthView() {
  const { login, loginWithGoogle, sendPasswordResetLink } = useFinance()
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === "forgot") {
      if (!email) {
        setError("Por favor, ingresa tu dirección de email.")
        return
      }
      setSubmitting(true)
      try {
        await sendPasswordResetLink(email)
        setSuccess("Hemos enviado un correo para restablecer tu contraseña. Por favor, revisá tu bandeja de entrada.")
      } catch (err: any) {
        console.error(err)
        let message = "Ocurrió un error al enviar el correo."
        if (err.code === "auth/invalid-email") {
          message = "El formato del email no es válido."
        } else if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          // Firebase might return invalid-credential in new versions for security when email is not found
          message = "No existe una cuenta registrada con este email."
        }
        setError(message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email || !password) {
      setError("Por favor, ingresa tu email y contraseña.")
      return
    }
    setSubmitting(true)
    try {
      await login(email, password, mode === "signup")
    } catch (err: any) {
      console.error(err)
      // Map common Firebase auth errors to friendly user messages
      let message = "Ocurrió un error al autenticar."
      if (err.code === "auth/invalid-credential") {
        message = "Email o contraseña incorrectos."
      } else if (err.code === "auth/email-already-in-use") {
        message = "El email ya está registrado."
      } else if (err.code === "auth/weak-password") {
        message = "La contraseña debe tener al menos 6 caracteres."
      } else if (err.code === "auth/invalid-email") {
        message = "El formato del email no es válido."
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (err: any) {
      console.error(err)
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Error al iniciar sesión con Google.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 md:max-w-lg md:px-0">
      <div className="md:border md:border-border/40 md:bg-card/45 md:backdrop-blur-xl md:p-10 md:rounded-[32px] md:shadow-2xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">PLATA</h1>
          <p className="mt-1 text-sm text-muted-foreground text-balance">
            Tus finanzas en pesos y dólares, en un solo lugar.
          </p>
        </div>

        {mode !== "forgot" && (
          <div className="mb-6 flex rounded-full bg-muted p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                disabled={submitting}
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setSuccess(null)
                }}
                className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                } disabled:opacity-50`}
              >
                {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "forgot" && (
            <p className="text-xs text-muted-foreground mb-2 text-balance text-center">
              Ingresá tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 focus-within:border-ring">
            <Mail className="size-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              disabled={submitting}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          {mode !== "forgot" && (
            <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 focus-within:border-ring">
              <Lock className="size-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                disabled={submitting}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}

          {mode === "login" && (
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot")
                  setError(null)
                  setSuccess(null)
                }}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-green-500/10 p-3 text-center text-xs font-medium text-green-500 border border-green-500/20">
              {success}
            </div>
          )}

          <Button type="submit" size="lg" disabled={submitting || (mode === "forgot" && !!success)} className="mt-1 h-11 w-full rounded-xl text-sm">
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                {mode === "login" && "Entrar"}
                {mode === "signup" && "Crear cuenta"}
                {mode === "forgot" && "Enviar enlace"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>

          {mode === "forgot" && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={submitting}
              onClick={() => {
                setMode("login")
                setError(null)
                setSuccess(null)
              }}
              className="h-11 w-full rounded-xl text-sm"
            >
              Volver al inicio de sesión
            </Button>
          )}
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              o continuar con
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="h-11 w-full rounded-xl text-sm"
            >
              <GoogleIcon />
              Continuar con Google
            </Button>

            <p className="mt-8 text-center text-xs text-muted-foreground text-balance">
              Conectado a Firebase de forma segura.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.9 1.5l2.6-2.5C17.1 3.2 14.8 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.3 0 8.8-3.7 8.8-9 0-.6-.06-1-.15-1.5H12z"
      />
    </svg>
  )
}
