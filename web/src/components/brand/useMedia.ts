// Tiny media-query hook used by brand components for responsive layouts.
// Keeps inline-style pattern intact (no CSS modules / Tailwind added).

import { useEffect, useState } from "react"

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", listener)
    setMatches(mql.matches)
    return () => mql.removeEventListener("change", listener)
  }, [query])

  return matches
}

// Common shorthand hooks keyed off tokens.ts breakpoints
export const useIsNarrow = () => useMedia("(max-width: 960px)")
export const useIsMobile = () => useMedia("(max-width: 640px)")
