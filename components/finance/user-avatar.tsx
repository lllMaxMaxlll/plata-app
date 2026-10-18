"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { User } from "./finance-provider"

/** La foto de perfil, o la inicial si no hay foto o no carga. */
export function UserAvatar({ user, className }: { user: User | null; className?: string }) {
  // Se guarda qué URL falló y no un booleano: al cambiar la foto se reintenta solo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = user?.avatarUrl && user.avatarUrl !== failedUrl ? user.avatarUrl : null

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-lime font-extrabold text-ink",
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- ya viene comprimida a 256 px
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        (user?.name?.charAt(0)?.toUpperCase() ?? "U")
      )}
    </span>
  )
}
