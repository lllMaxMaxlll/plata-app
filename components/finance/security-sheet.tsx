"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, ShieldAlert, KeyRound, Mail, RefreshCw, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"

export function SecuritySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, changePassword, sendEmailVerificationLink, reloadUser } = useFinance()

  // Form states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Status states
  const [submitting, setSubmitting] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationCooldown, setVerificationCooldown] = useState(0)
  const [reloading, setReloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cooldown countdown timer
  useEffect(() => {
    if (verificationCooldown <= 0) return
    const timer = setInterval(() => {
      setVerificationCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [verificationCooldown])

  if (!user) return null

  const isGoogleUser = user.providerId === "google.com"

  async function handleSendVerification() {
    setSendingVerification(true)
    setError(null)
    try {
      await sendEmailVerificationLink()
      toast.success("Correo de verificación enviado. Revisá tu bandeja de entrada.")
      setVerificationCooldown(60) // 1 minute cooldown
    } catch (err: any) {
      console.error(err)
      let message = "Ocurrió un error al enviar el correo de verificación."
      if (err.code === "auth/too-many-requests") {
        message = "Demasiadas solicitudes. Por favor, intentá de nuevo más tarde."
      }
      setError(message)
      toast.error(message)
    } finally {
      setSendingVerification(false)
    }
  }

  async function handleReloadUser() {
    setReloading(true)
    setError(null)
    try {
      await reloadUser()
      toast.success("Estado de cuenta actualizado.")
    } catch (err: any) {
      console.error(err)
      toast.error("Error al actualizar el estado de la cuenta.")
    } finally {
      setReloading(false)
    }
  }

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Todos los campos de contraseña son requeridos.")
      return
    }

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.")
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success("Contraseña actualizada con éxito.")
      // Clear form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      console.error(err)
      let message = "Ocurrió un error al cambiar la contraseña."
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        message = "La contraseña actual es incorrecta."
      } else if (err.code === "auth/weak-password") {
        message = "La nueva contraseña es demasiado débil."
      } else if (err.code === "auth/requires-recent-login") {
        message = "Por seguridad, debes cerrar sesión y volver a entrar para realizar esta acción."
      }
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Seguridad y Accesos"
      description="Gestioná la seguridad de tu cuenta, tu contraseña y métodos de inicio de sesión."
    >
      <div className="mt-4 flex flex-col gap-6">
        {/* Account Info Panel */}
        <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-card border border-border">
              <Mail className="size-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Correo Electrónico
              </p>
              <p className="truncate text-sm font-semibold mt-0.5 text-foreground">{user.email}</p>
            </div>
            {isGoogleUser && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Google
              </span>
            )}
          </div>
        </div>

        {/* Email Verification Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Verificación de Correo
            </h3>
            {!user.emailVerified && (
              <button
                type="button"
                disabled={reloading || sendingVerification}
                onClick={handleReloadUser}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${reloading ? "animate-spin" : ""}`} />
                Refrescar estado
              </button>
            )}
          </div>

          {user.emailVerified ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Dirección de correo verificada</p>
                <p className="mt-0.5 text-muted-foreground font-medium">
                  Tu correo ya está verificado de forma segura. Tu cuenta tiene acceso completo a todas las funciones.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-600 dark:text-amber-400">
              <div className="flex items-start gap-3">
                <ShieldAlert className="size-5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Verificación pendiente</p>
                  <p className="mt-0.5 text-muted-foreground font-medium">
                    Todavía no has verificado tu correo electrónico. Te recomendamos verificarlo para proteger tu acceso.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingVerification || verificationCooldown > 0}
                onClick={handleSendVerification}
                className="w-full text-xs font-semibold py-2 h-9 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                {sendingVerification ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : verificationCooldown > 0 ? (
                  `Reenviar en ${verificationCooldown}s`
                ) : (
                  "Enviar correo de verificación"
                )}
              </Button>
            </div>
          )}
        </section>

        {/* Change Password Section */}
        <section className="border-t border-border/40 pt-5 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Contraseña
          </h3>

          {isGoogleUser ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-card border border-border text-muted-foreground shrink-0 mt-0.5">
                <GoogleIcon />
              </div>
              <div className="text-xs font-medium text-muted-foreground leading-normal">
                <p className="font-semibold text-foreground">Inicio de sesión con Google</p>
                <p className="mt-0.5">
                  Tu cuenta está asociada a tu perfil de Google. No necesitas configurar o cambiar una contraseña local.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitPassword} className="flex flex-col gap-3">
              {/* Current Password */}
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Contraseña actual</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-ring">
                  <Lock className="size-4 text-muted-foreground shrink-0" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    disabled={submitting}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    title={showCurrent ? "Ocultar" : "Mostrar"}
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Nueva contraseña</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-ring">
                  <KeyRound className="size-4 text-muted-foreground shrink-0" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    disabled={submitting}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    title={showNew ? "Ocultar" : "Mostrar"}
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Confirmar nueva contraseña</p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 focus-within:border-ring">
                  <KeyRound className="size-4 text-muted-foreground shrink-0" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    disabled={submitting}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetir nueva contraseña"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    title={showConfirm ? "Ocultar" : "Mostrar"}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
                className="h-11 w-full rounded-xl text-sm mt-2"
              >
                {submitting ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </form>
          )}
        </section>
      </div>
    </BottomSheet>
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
