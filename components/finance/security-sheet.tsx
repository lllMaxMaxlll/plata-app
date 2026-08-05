"use client"

import { useState, useEffect } from "react"
import { ShieldAlert, KeyRound, Mail, RefreshCw, Lock, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useFinance } from "./finance-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function SecuritySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, changePassword, sendEmailVerificationLink, reloadUser } = useFinance()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationCooldown, setVerificationCooldown] = useState(0)
  const [reloading, setReloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setError(null)
    }
  }, [open])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    if (verificationCooldown > 0) {
      timer = setInterval(() => {
        setVerificationCooldown((prev) => prev - 1)
      }, 1000)
    }
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
      setVerificationCooldown(60)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al enviar el correo de verificación.")
    } finally {
      setSendingVerification(false)
    }
  }

  async function handleReloadUser() {
    setReloading(true)
    try {
      await reloadUser()
      toast.success("Estado de cuenta actualizado.")
    } catch (err) {
      console.error(err)
    } finally {
      setReloading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      const msg = "La nueva contraseña debe tener al menos 6 caracteres."
      setError(msg)
      toast.error(msg)
      return
    }

    if (newPassword !== confirmPassword) {
      const msg = "Las contraseñas nuevas no coinciden."
      setError(msg)
      toast.error(msg)
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success("Contraseña actualizada con éxito.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      await new Promise((resolve) => setTimeout(resolve, 350))
    } catch (err: any) {
      console.error(err)
      let message = "No se pudo actualizar la contraseña."
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}>
      <DialogContent className="w-full sm:max-w-xl max-w-[calc(100vw-2rem)] h-auto max-h-[90vh] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-200">
        <DialogHeader className="text-left pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                Seguridad y Accesos
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Gestioná la seguridad de tu cuenta, tu contraseña y métodos de inicio de sesión.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn("mt-2 flex min-w-0 flex-col gap-5 transition-all duration-200", submitting && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          {/* User Profile Summary Header */}
          <Card className="p-3.5 border-border/60 bg-card/60 rounded-2xl min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Mail className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Correo Electrónico
                </Label>
                <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
              </div>
              {isGoogleUser && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                  Google
                </span>
              )}
            </div>
          </Card>

          {/* Email Verification Section */}
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between min-w-0">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Verificación de Correo
              </Label>
              {!user.emailVerified && (
                <button
                  type="button"
                  disabled={reloading || sendingVerification}
                  onClick={handleReloadUser}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${reloading ? "animate-spin" : ""}`} />
                  Comprobar estado
                </button>
              )}
            </div>

            {user.emailVerified ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold min-w-0">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Tu correo electrónico está verificado correctamente.</span>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <div className="text-xs min-w-0">
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
                  className="w-full text-xs font-semibold py-2 h-9 rounded-xl border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 cursor-pointer mt-1"
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
          <section className="flex min-w-0 flex-col gap-3 border-t border-border/50 pt-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Cambiar Contraseña
            </Label>

            {isGoogleUser ? (
              <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-2xl border border-border/40">
                Iniciaste sesión con Google. La contraseña se gestiona directamente desde tu cuenta de Google.
              </p>
            ) : (
              <form onSubmit={handleChangePassword} className="flex min-w-0 flex-col gap-3.5">
                {error && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
                    {error}
                  </div>
                )}

                {/* Contraseña Actual */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contraseña Actual</Label>
                  <div className="relative flex items-center">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 text-sm pr-10 rounded-xl border-border bg-card/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nueva Contraseña</Label>
                  <div className="relative flex items-center">
                    <Input
                      type={showNew ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 text-sm pr-10 rounded-xl border-border bg-card/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Nueva Contraseña</Label>
                  <div className="relative flex items-center">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 text-sm pr-10 rounded-xl border-border bg-card/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
                  className="h-11 w-full text-sm font-semibold rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 cursor-pointer mt-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Actualizar contraseña"
                  )}
                </Button>
              </form>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
