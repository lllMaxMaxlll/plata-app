"use client"

import { useEffect, useState } from "react"

/** Matches Tailwind's `md` breakpoint, used to pick between the mobile and desktop shells. */
const DESKTOP_QUERY = "(min-width: 768px)"

/**
 * Returns whether the viewport is desktop sized, or `null` while the breakpoint is
 * still unknown (server render and first paint). Callers should render a neutral
 * placeholder on `null` instead of guessing, so the app mounts a single shell.
 */
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(mediaQuery.matches)

    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return isDesktop
}
