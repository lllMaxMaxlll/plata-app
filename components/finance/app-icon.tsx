import Image from "next/image"

import { cn } from "@/lib/utils"

interface AppIconProps {
  className?: string
  imageClassName?: string
  pulse?: boolean
  priority?: boolean
}

export function AppIcon({ className, imageClassName, pulse = false, priority = false }: AppIconProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-card",
        pulse && "animate-pulse shadow-[0_0_28px_color-mix(in_oklch,var(--primary)_28%,transparent)]",
        className
      )}
      aria-hidden="true"
    >
      <Image
        src="/plata-mark.png"
        alt=""
        width={512}
        height={512}
        priority={priority}
        className={cn("size-full object-contain p-[8%]", imageClassName)}
      />
    </span>
  )
}
